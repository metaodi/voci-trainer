// Logik einer Übungsrunde (rein, ohne DOM – wird getestet).
import { normalisiere, type Eintrag, type Lektion, type Sprache } from '../../scripts/lektionen-lib.ts';

/** fremd-de: Fremdsprache wird gezeigt, Deutsch ist die Antwort. */
export type Richtung = 'fremd-de' | 'de-fremd';
export type RichtungsWahl = Richtung | 'gemischt';
export type Ergebnis = 'gewusst' | 'nochmals';
export type Zufall = () => number;

export interface Karte {
  /** Stabiler Schlüssel des Eintrags: Lektions-ID + Fremdsprachentext. */
  schluessel: string;
  lektionId: string;
  sprache: Sprache;
  eintrag: Eintrag;
  richtung: Richtung;
}

export interface Runde {
  karten: Karte[];
  /** Indizes in `karten`; vorne ist die aktuelle Karte. */
  warteschlange: number[];
  /** Wie oft jede Karte in dieser Runde mit "Nochmals" bewertet wurde. */
  nochmals: number[];
  erledigt: boolean[];
}

/** Abstand, mit dem eine "Nochmals"-Karte wieder auftaucht (Anzahl Karten dazwischen). */
export const ABSTAND_MIN = 3;
export const ABSTAND_MAX = 6;

export function eintragSchluessel(lektionId: string, fremdsprache: string): string {
  return `${lektionId}|${normalisiere(fremdsprache)}`;
}

export function mische<T>(liste: readonly T[], zufall: Zufall = Math.random): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function erstelleKarten(lektionen: readonly Lektion[], wahl: RichtungsWahl, zufall: Zufall = Math.random): Karte[] {
  const karten: Karte[] = [];
  for (const l of lektionen) {
    for (const eintrag of l.eintraege) {
      const richtung: Richtung = wahl === 'gemischt' ? (zufall() < 0.5 ? 'fremd-de' : 'de-fremd') : wahl;
      karten.push({
        schluessel: eintragSchluessel(l.id, eintrag.fremdsprache),
        lektionId: l.id,
        sprache: l.sprache,
        eintrag,
        richtung,
      });
    }
  }
  return karten;
}

export function neueRunde(karten: readonly Karte[], zufall: Zufall = Math.random): Runde {
  const gemischt = mische(karten, zufall);
  return {
    karten: gemischt,
    warteschlange: gemischt.map((_, i) => i),
    nochmals: gemischt.map(() => 0),
    erledigt: gemischt.map(() => false),
  };
}

export function aktuelleKarte(r: Runde): Karte | undefined {
  const i = r.warteschlange[0];
  return i === undefined ? undefined : r.karten[i];
}

export function istFertig(r: Runde): boolean {
  return r.warteschlange.length === 0;
}

/**
 * Bewertet die aktuelle Karte. "Nochmals"-Karten werden einige Karten später
 * wieder eingereiht (oder ans Ende, wenn weniger übrig sind), bis sie gewusst sind.
 */
export function bewerte(r: Runde, ergebnis: Ergebnis, zufall: Zufall = Math.random): void {
  const i = r.warteschlange.shift();
  if (i === undefined) return;
  if (ergebnis === 'gewusst') {
    r.erledigt[i] = true;
    return;
  }
  r.nochmals[i]++;
  const abstand = ABSTAND_MIN + Math.floor(zufall() * (ABSTAND_MAX - ABSTAND_MIN + 1));
  const position = Math.min(abstand, r.warteschlange.length);
  r.warteschlange.splice(position, 0, i);
}

export function fortschritt(r: Runde): { gewusst: number; gesamt: number } {
  return { gewusst: r.erledigt.filter(Boolean).length, gesamt: r.karten.length };
}

/** Karten, die mindestens einmal "Nochmals" waren – die schwierigsten zuerst. */
export function schwierigste(r: Runde): { karte: Karte; nochmals: number }[] {
  return r.karten
    .map((karte, i) => ({ karte, nochmals: r.nochmals[i] }))
    .filter((x) => x.nochmals > 0)
    .sort((a, b) => b.nochmals - a.nochmals);
}

/** 1–3 Sterne je nach Anteil der Karten, die beim ersten Versuch gewusst waren. */
export function sterne(r: Runde): 1 | 2 | 3 {
  if (r.karten.length === 0) return 3;
  const anteil = r.nochmals.filter((n) => n === 0).length / r.karten.length;
  if (anteil >= 0.9) return 3;
  if (anteil >= 0.6) return 2;
  return 1;
}
