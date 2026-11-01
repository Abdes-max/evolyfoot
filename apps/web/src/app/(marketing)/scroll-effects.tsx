"use client";

import { useEffect } from "react";

function animateCount(element: HTMLElement) {
  const target = Number(element.dataset.count);
  const duration = 900;
  const start = performance.now();

  function step(now: number) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

// Tout le contenu est rendu visible côté serveur : ces effets ne s'ajoutent qu'une fois le
// JavaScript chargé, et seulement pour ce qui est encore sous la ligne de flottaison. Sans JS ou
// avec « réduire les animations », la page reste complète et immobile.
export function ScrollEffects() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const element = entry.target as HTMLElement;
          element.classList.remove("m-reveal-pending");
          if (element.dataset.count) {
            animateCount(element);
          }
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const belowFold = (element: Element) => element.getBoundingClientRect().top > window.innerHeight * 0.92;
    document.querySelectorAll(".m-reveal").forEach((element) => {
      if (belowFold(element)) {
        element.classList.add("m-reveal-pending");
        observer.observe(element);
      }
    });
    document.querySelectorAll("[data-count]").forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return null;
}
