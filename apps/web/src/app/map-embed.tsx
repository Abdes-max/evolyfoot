// Plan de l'adresse dans le détail d'un événement (match ou séance) -- embed Google Maps public,
// sans clé d'API (juste `output=embed`), comme demandé pour reproduire l'exemple fourni.
export function MapEmbed({ address, compact = false }: { address: string; compact?: boolean }) {
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
  return (
    <div className={compact ? "map-embed compact" : "map-embed"}>
      <iframe loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={src} title={`Plan : ${address}`} />
    </div>
  );
}
