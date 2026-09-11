import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Mentions légales — EvolyFoot" };

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      intro="Informations sur l’éditeur, l’hébergement et la propriété intellectuelle du site et de l’application EvolyFoot."
      title="Mentions légales"
      updatedAt="[à compléter]"
      sections={[
        {
          title: "Éditeur du site",
          paragraphs: [
            "EvolyFoot est édité par [Raison sociale], [forme juridique], au capital de [montant] €, immatriculée au RCS de [ville] sous le numéro [SIRET].",
            "Siège social : [Adresse complète]. Contact : [adresse e-mail de contact].",
          ],
        },
        {
          title: "Directeur de la publication",
          paragraphs: ["[Nom du directeur de la publication], en qualité de [fonction]."],
        },
        {
          title: "Hébergement",
          paragraphs: [
            "Le site et l’application sont hébergés par [Nom de l’hébergeur], [adresse de l’hébergeur], [contact ou site web de l’hébergeur].",
          ],
        },
        {
          title: "Propriété intellectuelle",
          paragraphs: [
            "L’ensemble des éléments du site EvolyFoot (textes, méthode, structure, charte graphique, marque) est protégé par le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite.",
          ],
        },
        {
          title: "Données personnelles",
          paragraphs: [
            "Le traitement des données personnelles des utilisateurs d’EvolyFoot est détaillé dans la politique de confidentialité, accessible depuis le pied de page du site.",
          ],
        },
        {
          title: "Contact",
          paragraphs: ["Pour toute question relative au site ou à ces mentions, écris-nous via la page contact ou à contact@evolyfoot.com."],
        },
      ]}
    />
  );
}
