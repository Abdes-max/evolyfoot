import { colors } from "@evolyfoot/design-tokens";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Icônes au trait de l’appli Coach (mêmes tracés que apps/web/src/app/icons.tsx) : onglets du bas,
// lieu, date, heure, composition.
interface IconProps {
  size?: number;
  color?: string;
}

function Icon({ size = 20, color = colors.muted, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg fill="none" height={size} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24" width={size}>
      {children}
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 11.5 12 4l8 7.5" />
      <Path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect height="15" rx="2" width="16" x="4" y="5.5" />
      <Path d="M4 10h16" />
      <Path d="M8.5 3.5v4" />
      <Path d="M15.5 3.5v4" />
    </Icon>
  );
}

export function BallIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="m12 7.5 3.4 2.5-1.3 4h-4.2l-1.3-4Z" />
      <Path d="M12 3.5v4M15.4 10l4.6-1.2M14.1 14l2.7 4.2M9.9 14l-2.7 4.2M8.6 10 4 8.8" />
    </Icon>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4.5 3.5V17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <Path d="M8 10h8" />
      <Path d="M8 13h5" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="9" cy="8" r="3.3" />
      <Path d="M3 20v-1.3A4.7 4.7 0 0 1 7.7 14h2.6A4.7 4.7 0 0 1 15 18.7V20" />
      <Path d="M16 8.3a3 3 0 1 1 0 5.9" />
      <Path d="M21 20v-1.3a4.2 4.2 0 0 0-3-4" />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <Circle cx="12" cy="10" r="2.4" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

// Composition : un terrain avec trois joueurs.
export function LineupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect height="17" rx="2" width="14" x="5" y="3.5" />
      <Path d="M5 12h14" />
      <Circle cx="12" cy="7.5" r="1.2" />
      <Circle cx="8.8" cy="16" r="1.2" />
      <Circle cx="15.2" cy="16" r="1.2" />
    </Icon>
  );
}
