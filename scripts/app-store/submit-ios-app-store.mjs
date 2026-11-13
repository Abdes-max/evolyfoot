#!/usr/bin/env node
// Submits an already-uploaded, already-tested TestFlight build for App
// Store review -- the exact .ipa testers ran, never a fresh archive. Unlike
// Android's track promotion, Apple has no separate "production artifact":
// the same build just gets attached to an App Store version and submitted.
//
// Deliberately zero new npm dependencies, same reasoning as
// promote-android-release.mjs: the App Store Connect API is plain REST, and
// its JWT auth only needs ES256 signing over the same .p8 key already used
// by deploy-ios.yml -- Node's built-in `crypto` module handles that
// (`dsaEncoding: 'ieee-p1363'` gets the raw R||S format JWT needs, not the
// DER format crypto.sign returns by default for EC keys).
//
// This is a real submission for Apple review -- it will fail loudly (not
// silently guess) if the app's store listing (screenshots, description,
// age rating, App Privacy answers, etc.) isn't already complete in App
// Store Connect, since Apple itself rejects an incomplete version at
// submission time. Filling in that listing is a one-time manual step in
// App Store Connect's own UI, not something this script attempts.
//
// Usage (all via env vars, matching this repo's other infra/scripts/*.mjs):
//   APP_STORE_CONNECT_API_KEY_BASE64  (required -- same secret as deploy-ios.yml)
//   APP_STORE_CONNECT_KEY_ID          (required)
//   APP_STORE_CONNECT_ISSUER_ID       (required)
//   BUNDLE_ID=com.evolyfoot.coach     (required -- com.evolyfoot.player for the Player app)
//   VERSION_STRING=1.0                (required -- the marketing version,
//                                       e.g. "1.0"; must match/extend what's
//                                       already in App Store Connect)
//   BUILD_NUMBER=42                   (optional -- defaults to the most
//                                       recently processed TestFlight build)
//   RELEASE_NOTES="..."               (required for a version's first-ever
//                                       submission -- Apple rejects an empty
//                                       whatsNew then; optional afterwards,
//                                       where omitting it just leaves the
//                                       existing text untouched. Applied to
//                                       every locale the version's store
//                                       listing already has.)
//   METADATA_FILE=apps/mobile/store-assets/metadata.fr.json
//                                     (optional -- store listing text applied
//                                       before submitting: name, subtitle,
//                                       description, keywords, URLs, category)
//   SUBMIT=false                      (optional -- "false" applies the metadata,
//                                       screenshots and build but stops before
//                                       the review submission, to check the
//                                       version in App Store Connect first)
//   TEMPLATE_BUNDLE_ID=com.arenapulse.mobile
//                                     (optional -- another app of the same account
//                                       used as the model: its age rating answers
//                                       and App Review contact are copied, never
//                                       printed in full)
//   REVIEW_DEMO_LOGIN / REVIEW_DEMO_PASSWORD
//                                     (optional -- demo account for Apple's
//                                       reviewer, from GitHub secrets; written to
//                                       App Store Connect, never printed)
//   RELEASE_TYPE=MANUAL               (optional, default MANUAL -- MANUAL
//                                       means approval doesn't auto-publish;
//                                       release stays a deliberate separate
//                                       step in App Store Connect. AFTER_APPROVAL
//                                       publishes immediately on approval.)
//
// node infra/scripts/submit-ios-app-store.mjs

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { replaceScreenshots } from "./lib/app-store-screenshots.mjs";

const {
  APP_STORE_CONNECT_API_KEY_BASE64,
  APP_STORE_CONNECT_KEY_ID,
  APP_STORE_CONNECT_ISSUER_ID,
  BUNDLE_ID,
  VERSION_STRING,
  BUILD_NUMBER,
  RELEASE_NOTES,
  RELEASE_TYPE = "MANUAL",
  SCREENSHOTS_DIR,
  METADATA_FILE,
  SUBMIT = "true",
  TEMPLATE_BUNDLE_ID,
  REVIEW_DEMO_LOGIN,
  REVIEW_DEMO_PASSWORD,
} = process.env;

