import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité — EvolyFoot" };

export default function ConfidentialitePage() {
  return (
    <LegalPage
      intro="Comment EvolyFoot collecte, utilise et protège les données de l’éducateur et, via son compte, celles de son équipe."
      title="Politique de confidentialité"
      updatedAt="[à compléter]"
      sections={[
        {
          title: "Responsable de traitement",
          paragraphs: [
            "[Raison sociale], éditrice d’EvolyFoot, est responsable du traitement des données décrites ci-dessous. Contact : [adresse e-mail de contact données].",
          ],
        },
        {
          title: "Données collectées",
          paragraphs: [
            "Compte éducateur : nom, e-mail, mot de passe (chiffré), informations de profil renseignées volontairement.",
            "Effectif et suivi : identité et coordonnées des joueurs saisies par l’éducateur, présences, évaluations, diagnostics et observations.",
            "Compte joueur / tuteur : nom, e-mail, mot de passe (chiffré), créés à l’acceptation d’une invitation envoyée par l’éducateur.",
          ],
        },
        {
          title: "Finalités et base légale",
          paragraphs: [
            "Ces données sont traitées pour fournir le service (exécution du contrat d’utilisation), assurer la sécurité des comptes, et répondre aux demandes envoyées via le formulaire de contact (intérêt légitime).",
          ],
        },
        {
          title: "Destinataires",
          paragraphs: [
            "Les données de l’effectif d’une équipe sont visibles uniquement par l’éducateur de cette équipe et, pour un joueur donné, par le compte joueur/tuteur qu’il a lui-même invité et limité à sa propre fiche. Aucune donnée n’est cédée à des tiers à des fins commerciales.",
          ],
        },
        {
          title: "Durée de conservation",
          paragraphs: [
            "Les données sont conservées le temps de l’utilisation active du compte, puis [durée à préciser] après la dernière connexion, sauf demande de suppression anticipée.",
          ],
        },
        {
          title: "Droits des personnes",
          paragraphs: [
            "Conformément au RGPD, toute personne concernée dispose d’un droit d’accès, de rectification, d’effacement, de limitation et de portabilité de ses données, exerçable auprès de [adresse e-mail de contact données].",
          ],
        },
        {
          title: "Sécurité",
          paragraphs: [
            "Les mots de passe sont stockés sous forme hachée. Les accès aux données d’une équipe sont strictement réservés à l’éducateur qui la gère et aux comptes joueur/tuteur qu’il invite.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "EvolyFoot utilise un cookie de session strictement nécessaire à la connexion, exempté de consentement. Aucun cookie publicitaire ou de mesure d’audience tiers n’est déposé à ce jour.",
          ],
        },
      ]}
    />
  );
}
