import nodemailer, { type Transporter } from "nodemailer";

// Un seul transport SMTP pour toute l'appli, construit une fois (pas à chaque envoi) :
// - En prod (VPS, voir docker-compose.yml) : relais SMTP Brevo (SMTP_HOST/PORT/USER/PASSWORD
//   fournis par les variables d'environnement du déploiement).
// - En local : Mailhog (`docker run -d --name evolyfoot-mailhog -p 1025:1025 -p 8025:8025
//   mailhog/mailhog`, interface web sur http://localhost:8025), qui n'exige aucune
//   authentification -- d'où `auth` posé seulement quand SMTP_USER/SMTP_PASSWORD sont fournis
//   (un objet `auth` avec des identifiants vides ferait échouer la négociation SMTP AUTH contre
//   un relais qui ne la supporte pas).
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    // `||` plutôt que `??` sur ces quatre lectures : une variable d'environnement présente mais
    // vide (cas réel en déploiement Docker Compose -- une variable hôte non définie substituée à
    // une chaîne vide reste tout de même déclarée dans le conteneur) doit retomber sur la valeur
    // par défaut, pas être traitée comme "1025" via `Number("")` (= 0) ou un hôte vide.
    const port = Number(process.env.SMTP_PORT || 1025);
    const user = process.env.SMTP_USER || undefined;
    const pass = process.env.SMTP_PASSWORD || undefined;
    transporter = nodemailer.createTransport({
      // "127.0.0.1" plutôt que "localhost" par défaut : sur certaines machines "localhost"
      // résout en IPv6, injoignable même quand la boucle IPv4 fonctionne (vu en pratique avec
      // Mailhog).
      host: process.env.SMTP_HOST || "127.0.0.1",
      port,
      // 465 = TLS implicite (SMTPS) ; les autres ports (587, 25, 1025) utilisent STARTTLS, que
      // nodemailer négocie seul quand `secure` est à false.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// N'échoue jamais bruyamment côté appelant : un envoi raté ne doit pas casser le flux qui l'a
// déclenché (inscription, invitation…), seulement être journalisé. `log` est injecté comme pour
// les autres handlers de ce dossier (voir errorResponse ailleurs) plutôt qu'un console.error en
// dur, pour rester testable.
export async function sendMail(input: MailInput, log: (error: unknown) => void = console.error): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || "EvolyFoot <no-reply@evolyfoot.com>",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (error) {
    log(error);
  }
}

// Gabarit unique (un seul e-mail transactionnel existe pour l'instant) : thème sombre aligné sur
// la vitrine, mais en HTML e-mail simple (tableaux/styles en ligne uniquement -- pas de flexbox
// ni de variables CSS, peu fiables dans les clients mail).
export function renderVerificationEmail(displayName: string, verifyUrl: string): { subject: string; html: string; text: string } {
  const subject = "Confirme ton adresse e-mail — EvolyFoot";
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:32px 16px;background:#0a0e15;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#151d2b;border:1px solid #232c3c;border-radius:16px;">
      <tr>
        <td style="padding:32px 28px;color:#f4f6f9;">
          <div style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:9px;background:#3ec6f5;color:#062330;font-weight:bold;font-size:16px;">E</div>
          <span style="font-weight:bold;font-size:18px;margin-left:8px;">EvolyFoot</span>
          <h1 style="font-size:20px;margin:24px 0 12px;">Bonjour ${displayName},</h1>
          <p style="font-size:14px;line-height:1.6;color:#97a3b6;margin:0 0 24px;">
            Confirme ton adresse e-mail pour finaliser la création de ton compte EvolyFoot. Ce lien est valable 48 heures.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#3ec6f5;color:#062330;text-decoration:none;font-weight:bold;font-size:14px;">
            Confirmer mon e-mail
          </a>
          <p style="font-size:12px;line-height:1.6;color:#97a3b6;margin:24px 0 0;">
            Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur : ${verifyUrl}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `Bonjour ${displayName},\n\nConfirme ton adresse e-mail pour finaliser la création de ton compte EvolyFoot (lien valable 48 heures) :\n${verifyUrl}`;
  return { subject, html, text };
}
