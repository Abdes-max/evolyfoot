// Plan de l'adresse dans le détail d'un événement (match ou séance) -- embed Google Maps public,
// sans clé d'API (juste `output=embed`), comme demandé pour reproduire l'exemple fourni.
export function MapEmbed({ address }: { address: string }) {
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
  return (
    <div className="map-embed">
      <iframe loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={src} title={`Plan : ${address}`} />
    </div>
  );
}
