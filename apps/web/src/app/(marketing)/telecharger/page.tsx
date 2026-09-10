import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Télécharger EvolyFoot — EvolyFoot",
  description:
    "EvolyFoot s’utilise dès maintenant depuis le navigateur, sur ordinateur comme sur téléphone. Les applications mobiles iOS et Android sont en préparation.",
};

const blocks = [
  {
    eyebrow: "Disponible",
    title: "L’application web",
    text: "Rien à installer. Crée ton compte et prépare ta première séance depuis n’importe quel navigateur — ordinateur, tablette ou téléphone. L’interface s’adapte à l’écran et fonctionne aussi au bord du terrain.",
    href: "/inscription",
    cta: "Ouvrir l’application web",
    primary: true,
  },
  {
    eyebrow: "En préparation",
    title: "iOS et Android",
    text: "Des applications natives, avec accès hors-ligne aux séances du jour, sont en cours de développement sur la base d’Expo. Les liens vers l’App Store et Google Play seront publiés ici dès qu’elles seront prêtes.",
    href: "/contact",
    cta: "Être prévenu du lancement",
    primary: false,
  },
];

export default function TelechargerPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Télécharger</span>
        <h1>Commence dans le navigateur, l’app mobile arrive.</h1>
        <p>
          Tout EvolyFoot est déjà accessible en ligne. Les versions iOS et Android suivront, sans changer ta façon de
          travailler ni tes données.
        </p>
      </section>

      <section className="m-section m-prose" style={{ paddingTop: 0 }}>
        {blocks.map((block) => (
          <article className="m-prose-block" key={block.title}>
            <span className="m-eyebrow">{block.eyebrow}</span>
            <h2>{block.title}</h2>
            <p>{block.text}</p>
            <div className="m-hero-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
              <Link className={block.primary ? "m-btn m-btn-primary" : "m-btn m-btn-ghost"} href={block.href}>
                {block.cta}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
