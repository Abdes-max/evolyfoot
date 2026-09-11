// Gabarit commun aux trois pages légales (mentions légales, confidentialité, CGU). La structure
// et les intitulés de section sont ceux attendus pour un service comme EvolyFoot ; les valeurs
// entre crochets ([Raison sociale], [SIRET]…) sont des informations que seul l'éditeur du site
// peut fournir et doivent être remplacées avant publication — voir `legal-content.ts`.
export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main>
      <section className="m-section m-hero m-legal-hero">
        <span className="m-eyebrow">Légal</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <p className="m-legal-updated">Dernière mise à jour : {updatedAt}</p>
      </section>

      <section className="m-section m-legal">
        <p className="m-legal-notice" role="note">
          Gabarit en attente de relecture juridique : les mentions entre crochets seront remplacées par les
          informations définitives d’EvolyFoot avant mise en production.
        </p>
        {sections.map((section) => (
          <article className="m-legal-block" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.title}-${index}`}>{paragraph}</p>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
