"use client";

// Choix proposé après le détourage : la même photo avec et sans fond, sur le fond de la carte
// joueur, pour voir le rendu avant d’enregistrer.
export function PhotoChoice({
  original,
  cutout,
  onChoose,
  onCancel,
}: {
  original: string;
  cutout: string;
  onChoose: (photo: string) => void;
  onCancel: () => void;
}) {
  return (
    <div aria-label="Choisir la photo" className="photo-choice" role="group">
      <p>Fond retiré automatiquement. Quelle version garder ?</p>
      <div className="photo-choice-options">
        <button className="photo-choice-option" onClick={() => onChoose(cutout)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={cutout} />
          <span>Sans fond</span>
        </button>
        <button className="photo-choice-option" onClick={() => onChoose(original)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={original} />
          <span>Avec le fond</span>
        </button>
      </div>
      <button className="photo-choice-cancel" onClick={onCancel} type="button">
        Annuler
      </button>
    </div>
  );
}
