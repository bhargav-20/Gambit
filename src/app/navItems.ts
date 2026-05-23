import type { ReactNode } from 'react';
import { Home, BookOpen, Puzzle, Swords, Microscope, Trophy, Wand2 } from 'lucide-react';
import { createElement } from 'react';

export interface NavItem {
  /** Display label in expanded rail / mobile drawer. */
  label: string;
  /** Route path; for items with detail children (openings, puzzles) this is the index path. */
  path: string;
  /** Icon component for the rail and mobile drawer. */
  icon: ReactNode;
  /** Optional short description shown in tooltips and the Home cards. */
  blurb?: string;
  /** Mark items not yet implemented so the rail can dim them and Home can
   *  show a "coming soon" treatment without scattering checks everywhere. */
  comingSoon?: boolean;
}

/** Single source of truth for the activity rail, Home cards, and the
 *  breadcrumb label in the top bar. Order is the rail order. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home',     path: '/',          icon: createElement(Home, { size: 16 }) },
  { label: 'Openings', path: '/openings',  icon: createElement(BookOpen, { size: 16 }),       blurb: 'Replay the 100+ catalogued openings, study the ideas behind each' },
  { label: 'Puzzles',  path: '/puzzles',   icon: createElement(Puzzle, { size: 16 }),         blurb: 'Solve tactics, track streaks' },
  { label: 'Play',     path: '/play',      icon: createElement(Swords, { size: 16 }),         blurb: 'Live game on the same WiFi — scan a QR, no account, no server' },
  { label: 'Setup',    path: '/setup',     icon: createElement(Wand2, { size: 16 }),          blurb: 'Build any position by hand — then send it to the engine' },
  { label: 'Analyze',  path: '/analyze',   icon: createElement(Microscope, { size: 16 }),     blurb: 'Play moves, branch the loaded game, get engine eval — your tinkering surface' },
  { label: 'Games',    path: '/games',     icon: createElement(Trophy, { size: 16 }),         blurb: 'Replay the games that shaped chess — Immortal, Opera, Game of the Century, more' },
];
