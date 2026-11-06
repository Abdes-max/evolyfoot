import type { Metadata } from "next";
import Link from "next/link";
import { StoreBadges, type StoreApp } from "../store-badges";

export const metadata: Metadata = {
  title: "Télécharger EvolyFoot — EvolyFoot",
  description:
    "EvolyFoot s’utilise depuis le navigateur, et sur iOS et Android avec EvolyFoot Coach pour l’éducateur et EvolyFoot Player pour les joueurs et leurs parents.",
};

const apps: { app: StoreApp; eyebrow: string; title: string; text: string }[] = [
  {
    app: "coach",
    eyebrow: "Pour l’éducateur",
    title: "EvolyFoot Coach",
    text: "La séance du jour et le mode terrain, la composition du match, les convocations et les réponses de l’équipe (présents, absents, sans réponse). Même compte et mêmes données que l’application web.",
  },
  {
    app: "player",
    eyebrow: "Pour les joueurs et les parents",
    title: "EvolyFoot Player",
    text: "Sur invitation du coach : le calendrier, la réponse présent ou absent aux convocations, les messages, la carte joueur et les progrès. Un parent peut suivre plusieurs enfants.",
  },
];

export default function TelechargerPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Télécharger</span>
        <h1>Sur le web, et dans ta poche.</h1>
        <p>Prépare sur ordinateur, retrouve tout au bord du terrain : la même équipe et les mêmes données sur le web, iOS et Android.</p>
      </section>

      <section className="m-section m-prose" style={{ paddingTop: 0 }}>
        {apps.map((item) => (
          <article className="m-prose-block" key={item.app}>
            <span className="m-eyebrow">{item.eyebrow}</span>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <StoreBadges app={item.app} />
          </article>
        ))}
        <article className="m-prose-block">
          <span className="m-eyebrow">Sans rien installer</span>
          <h2>L’application web</h2>
          <p>
            Crée ton compte et prépare ta première séance depuis n’importe quel navigateur — ordinateur, tablette ou téléphone. L’interface s’adapte à l’écran.
          </p>
          <div className="m-hero-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
            <Link className="m-btn m-btn-primary" href="/inscription">
              Ouvrir l’application web
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
