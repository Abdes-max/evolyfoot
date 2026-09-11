import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Conditions générales d’utilisation — EvolyFoot" };

export default function CguPage() {
  return (
    <LegalPage
      intro="Les règles d’utilisation d’EvolyFoot par l’éducateur et par les comptes joueur/tuteur qu’il invite."
      title="Conditions générales d’utilisation"
      updatedAt="[à compléter]"
      sections={[
        {
          title: "Objet",
          paragraphs: [
            "Les présentes conditions régissent l’accès et l’utilisation d’EvolyFoot, application d’aide à la préparation et au suivi de séances pour les éducateurs de football de jeunes (U10–U13).",
          ],
        },
        {
          title: "Compte éducateur",
          paragraphs: [
            "La création d’un compte éducateur est gratuite. L’éducateur est responsable de la confidentialité de ses identifiants et de l’exactitude des informations qu’il saisit sur son équipe.",
          ],
        },
        {
          title: "Compte joueur / tuteur",
          paragraphs: [
            "L’éducateur peut inviter un joueur ou son tuteur à créer un compte, via un lien à usage unique et à durée limitée. Ce compte donne accès en lecture seule à la fiche du joueur concerné, au calendrier de l’équipe et à ses convocations aux matchs — jamais aux autres contenus de l’éducateur (plan, diagnostic, effectif complet, bibliothèque).",
          ],
        },
        {
          title: "Contenu et propriété",
          paragraphs: [
            "Les séances, observations et évaluations créées par l’éducateur lui appartiennent. La méthode, les schémas d’exercices et l’interface d’EvolyFoot restent la propriété de l’éditeur du site.",
          ],
        },
        {
          title: "Usage attendu",
          paragraphs: [
            "EvolyFoot est un outil d’aide à la préparation et au suivi ; il ne remplace pas le jugement de l’éducateur sur le terrain, en particulier pour tout ce qui touche à la santé ou à la sécurité des joueurs.",
          ],
        },
        {
          title: "Responsabilité",
          paragraphs: [
            "EvolyFoot est fourni « en l’état ». L’éditeur met tout en œuvre pour assurer la disponibilité et la fiabilité du service, sans garantir une disponibilité continue.",
          ],
        },
        {
          title: "Résiliation",
          paragraphs: [
            "L’éducateur peut demander la suppression de son compte à tout moment via la page contact ; cette suppression entraîne celle des comptes joueur/tuteur qui lui sont rattachés.",
          ],
        },
        {
          title: "Droit applicable",
          paragraphs: ["Les présentes conditions sont soumises au droit français."],
        },
      ]}
    />
  );
}
