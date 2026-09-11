import { ImageResponse } from "next/og";

// Image de partage par défaut pour toutes les pages du site vitrine : Next sert ce fichier sur
// /opengraph-image et l'associe automatiquement aux pages de ce segment qui ne définissent pas
// leur propre image. Générée à la volée (pas d'asset binaire à maintenir), alignée sur le thème
// sombre de la vitrine.
export const alt = "EvolyFoot — Prépare des séances qui font progresser, sans y passer tes soirées.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0e15",
          backgroundImage: "radial-gradient(900px 500px at 15% -10%, rgba(62, 198, 245, 0.22), transparent 70%)",
          color: "#f4f6f9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#3ec6f5",
              color: "#062330",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            E
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>EvolyFoot</div>
        </div>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 800, lineHeight: 1.15, letterSpacing: -2, maxWidth: 980 }}>
          Prépare des séances qui font progresser, sans y passer tes soirées.
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 26, color: "#97a3b6", maxWidth: 860 }}>
          Diagnostic, cycle de 4 semaines, séances et suivi — pour les éducateurs de football U10–U13.
        </div>
      </div>
    ),
    { ...size },
  );
}
