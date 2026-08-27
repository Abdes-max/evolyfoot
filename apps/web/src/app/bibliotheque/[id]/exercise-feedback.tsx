"use client";

import { useState } from "react";

type Feedback = "pending" | "liked" | "disliked";

export function ExerciseFeedback() {
  const [feedback, setFeedback] = useState<Feedback>("pending");

  const status = feedback === "liked" ? "Merci, c’est noté." : feedback === "disliked" ? "Merci, on en tient compte." : "";

  return (
    <div className="exercise-feedback">
      <p>Cet exercice t’a-t-il plu&nbsp;?</p>
      <div className="exercise-feedback-thumbs">
        <button aria-pressed={feedback === "liked"} className={feedback === "liked" ? "active" : ""} onClick={() => setFeedback("liked")} type="button">
          <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
            <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
            <path d="M7 11l3.5-7a2 2 0 0 1 2 2v4h5.2a2 2 0 0 1 2 2.4l-1.4 6A2 2 0 0 1 16.3 20H10a3 3 0 0 1-3-3" />
          </svg>
          <span className="visually-hidden">Cet exercice m’a plu</span>
        </button>
        <button aria-pressed={feedback === "disliked"} className={feedback === "disliked" ? "active" : ""} onClick={() => setFeedback("disliked")} type="button">
          <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
            <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1Z" />
            <path d="M17 13l-3.5 7a2 2 0 0 1-2-2v-4H6.3a2 2 0 0 1-2-2.4l1.4-6A2 2 0 0 1 7.7 4H14a3 3 0 0 1 3 3" />
          </svg>
          <span className="visually-hidden">Cet exercice ne m’a pas plu</span>
        </button>
      </div>
      <p aria-live="polite" className="exercise-feedback-status" role="status">{status}</p>
    </div>
  );
}
