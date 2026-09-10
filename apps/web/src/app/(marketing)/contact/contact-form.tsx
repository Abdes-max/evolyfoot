"use client";

import { useState, type FormEvent } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Une erreur est survenue.");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setError("Impossible d’envoyer le message. Réessaie dans un instant.");
      setStatus("error");
    }
  }

  return (
    <form className="m-form" onSubmit={submit} noValidate>
      <div className="m-field">
        <label htmlFor="contact-name">Ton nom</label>
        <input
          autoComplete="name"
          id="contact-name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <div className="m-field">
        <label htmlFor="contact-email">Adresse e-mail</label>
        <input
          autoComplete="email"
          id="contact-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div className="m-field">
        <label htmlFor="contact-message">Ton message</label>
        <textarea
          id="contact-message"
          onChange={(event) => setMessage(event.target.value)}
          required
          value={message}
        />
      </div>
      {status === "error" && (
        <p className="m-form-status is-error" role="alert">
          {error}
        </p>
      )}
      {status === "ok" && (
        <p className="m-form-status is-ok" role="status">
          Message envoyé. On te répond à l’adresse indiquée dès que possible.
        </p>
      )}
      <button className="m-btn m-btn-primary" disabled={status === "sending"} type="submit">
        {status === "sending" ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}
