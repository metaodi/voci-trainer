import { lies, schreibe } from './ablage.ts';
import type { Ergebnis, RichtungsWahl } from './runde.ts';

export type Darstellung = 'system' | 'hell' | 'dunkel';

export interface Einstellungen {
  /** Was ein Swipe nach links bedeutet (rechts ist das Gegenteil). */
  swipeLinks: Ergebnis;
  richtung: RichtungsWahl;
  darstellung: Darstellung;
}

export const STANDARD: Einstellungen = {
  swipeLinks: 'gewusst',
  richtung: 'fremd-de',
  darstellung: 'system',
};

const SCHLUESSEL = 'einstellungen';

export function ladeEinstellungen(): Einstellungen {
  const gespeichert = lies<Partial<Einstellungen>>(SCHLUESSEL) ?? {};
  return { ...STANDARD, ...gespeichert };
}

export function speichereEinstellungen(e: Einstellungen): void {
  schreibe(SCHLUESSEL, e);
  wendeDarstellungAn(e.darstellung);
}

export function wendeDarstellungAn(d: Darstellung): void {
  const root = document.documentElement;
  if (d === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = d;
  const dunkel = d === 'dunkel' || (d === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dunkel ? '#14131c' : '#f5f3ff');
}
