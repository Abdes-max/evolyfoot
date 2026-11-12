import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Conditions générales d’utilisation et de vente — EvolyFoot" };

export default function CguPage() {
  return (
    <LegalPage
      intro="Les règles d’utilisation d’EvolyFoot par l’éducateur et par les comptes joueur/tuteur qu’il invite."
      title="Conditions générales d’utilisation et de vente"
      updatedAt="12 novembre 2026"
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
            "La création d’un compte éducateur est gratuite et ouvre un essai de 14 jours ; l’usage au-delà de l’essai nécessite un abonnement (voir « Abonnement et paiement »). L’éducateur est responsable de la confidentialité de ses identifiants et de l’exactitude des informations qu’il saisit sur son équipe.",
          ],
        },
        {
          title: "Compte joueur / tuteur",
          paragraphs: [
            "L’éducateur peut inviter un joueur ou son tuteur à créer un compte, via un lien à usage unique et à durée limitée. Ce compte donne accès en lecture seule à la fiche du joueur concerné, au calendrier de l’équipe et à ses convocations aux matchs — jamais aux autres contenus de l’éducateur (plan, diagnostic, effectif complet, bibliothèque).",
          ],
        },
        {
          title: "Abonnement et paiement",
          paragraphs: [
            "Le service est vendu par KELTO Studio, entreprise individuelle (EI), SIRET 917 443 376 00020, 485 route d’Eguilles, Résidence Les Jardins de la Chapelle, 13090 Aix-en-Provence.",
            "Après l’essai gratuit de 14 jours, sans carte bancaire, l’abonnement est payé au mois ou à la saison (12 mois), aux prix affichés sur la page Tarifs : une formule de base pour 1 coach et 1 équipe, et un supplément par équipe et par coach adjoint en plus. Les prix sont nets : TVA non applicable, art. 293 B du CGI.",
            "Le paiement se fait par carte bancaire via Stripe ; EvolyFoot n’a jamais accès aux numéros de carte. L’abonnement se renouvelle automatiquement à chaque échéance. L’ajout ou le retrait d’une équipe ou d’un adjoint ajuste le montant au prorata. Une facture est envoyée par e-mail à chaque prélèvement.",
            "L’éducateur peut résilier à tout moment depuis la page Abonnement : l’accès reste ouvert jusqu’à la fin de la période déjà payée, sans remboursement de la période en cours.",
            "Droit de rétractation : l’éducateur agissant à titre personnel dispose de 14 jours après la souscription pour se rétracter, par écrit via la page contact ou à contact@evolyfoot.com. Les sommes éventuellement prélevées sont alors remboursées sous 14 jours.",
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
            "L’éducateur peut supprimer son compte à tout moment depuis son profil ou via la page contact ; la suppression met fin à l’abonnement et entraîne celle des comptes joueur/tuteur qui lui sont rattachés.",
          ],
        },
        {
          title: "Droit applicable",
          paragraphs: [
            "Les présentes conditions sont soumises au droit français. En cas de litige, le consommateur peut recourir gratuitement à un médiateur de la consommation après une réclamation écrite restée sans réponse satisfaisante.",
          ],
        },
      ]}
    />
  );
}
