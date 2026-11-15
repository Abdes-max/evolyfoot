"use client";

import { useEffect, useState, type FormEvent } from "react";

type Tab = "dashboard" | "educators" | "subscriptions" | "audit" | "account";

interface Stats {
  educators: { total: number; real: number; test: number; verified: number; suspended: number; signupsLast7Days: number; signupsLast30Days: number };
  access: { subscribed: number; trial: number; expired: number };
  content: { players: number; matches: number; trainingSessions: number; observations: number };
}

interface EducatorItem {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  emailVerified: boolean;
  suspended: boolean;
  isTest: boolean;
  access: "subscribed" | "trial" | "expired";
  subscriptionStatus: string | null;
  players: number;
  matches: number;
}

interface EducatorDetail extends EducatorItem {
  trialEndsAt: string | null;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  subscriptionCancelAt: string | null;
  stripeCustomerId: string | null;
  club: string | null;
  counts: Record<string, number>;
  lastSessionAt: string | null;
}

interface AuditEntry {
  id: string;
  superAdminEmail: string;
  action: string;
  targetLabel: string | null;
  note: string | null;
  createdAt: string;
}

const accessLabels = { subscribed: "Abonné", trial: "Essai", expired: "Expiré" } as const;
const tabs: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "educators", label: "Éducateurs" },
  { id: "subscriptions", label: "Abonnements" },
  { id: "audit", label: "Journal" },
  { id: "account", label: "Compte" },
];

function date(value: string | null): string {
  return value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(`/api/super-admin/${path}`, {
    ...init,
    headers: { "content-type": "application/json" },
    body: init?.json === undefined ? undefined : JSON.stringify(init.json),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign("/super-admin/login");
  }
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Erreur.");
  }
  return body as T;
}

