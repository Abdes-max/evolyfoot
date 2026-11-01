"use client";

// Le PDF passe par l'impression du navigateur, qui propose « Enregistrer au format PDF ».
export function PrintButton({ label }: { label: string }) {
  return (
    <button className="session-print" onClick={() => window.print()} type="button">
      {label}
    </button>
  );
}
