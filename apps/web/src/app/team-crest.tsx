// Logo de l'équipe, ou ses initiales tant qu'aucun logo n'a été choisi.
export function TeamCrest({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const initials =
    (name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?";
  return (
    <span aria-hidden={logo ? undefined : true} className="team-crest" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`Logo ${name}`} src={logo} />
      ) : (
        initials
      )}
    </span>
  );
}
