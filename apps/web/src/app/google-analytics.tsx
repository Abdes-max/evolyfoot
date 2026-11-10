import Script from "next/script";

// Identifiant de mesure du flux web « EvolyFoot Web » : public par nature (visible dans le code de toute page qui l'utilise).
const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID ?? "G-RXKRL99GHF";

// Google Analytics, en production seulement : pas de mesure sur le poste de développement ni dans les tests.
export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}');`}
      </Script>
    </>
  );
}
