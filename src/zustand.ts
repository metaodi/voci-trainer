// Gemeinsamer Zustand der App (nur im Speicher) und Navigation.
import { lektionen } from 'virtual:lektionen';
import type { Lektion } from '../scripts/lektionen-lib.ts';
import { erstelleKarten, neueRunde, type Karte, type RichtungsWahl, type Runde } from './lib/runde.ts';

export interface Sitzung {
  lektionIds: string[];
  wahl: RichtungsWahl;
  runde: Runde;
  /** true, wenn die Runde nur aus den schwierigen Karten besteht. */
  nurSchwierige: boolean;
}

export const zustand: {
  sitzung?: Sitzung;
  auswahl: Set<string>;
} = {
  auswahl: new Set(),
};

export type Route = '#/' | '#/ueben' | '#/fertig' | '#/einstellungen';

export function geheZu(route: Route, ersetzen = false): void {
  if (location.hash === route) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (ersetzen) {
    location.replace(route);
  } else {
    location.hash = route;
  }
}

export function lektionNachId(id: string): Lektion | undefined {
  return lektionen.find((l) => l.id === id);
}

/** Startet eine Runde mit allen Karten der Lektionen – oder nur mit den übergebenen (z.B. den schwierigen). */
export function starteSitzung(lektionIds: string[], wahl: RichtungsWahl, nurKarten?: Karte[]): void {
  const gewaehlt = lektionIds.map(lektionNachId).filter((l): l is Lektion => l !== undefined);
  zustand.sitzung = {
    lektionIds,
    wahl,
    runde: neueRunde(nurKarten ?? erstelleKarten(gewaehlt, wahl)),
    nurSchwierige: nurKarten !== undefined,
  };
  geheZu('#/ueben');
}

export function starteMitKarten(karten: Karte[], nurSchwierige: boolean): void {
  const alt = zustand.sitzung;
  if (!alt) return;
  zustand.sitzung = { ...alt, runde: neueRunde(karten), nurSchwierige };
  geheZu('#/ueben', true);
}