export function SuperAdminConsole() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    call<{ superAdmin: { email: string } }>("auth/me")
      .then((body) => setMe(body.superAdmin.email))
      .catch(() => undefined);
  }, []);

  async function logout() {
    await fetch("/api/super-admin/auth/logout", { method: "POST" });
    window.location.assign("/super-admin/login");
  }

  if (!me) {
    return null;
  }

  return (
    <div className="sa-shell">
      <header className="sa-bar">
        <strong>EvolyFoot · Superadmin</strong>
        <nav>
          {tabs.map((item) => (
            <button aria-current={tab === item.id} className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)} type="button">
              {item.label}
            </button>
          ))}
        </nav>
        <span>{me}</span>
        <button onClick={logout} type="button">
          Déconnexion
        </button>
      </header>
      <main className="sa-content">
        {tab === "dashboard" ? <Dashboard /> : null}
        {tab === "educators" ? <Educators /> : null}
        {tab === "subscriptions" ? <Educators subscriptions /> : null}
        {tab === "audit" ? <Audit /> : null}
        {tab === "account" ? <Account /> : null}
      </main>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    call<{ stats: Stats }>("stats")
      .then((body) => setStats(body.stats))
      .catch(() => undefined);
  }, []);
  if (!stats) {
    return <p>Chargement…</p>;
  }
  const cards: [string, number][] = [
    ["Éducateurs (hors test)", stats.educators.real],
    ["Comptes de test", stats.educators.test],
    ["E-mail vérifié", stats.educators.verified],
    ["Suspendus", stats.educators.suspended],
    ["Inscrits sur 7 jours", stats.educators.signupsLast7Days],
    ["Inscrits sur 30 jours", stats.educators.signupsLast30Days],
    ["Abonnés", stats.access.subscribed],
    ["En essai", stats.access.trial],
    ["Essai expiré", stats.access.expired],
    ["Joueurs", stats.content.players],
    ["Matchs", stats.content.matches],
    ["Séances", stats.content.trainingSessions],
    ["Observations", stats.content.observations],
  ];
  return (
    <div className="sa-grid">
      {cards.map(([label, value]) => (
        <div className="sa-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function Educators({ subscriptions = false }: { subscriptions?: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(subscriptions ? "subscribed" : "all");
  const [items, setItems] = useState<EducatorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    call<{ items: EducatorItem[]; total: number }>(`educators?filter=${filter}&search=${encodeURIComponent(search)}&pageSize=100`)
      .then((body) => {
        setItems(body.items);
        setTotal(body.total);
      })
      .catch(() => undefined);
  }, [filter, search, reload]);

  if (selected) {
    return (
      <EducatorPanel
        id={selected}
        onBack={() => {
          setSelected(null);
          setReload((value) => value + 1);
        }}
      />
    );
  }

  return (
    <section>
      <div className="sa-filters">
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher (e-mail ou nom)" value={search} />
        <select onChange={(event) => setFilter(event.target.value)} value={filter}>
          <option value="all">Tous</option>
          <option value="trial">En essai</option>
          <option value="subscribed">Abonnés</option>
          <option value="expired">Essai expiré</option>
          <option value="suspended">Suspendus</option>
          <option value="test">Comptes de test</option>
        </select>
        <span>{total} résultat(s)</span>
      </div>
      <table className="sa-table">
        <thead>
          <tr>
            <th>Éducateur</th>
            <th>Accès</th>
            <th>Statut Stripe</th>
            <th>Joueurs</th>
            <th>Matchs</th>
            <th>Inscrit</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.displayName}
                <br />
                <small>{item.email}</small>
              </td>
              <td>
                {accessLabels[item.access]}
                {item.suspended ? " · suspendu" : ""}
                {item.isTest ? " · test" : ""}
                {item.emailVerified ? "" : " · e-mail non vérifié"}
              </td>
              <td>{item.subscriptionStatus ?? "—"}</td>
              <td>{item.players}</td>
              <td>{item.matches}</td>
              <td>{date(item.createdAt)}</td>
              <td>
                <button onClick={() => setSelected(item.id)} type="button">
                  Ouvrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EducatorPanel({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<EducatorDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState("14");
  const [confirmEmail, setConfirmEmail] = useState("");

  useEffect(() => {
    call<{ educator: EducatorDetail }>(`educators/${id}`)
      .then((body) => setDetail(body.educator))
      .catch((error: Error) => setMessage(error.message));
  }, [id]);

  async function act(action: string, json: Record<string, unknown> = {}) {
    setMessage(null);
    try {
      const body = await call<{ educator?: EducatorDetail; redirect?: string }>(`educators/${id}/${action}`, {
        method: "POST",
        json: { note: note || undefined, ...json },
      });
      if (body.redirect) {
        window.location.assign(body.redirect);
        return;
      }
      if (body.educator) {
        setDetail(body.educator);
      }
      setMessage("Fait.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function remove() {
    setMessage(null);
    try {
      await call(`educators/${id}`, { method: "DELETE", json: { confirmEmail } });
      onBack();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  if (!detail) {
    return <p>{message ?? "Chargement…"}</p>;
  }

  return (
    <section className="sa-detail">
      <button onClick={onBack} type="button">
        ← Retour
      </button>
      <h2>{detail.displayName}</h2>
      <p>
        {detail.email} · {accessLabels[detail.access]}
        {detail.suspended ? " · suspendu" : ""}
        {detail.isTest ? " · test" : ""}
      </p>
      <dl className="sa-facts">
        <dt>Inscrit</dt>
        <dd>{date(detail.createdAt)}</dd>
        <dt>Dernière connexion</dt>
        <dd>{date(detail.lastSessionAt)}</dd>
        <dt>E-mail vérifié</dt>
        <dd>{detail.emailVerified ? "Oui" : "Non"}</dd>
        <dt>Fin d&apos;essai</dt>
        <dd>{date(detail.trialEndsAt)}</dd>
        <dt>Abonnement</dt>
        <dd>
          {detail.subscriptionStatus ?? "—"} {detail.billingCycle ?? ""} (fin de période {date(detail.currentPeriodEnd)})
        </dd>
        <dt>Club</dt>
        <dd>{detail.club ?? "—"}</dd>
        {Object.entries(detail.counts).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <label>
        Motif (facultatif, enregistré dans le journal)
        <input maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} />
      </label>
      <div className="sa-actions">
        {detail.suspended ? (
          <button onClick={() => act("reactivate")} type="button">
            Réactiver
          </button>
        ) : (
          <button onClick={() => act("suspend")} type="button">
            Suspendre
          </button>
        )}
        <button onClick={() => act(detail.isTest ? "unmark-test" : "mark-test")} type="button">
          {detail.isTest ? "Retirer « test »" : "Marquer « test »"}
        </button>
        {detail.emailVerified ? null : (
          <button onClick={() => act("verify-email")} type="button">
            Valider l&apos;e-mail
          </button>
        )}
        <button disabled={detail.suspended} onClick={() => act("impersonate")} type="button">
          Se connecter en tant que
        </button>
      </div>
      <div className="sa-actions">
        <input aria-label="Jours" min={1} max={90} onChange={(event) => setDays(event.target.value)} type="number" value={days} />
        <button onClick={() => act("extend-trial", { days: Number(days) })} type="button">
          Prolonger l&apos;essai (jours)
        </button>
      </div>
      <div className="sa-danger">
        <p>Suppression définitive du compte et de toutes ses données. Saisis son adresse e-mail pour confirmer.</p>
        <input
          aria-label="Adresse e-mail de confirmation"
          onChange={(event) => setConfirmEmail(event.target.value)}
          placeholder={detail.email}
          value={confirmEmail}
        />
        <button disabled={confirmEmail.trim().toLowerCase() !== detail.email.toLowerCase()} onClick={remove} type="button">
          Supprimer définitivement
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

function Audit() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");

  useEffect(() => {
    call<{ items: AuditEntry[] }>(`audit-log?pageSize=100&action=${encodeURIComponent(action)}&search=${encodeURIComponent(search)}`)
      .then((body) => setItems(body.items))
      .catch(() => undefined);
  }, [action, search]);

  return (
    <section>
      <div className="sa-filters">
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Cible ou motif" value={search} />
        <select onChange={(event) => setAction(event.target.value)} value={action}>
          <option value="">Toutes les actions</option>
          {[
            "educator.suspend",
            "educator.reactivate",
            "educator.mark-test",
            "educator.unmark-test",
            "educator.verify-email",
            "educator.extend-trial",
            "educator.delete",
            "impersonation.start",
            "impersonation.stop",
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <table className="sa-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Superadmin</th>
            <th>Action</th>
            <th>Cible</th>
            <th>Motif</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id}>
              <td>{date(entry.createdAt)}</td>
              <td>{entry.superAdminEmail}</td>
              <td>{entry.action}</td>
              <td>{entry.targetLabel ?? "—"}</td>
              <td>{entry.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Account() {
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await call("auth/password", { method: "PUT", json: { currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") } });
      form.reset();
      setMessage("Mot de passe modifié.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <form className="sa-card" onSubmit={submit}>
      <h2>Changer le mot de passe</h2>
      <label>
        Mot de passe actuel
        <input autoComplete="current-password" name="currentPassword" required type="password" />
      </label>
      <label>
        Nouveau mot de passe (12 caractères minimum)
        <input autoComplete="new-password" minLength={12} name="newPassword" required type="password" />
      </label>
      <button type="submit">Enregistrer</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
