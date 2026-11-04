"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountPrivacy } from "../account-privacy";
import { addTeam, listTeams, reloadAt, switchTeam, teamChoiceLabel, type TeamChoice } from "../team-switch";

interface StaffMember {
  id: string;
  displayName: string;
  email: string;
}

function TeamsPanel() {
  const [teams, setTeams] = useState<TeamChoice[]>([]);
  // Suppression en deux temps : le premier clic demande confirmation.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listTeams().then((loaded) => {
      if (!cancelled) {
        setTeams(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function add() {
    setError("");
    setError((await addTeam()) ?? "");
  }

  async function open(team: TeamChoice) {
    setError("");
    if (!(await switchTeam(team.id))) {
      setError("L’équipe n’a pas pu être ouverte.");
    }
  }

  async function remove(team: TeamChoice) {
    setError("");
    if (confirmingId !== team.id) {
      setConfirmingId(team.id);
      return;
    }
    setConfirmingId(null);
    const response = await fetch(`/api/teams/${team.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setError("L’équipe n’a pas pu être supprimée.");
      return;
    }
    if (team.active) {
      reloadAt("/app");
      return;
    }
    setTeams(await listTeams());
  }

  return (
    <div className="profil-block">
      <section aria-labelledby="teams-title" className="staff-panel">
        <h3 id="teams-title">Mes équipes</h3>
        <p>Chaque équipe a son effectif, ses séances, ses matchs et son staff. Change d’équipe ici ou depuis le menu.</p>
        <ul>
          {teams.map((team) => (
            <li key={team.id}>
              <span>
                <strong>{teamChoiceLabel(team)}</strong>
                <small>{team.active ? "Équipe affichée" : team.primary ? "Première équipe" : "Équipe ajoutée"}</small>
              </span>
              {!team.active && (
                <button className="profil-ghost" onClick={() => open(team)} type="button">
                  Ouvrir
                </button>
              )}
              {!team.primary && (
                <button aria-label={`Supprimer ${teamChoiceLabel(team)}`} className="profil-ghost" onClick={() => remove(team)} type="button">
                  {confirmingId === team.id ? "Confirmer la suppression" : "Supprimer"}
                </button>
              )}
            </li>
          ))}
        </ul>
        {confirmingId && <p className="profil-error">Son effectif, ses séances, ses matchs et son staff seront supprimés définitivement.</p>}
        <button className="profil-primary" onClick={add} type="button">
          Ajouter une équipe
        </button>
        {error && (
          <p className="profil-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function StaffPanel() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/staff").catch(() => null);
    const body = await response?.json().catch(() => null);
    setMembers(body?.members ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/staff").catch(() => null);
      const body = await response?.json().catch(() => null);
      if (!cancelled) {
        setMembers(body?.members ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function invite() {
    setError("");
    setCopied(false);
    const response = await fetch("/api/staff", { method: "POST" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.url) {
      setInviteUrl(body.url);
    } else {
      setError(typeof body?.error === "string" ? body.error : "Le lien n’a pas pu être créé.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // Le champ reste sélectionnable à la main.
    }
  }

  async function remove(member: StaffMember) {
    setError("");
    const response = await fetch(`/api/staff/${member.id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) {
      await load();
    } else {
      setError("L’adjoint n’a pas pu être retiré.");
    }
  }

  return (
    <div className="profil-block">
      <section aria-labelledby="staff-title" className="staff-panel">
        <h3 id="staff-title">Mon staff</h3>
        <p>
          Tes adjoints ont leur propre compte. Ils préparent les séances et les matchs et évaluent les joueurs de l’équipe affichée : chaque équipe a son propre
          staff.
        </p>
        {members.length > 0 && (
          <ul>
            {members.map((member) => (
              <li key={member.id}>
                <span>
                  <strong>{member.displayName}</strong>
                  <small>{member.email}</small>
                </span>
                <button aria-label={`Retirer ${member.displayName}`} className="profil-ghost" onClick={() => remove(member)} type="button">
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
        {inviteUrl ? (
          <div className="staff-invite">
            <input aria-label="Lien d’invitation adjoint" readOnly value={inviteUrl} />
            <button className="profil-ghost" onClick={copy} type="button">
              {copied ? "Copié" : "Copier"}
            </button>
            <small>Valable 7 jours, pour une seule personne. Il donne accès à toute ton équipe.</small>
          </div>
        ) : (
          <button className="profil-primary" onClick={invite} type="button">
            Inviter un adjoint
          </button>
        )}
        {error && (
          <p className="profil-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

// Blocs du bas du profil, selon le type de compte : un adjoint ne gère pas le staff et sa
// suppression n'emporte que son propre accès.
export function ProfileAccountBlocks() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/auth/session").catch(() => null);
      const body = await response?.json().catch(() => null);
      if (!cancelled) {
        setRole(body?.role ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!role) {
    return null;
  }

  return (
    <>
      {role === "coach" && <TeamsPanel />}
      {role === "coach" && <StaffPanel />}
      <div className="profil-block">
        <AccountPrivacy
          warning={
            role === "assistant"
              ? "Cette action est définitive : ton accès sera supprimé. L’équipe reste chez l’éducateur."
              : "Cette action est définitive : tes équipes, tes joueurs, tes séances, tes matchs et les comptes liés seront supprimés."
          }
        />
      </div>
    </>
  );
}
