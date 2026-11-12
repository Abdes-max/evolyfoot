import type { ReactNode } from "react";

// Section repliable, comme dans l'app Coach : titre et résumé toujours visibles, contenu au clic.
// Repliée par défaut.
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="collapsible-section" open={defaultOpen}>
      <summary>
        <span className="collapsible-section-head">
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        <span aria-hidden="true" className="collapsible-section-chevron">
          ▸
        </span>
      </summary>
      <div className="collapsible-section-body">{children}</div>
    </details>
  );
}
