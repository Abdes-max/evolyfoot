import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Mentions légales — EvolyFoot" };

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      intro="Informations sur l’éditeur, l’hébergement et la propriété intellectuelle du site et de l’application EvolyFoot."
      title="Mentions légales"
      updatedAt="12 novembre 2026"
      sections={[
        {
          title: "Éditeur du site",
          paragraphs: [
            "EvolyFoot est édité par Abdeslem Ziaissa, entrepreneur individuel (EI) exerçant sous le nom commercial EvolyFoot, micro-entreprise immatriculée sous le numéro SIRET 917 443 376 00020. TVA non applicable, art. 293 B du CGI.",
            "Adresse : 485 route d’Eguilles, Résidence Les Jardins de la Chapelle, 13090 Aix-en-Provence. Contact : contact@evolyfoot.com.",
          ],
        },
        {
          title: "Directeur de la publication",
          paragraphs: ["Abdeslem Ziaissa, en qualité d’éditeur."],
        },
        {
          title: "Hébergement",
          paragraphs: [
            "Le site et l’application sont hébergés par Hostinger International Ltd, 61 Lordou Vironos Street, 6023 Larnaca, Chypre (www.hostinger.fr).",
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
