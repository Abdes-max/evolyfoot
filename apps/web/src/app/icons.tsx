import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 13.3 10.2 15.5 15 10.7" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

export function BallIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2 15.5 10.7 14.2 14.8h-4.4L8.5 10.7Z" />
      <path d="M12 8.2V4.3" />
      <path d="M15.5 10.7 19 8.6" />
      <path d="M14.2 14.8 15.6 19" />
      <path d="M9.8 14.8 8.4 19" />
      <path d="M8.5 10.7 5 8.6" />
    </svg>
  );
}

export function DotsGridIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M3 20v-1.3A4.7 4.7 0 0 1 7.7 14h2.6A4.7 4.7 0 0 1 15 18.7V20" />
      <path d="M16 8.3a3 3 0 1 1 0 5.9" />
      <path d="M21 20v-1.3a4.2 4.2 0 0 0-3-4" />
    </svg>
  );
}
