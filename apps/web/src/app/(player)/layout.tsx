import { PlayerTabBar } from "./player-tab-bar";

export default function PlayerSpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PlayerTabBar />
    </>
  );
}
