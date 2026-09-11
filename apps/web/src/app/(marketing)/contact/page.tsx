import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Nous contacter — EvolyFoot",
  description:
    "Une question sur EvolyFoot, un bug, une idée de fonctionnalité ? Écris-nous, chaque retour d’éducateur oriente la suite.",
};

export default function ContactPage() {
  return (
    <main>
      <section className="m-section m-hero">
        <span className="m-eyebrow">Contact</span>
        <h1>Dis-nous ce qui te serait utile.</h1>
        <p>
          Question, bug, idée de fonctionnalité, retour du terrain : tout arrive dans la même boîte et sert vraiment à
          décider la suite. Tu peux aussi écrire directement à contact@evolyfoot.com.
        </p>
        <ContactForm />
      </section>
    </main>
  );
}