for (const [name, value] of Object.entries({
  APP_STORE_CONNECT_API_KEY_BASE64,
  APP_STORE_CONNECT_KEY_ID,
  APP_STORE_CONNECT_ISSUER_ID,
  BUNDLE_ID,
  VERSION_STRING,
})) {
  if (!value) {
    console.error(`✗ ${name} is required.`);
    process.exit(1);
  }
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** App Store Connect API JWT -- https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests */
function buildJwt(privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: APP_STORE_CONNECT_KEY_ID, typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: APP_STORE_CONNECT_ISSUER_ID,
      iat: now,
      exp: now + 1200, // Apple caps this token type at 20 minutes.
      aud: "appstoreconnect-v1",
    }),
  );
  const signer = createSign("sha256");
  signer.update(`${header}.${claims}`);
  signer.end();
  const signature = base64url(signer.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" }));
  return `${header}.${claims}.${signature}`;
}

async function api(jwt, method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// Creates or updates the localization of the app info (name, subtitle, privacy policy URL) and of the version
// (description, keywords, promotional text, support/marketing URLs), and sets the copyright and primary category.
async function applyMetadata(jwt, appId, versionId, metadata, firstRelease) {
  const locale = metadata.locale ?? "fr-FR";
  console.log(`Applying the store listing (${locale})...`);

  const appInfos = await api(jwt, "GET", `/apps/${appId}/appInfos`);
  const appInfo = (appInfos.data ?? []).find((info) => info.attributes.appStoreState !== "READY_FOR_SALE") ?? appInfos.data?.[0];
  if (!appInfo) throw new Error("No app info found for this app.");

  // Copyright shown on the store page ("© 2026 KELTO Studio"): an attribute of the version, not of a localization.
  if (metadata.copyright) {
    await api(jwt, "PATCH", `/appStoreVersions/${versionId}`, {
      data: { type: "appStoreVersions", id: versionId, attributes: { copyright: metadata.copyright } },
    });
  }

  if (metadata.primaryCategory) {
    await api(jwt, "PATCH", `/appInfos/${appInfo.id}`, {
      data: {
        type: "appInfos",
        id: appInfo.id,
        relationships: { primaryCategory: { data: { type: "appCategories", id: metadata.primaryCategory } } },
      },
    });
  }

  if (metadata.app) {
    const existing = await api(jwt, "GET", `/appInfos/${appInfo.id}/appInfoLocalizations`);
    const current = (existing.data ?? []).find((entry) => entry.attributes.locale === locale);
    if (current) {
      await api(jwt, "PATCH", `/appInfoLocalizations/${current.id}`, {
        data: { type: "appInfoLocalizations", id: current.id, attributes: metadata.app },
      });
    } else {
      await api(jwt, "POST", "/appInfoLocalizations", {
        data: {
          type: "appInfoLocalizations",
          attributes: { locale, ...metadata.app },
          relationships: { appInfo: { data: { type: "appInfos", id: appInfo.id } } },
        },
      });
    }
  }

  if (metadata.version) {
    // Apple refuse « Nouveautés » (whatsNew) sur la toute première version d'une app (409 STATE_ERROR).
    const attributes = { ...metadata.version };
    if (firstRelease) delete attributes.whatsNew;
    const existing = await api(jwt, "GET", `/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
    const current = (existing.data ?? []).find((entry) => entry.attributes.locale === locale);
    if (current) {
      await api(jwt, "PATCH", `/appStoreVersionLocalizations/${current.id}`, {
        data: { type: "appStoreVersionLocalizations", id: current.id, attributes },
      });
    } else {
      await api(jwt, "POST", "/appStoreVersionLocalizations", {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale, ...attributes },
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } },
        },
      });
    }
  }
  console.log("  → store listing applied.");
}

// "jean.dupont@example.com" → "j…@example.com", "+33612345678" → "…78" : enough to recognise, nothing more in the logs.
function mask(value) {
  if (!value) return "(vide)";
  if (value.includes("@")) return `${value[0]}…@${value.split("@")[1]}`;
  return `…${value.slice(-2)}`;
}

// App info still being prepared (the one Apple reviews with the version), else the only one.
async function editableAppInfo(jwt, appId) {
  const infos = await api(jwt, "GET", `/apps/${appId}/appInfos`);
  const live = ["READY_FOR_DISTRIBUTION", "READY_FOR_SALE", "REPLACED_WITH_NEW_INFO"];
  return (infos.data ?? []).find((info) => !live.includes(info.attributes?.state ?? info.attributes?.appStoreState)) ?? infos.data?.[0];
}

// Age rating answers and App Review contact copied from another app of the same account (TEMPLATE_BUNDLE_ID),
// then the review notes and demo account of this app. The model app's data is never printed in full.
async function applyReviewSetup(jwt, appId, versionId, review) {
  const templates = await api(jwt, "GET", `/apps?filter[bundleId]=${encodeURIComponent(TEMPLATE_BUNDLE_ID)}`);
  const template = templates.data?.[0];
  if (!template) {
    console.warn(`  ⚠ model app "${TEMPLATE_BUNDLE_ID}" not found with this API key: age rating and review contact left as they are.`);
    return;
  }

  console.log(`Copying the age rating answers of ${TEMPLATE_BUNDLE_ID}...`);
  const templateInfo = await editableAppInfo(jwt, template.id);
  const templateRating = (await api(jwt, "GET", `/appInfos/${templateInfo.id}/ageRatingDeclaration`)).data;
  const ownInfo = await editableAppInfo(jwt, appId);
  const ownRating = (await api(jwt, "GET", `/appInfos/${ownInfo.id}/ageRatingDeclaration`)).data;
  const answers = Object.fromEntries(
    Object.entries({ ...templateRating.attributes, ...(review?.ageRatingOverrides ?? {}) }).filter(([, value]) => value !== null && value !== undefined),
  );
  // Ancien et nouveau questionnaire : Apple refuse l'override v1 quand le v2 est renseigné.
  if (answers.ageRatingOverrideV2 !== undefined) delete answers.ageRatingOverride;
  try {
    await api(jwt, "PATCH", `/ageRatingDeclarations/${ownRating.id}`, { data: { type: "ageRatingDeclarations", id: ownRating.id, attributes: answers } });
    console.log(`  → applied: ${JSON.stringify(answers)}`);
  } catch (error) {
    console.warn(`  ⚠ age rating not applied (${error.message}). Answers of the model: ${JSON.stringify(answers)}`);
  }

  console.log("Setting the App Review information...");
  const templateVersions = await api(jwt, "GET", `/apps/${template.id}/appStoreVersions?filter[platform]=IOS&limit=20`);
  let contact = null;
  for (const templateVersion of templateVersions.data ?? []) {
    const detail = await api(jwt, "GET", `/appStoreVersions/${templateVersion.id}/appStoreReviewDetail`).catch(() => null);
    if (detail?.data?.attributes?.contactEmail) {
      contact = detail.data.attributes;
      break;
    }
  }
  const demoAccountRequired = Boolean(review?.demoAccountRequired);
  const attributes = {
    ...(contact
      ? {
          contactFirstName: contact.contactFirstName,
          contactLastName: contact.contactLastName,
          contactPhone: contact.contactPhone,
          contactEmail: contact.contactEmail,
        }
      : {}),
    demoAccountRequired,
    ...(REVIEW_DEMO_LOGIN && REVIEW_DEMO_PASSWORD ? { demoAccountName: REVIEW_DEMO_LOGIN, demoAccountPassword: REVIEW_DEMO_PASSWORD } : {}),
    ...(review?.notes ? { notes: review.notes } : {}),
  };
  const existing = await api(jwt, "GET", `/appStoreVersions/${versionId}/appStoreReviewDetail`).catch(() => null);
  if (existing?.data) {
    await api(jwt, "PATCH", `/appStoreReviewDetails/${existing.data.id}`, { data: { type: "appStoreReviewDetails", id: existing.data.id, attributes } });
  } else {
    await api(jwt, "POST", "/appStoreReviewDetails", {
      data: { type: "appStoreReviewDetails", attributes, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } } },
    });
  }
  console.log(
    contact
      ? `  → contact: ${contact.contactFirstName} ${mask(contact.contactLastName)}, ${mask(contact.contactEmail)}, ${mask(contact.contactPhone)}`
      : "  ⚠ no App Review contact found on the model app: fill it in App Store Connect.",
  );
  console.log(`  → demo account required: ${demoAccountRequired ? "yes" : "no"}, provided: ${REVIEW_DEMO_LOGIN && REVIEW_DEMO_PASSWORD ? "yes" : "no"}`);
  if (demoAccountRequired && !(REVIEW_DEMO_LOGIN && REVIEW_DEMO_PASSWORD)) {
    console.warn("  ⚠ demo account required but its secrets are missing: Apple will reject the submission without it.");
  }
}

async function main() {
  const privateKeyPem = Buffer.from(APP_STORE_CONNECT_API_KEY_BASE64, "base64").toString("utf8");
  const jwt = buildJwt(privateKeyPem);

  console.log(`Looking up the app for bundle ID "${BUNDLE_ID}"...`);
  const apps = await api(jwt, "GET", `/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = apps.data?.[0];
  if (!app) {
    throw new Error(`No app found for bundle ID "${BUNDLE_ID}" in App Store Connect.`);
  }
  const appId = app.id;

  console.log(BUILD_NUMBER ? `Looking up build ${BUILD_NUMBER}...` : "Looking up the most recently processed build...");
  const buildFilter = BUILD_NUMBER ? `&filter[version]=${encodeURIComponent(BUILD_NUMBER)}` : "";
  const builds = await api(jwt, "GET", `/builds?filter[app]=${appId}&filter[processingState]=VALID${buildFilter}&sort=-uploadedDate&limit=1`);
  const build = builds.data?.[0];
  if (!build) {
    throw new Error(
      BUILD_NUMBER
        ? `No processed (VALID) build ${BUILD_NUMBER} found -- it may still be processing, or the number is wrong.`
        : "No processed (VALID) build found at all -- upload one via deploy-ios.yml first and wait for TestFlight processing to finish.",
    );
  }
  console.log(`  → using build ${build.attributes.version} (id ${build.id})`);

  console.log(`Looking for an existing App Store version "${VERSION_STRING}"...`);
  const versions = await api(jwt, "GET", `/apps/${appId}/appStoreVersions?filter[versionString]=${encodeURIComponent(VERSION_STRING)}&filter[platform]=IOS`);
  let version = versions.data?.[0];

  if (version) {
    const state = version.attributes.appStoreState;
    // Any state other than these means the version is already submitted,
    // in review, or live -- attaching a different build or re-submitting
    // would either fail outright or silently do nothing useful. Fail
    // loudly instead of guessing what the caller meant.
    const editableStates = ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED"];
    if (!editableStates.includes(state)) {
      throw new Error(
        `App Store version "${VERSION_STRING}" already exists in state "${state}" -- ` +
          "not safe to modify/resubmit automatically. Use a new VERSION_STRING, or " +
          "resolve the existing version manually in App Store Connect first.",
      );
    }
    console.log(`  → found existing version in state "${state}", reusing it.`);
    // Created with whatever release type the first run used -- keep it in
    // line with this run's choice (MANUAL / AFTER_APPROVAL).
    await api(jwt, "PATCH", `/appStoreVersions/${version.id}`, {
      data: { type: "appStoreVersions", id: version.id, attributes: { releaseType: RELEASE_TYPE } },
    });
  } else {
    console.log("  → none found, creating a new one.");
    const created = await api(jwt, "POST", "/appStoreVersions", {
      data: {
        type: "appStoreVersions",
        attributes: { platform: "IOS", versionString: VERSION_STRING, releaseType: RELEASE_TYPE },
        relationships: { app: { data: { type: "apps", id: appId } } },
      },
    });
    version = created.data;
  }

  console.log(`Attaching build ${build.attributes.version} to the version...`);
  await api(jwt, "PATCH", `/appStoreVersions/${version.id}/relationships/build`, {
    data: { type: "builds", id: build.id },
  });

  // whatsNew only exists from the second version on: Apple rejects it (409
  // "cannot be edited at this time") on an app's very first version, so it is
  // skipped while no other version of the app exists. Loops over whichever
  // locale(s) the version really has, the same text on each.
  const allVersions = await api(jwt, "GET", `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=200`);
  const firstRelease = !(allVersions.data ?? []).some((entry) => entry.id !== version.id);
  if (firstRelease) console.log("  → first version of the app: release notes (whatsNew) skipped.");
  if (RELEASE_NOTES && !firstRelease) {
    console.log("Setting release notes...");
    const localizations = await api(jwt, "GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
    if (!localizations.data || localizations.data.length === 0) {
      console.warn(
        "  ⚠ no localization found on this version yet -- skipping release notes. " + "Create the store listing localization in App Store Connect first.",
      );
    } else {
      for (const localization of localizations.data) {
        await api(jwt, "PATCH", `/appStoreVersionLocalizations/${localization.id}`, {
          data: {
            type: "appStoreVersionLocalizations",
            id: localization.id,
            attributes: { whatsNew: RELEASE_NOTES },
          },
        });
      }
      console.log(`  → set on ${localizations.data.length} localization(s).`);
    }
  }

  // Store listing text (description, keywords, URLs, name, subtitle, category) from a committed JSON file, so the
  // listing is reproducible. Age rating, App Privacy answers and the reviewer's demo account stay manual steps in
  // App Store Connect (Apple offers no API for App Privacy, and the demo account is a credential).
  const metadata = METADATA_FILE ? JSON.parse(readFileSync(METADATA_FILE, "utf8")) : null;
  if (metadata) {
    await applyMetadata(jwt, appId, version.id, metadata, firstRelease);
  }
  if (TEMPLATE_BUNDLE_ID) {
    await applyReviewSetup(jwt, appId, version.id, metadata?.review);
  }

  // Screenshots are locked once the version is in review -- replace them
  // first when asked (SCREENSHOTS_DIR = apps/mobile/store-assets/app-store).
  if (SCREENSHOTS_DIR) {
    console.log(`Replacing screenshots from ${SCREENSHOTS_DIR}...`);
    const localizations = await api(jwt, "GET", `/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
    await replaceScreenshots(
      (method, path, body) => api(jwt, method, path, body),
      (localizations.data ?? []).map((localization) => localization.id),
      SCREENSHOTS_DIR,
    );
  }

  if (SUBMIT !== "true") {
    console.log(
      `✓ Version ${VERSION_STRING} (build ${build.attributes.version}) prepared, NOT submitted (SUBMIT=${SUBMIT}). ` +
        `Check it at https://appstoreconnect.apple.com/apps/${appId}/appstore, then rerun with submit enabled.`,
    );
    return;
  }

  // Apple replaced the old one-step "appStoreVersionSubmissions" endpoint
  // with a three-step "reviewSubmissions" flow (apps that have ever used it
  // get permanently switched over -- the old endpoint then answers 403
  // "Allowed operation is: DELETE" to any further POST, discovered the hard
  // way running this script against an app that already had one): create a
  // review submission, attach the version to it as an "item", then mark it
  // submitted. See docs/delivery.md.
  console.log("Looking for an existing, still-open review submission...");
  const openSubmissions = await api(jwt, "GET", `/apps/${appId}/reviewSubmissions?filter[platform]=IOS&fields[reviewSubmissions]=state`);
  const activeSubmission = (openSubmissions.data ?? []).find((s) => s.attributes.state !== "COMPLETE");

  let reviewSubmissionId;
  if (activeSubmission) {
    if (activeSubmission.attributes.state !== "READY_FOR_REVIEW") {
      throw new Error(
        `App already has a review submission in state "${activeSubmission.attributes.state}" ` +
          `(id ${activeSubmission.id}) -- not safe to add items to it automatically. ` +
          "Resolve it manually in App Store Connect first (cancel or wait for it to complete).",
      );
    }
    console.log(`  → reusing open review submission ${activeSubmission.id}.`);
    reviewSubmissionId = activeSubmission.id;
  } else {
    console.log("  → none found, creating a new one.");
    const created = await api(jwt, "POST", "/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        relationships: { app: { data: { type: "apps", id: appId } } },
      },
    });
    reviewSubmissionId = created.data.id;
  }

  console.log(`Adding version ${VERSION_STRING} as a review submission item...`);
  await api(jwt, "POST", "/reviewSubmissionItems", {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: reviewSubmissionId } },
        appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
      },
    },
  });

  console.log("Submitting for review...");
  await api(jwt, "PATCH", `/reviewSubmissions/${reviewSubmissionId}`, {
    data: {
      type: "reviewSubmissions",
      id: reviewSubmissionId,
      attributes: { submitted: true },
    },
  });

  console.log(
    `✓ Version ${VERSION_STRING} (build ${build.attributes.version}) submitted for review. ` +
      `Track status at https://appstoreconnect.apple.com/apps/${appId}/appstore`,
  );
}

main().catch((err) => {
  // fetch's own "fetch failed" says nothing -- the network reason is in cause.
  const cause = err.cause ? ` (${err.cause.code ?? err.cause.message})` : "";
  console.error("✗", `${err.message}${cause}`);
  process.exit(1);
});
