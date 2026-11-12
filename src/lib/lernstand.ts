// Lernstand pro Eintrag und Richtung, Lerntage, Export/Import.
// Die reinen Funktionen (ohne "lade"/"speichere") werden getestet.
import type { Lektion } from '../../scripts/lektionen-lib.ts';
import { lies, schreibe } from './ablage.ts';
import { ladeEinstellungen, STANDARD, type Einstellungen } from './einstellungen.ts';
import { eintragSchluessel, type Ergebnis, type Karte, type Richtung, type RichtungsWahl, type Zufall } from './runde.ts';

export interface Stand {
  /** Wie oft insgesamt als gewusst bewertet. */
  gewusst: number;
  /** Wie oft insgesamt "Nochmals". */
  nochmals: number;
  letztes: Ergebnis;
  /** ISO-Zeitstempel der letzten Bewertung. */
  zuletzt: string;
  /** Beim letzten Üben (erster Versuch in der Runde) gewusst? Fehlt bei älterem Lernstand. */
  aufAnhieb?: boolean;
  /** Reserviert für Spaced Repetition (Leitner-Fach). */
  stufe?: number;
  /** Reserviert für Spaced Repetition (JJJJ-MM-TT). */
  faelligAm?: string;
}

/** Schlüssel: "<lektionId>|<fremdsprache>#<richtung>" */
export type Lernstand = Record<string, Stand>;

export interface Daten {
  version: 1;
  lernstand: Lernstand;
  /** Tage (JJJJ-MM-TT, lokale Zeit), an denen geübt wurde. */
  lerntage: string[];
}

export interface Export extends Daten {
  app: 'voci-trainer';
  exportiertAm: string;
  einstellungen: Einstellungen;
}

const RICHTUNGEN: Richtung[] = ['fremd-de', 'de-fremd'];
const SCHLUESSEL = 'daten';

export function standSchluessel(eintrag: string, richtung: Richtung): string {
  return `${eintrag}#${richtung}`;
}

export function lokalesDatum(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function leereDaten(): Daten {
  return { version: 1, lernstand: {}, lerntage: [] };
}

/**
 * Trägt eine Bewertung ein (verändert `daten`). `ersterVersuch`: erste Bewertung der Karte in dieser Runde –
 * nur sie bestimmt, ob die Karte auf Anhieb gewusst war.
 */
export function trageEin(daten: Daten, schluessel: string, ergebnis: Ergebnis, jetzt: Date = new Date(), ersterVersuch = false): void {
  const alt = daten.lernstand[schluessel];
  daten.lernstand[schluessel] = {
    ...alt,
    gewusst: (alt?.gewusst ?? 0) + (ergebnis === 'gewusst' ? 1 : 0),
    nochmals: (alt?.nochmals ?? 0) + (ergebnis === 'nochmals' ? 1 : 0),
    letztes: ergebnis,
    zuletzt: jetzt.toISOString(),
    ...(ersterVersuch ? { aufAnhieb: ergebnis === 'gewusst' } : {}),
  };
  const tag = lokalesDatum(jetzt);
  if (!daten.lerntage.includes(tag)) {
    daten.lerntage.push(tag);
    daten.lerntage.sort();
  }
}

export interface LektionsFortschritt {
  /** Anzahl Eintrag-Richtungs-Paare, die zuletzt gewusst waren. */
  gewusst: number;
  /** Anzahl Eintrag-Richtungs-Paare, die schon einmal geübt wurden. */
  geuebt: number;
  /** Einträge × 2 Richtungen. */
  gesamt: number;
  zuletzt?: string;
}

export function lektionsFortschritt(daten: Daten, lektion: Lektion): LektionsFortschritt {
  let gewusst = 0;
  let geuebt = 0;
  let zuletzt: string | undefined;
  for (const e of lektion.eintraege) {
    const basis = eintragSchluessel(lektion.id, e.fremdsprache);
    for (const r of RICHTUNGEN) {
      const s = daten.lernstand[standSchluessel(basis, r)];
      if (!s) continue;
      geuebt++;
      if (s.letztes === 'gewusst') gewusst++;
      if (!zuletzt || s.zuletzt > zuletzt) zuletzt = s.zuletzt;
    }
  }
  return { gewusst, geuebt, gesamt: lektion.eintraege.length * RICHTUNGEN.length, zuletzt };
}

/**
 * Schwierig = beim letzten Üben nicht auf Anhieb gewusst. Bei älterem Lernstand ohne diese Angabe:
 * mindestens einmal "Nochmals".
 */
export function istSchwierig(s: Stand | undefined): boolean {
  if (!s) return false;
  if (typeof s.aufAnhieb === 'boolean') return !s.aufAnhieb;
  return s.nochmals > 0;
}

/**
 * Karten der schwierigen Einträge in den gewählten Richtungen. Bei "gemischt" kommt jeder Eintrag
 * höchstens einmal vor, in einer Richtung, in der er schwierig ist.
 */
export function schwierigeKarten(daten: Daten, lektionen: readonly Lektion[], wahl: RichtungsWahl, zufall: Zufall = Math.random): Karte[] {
  const richtungen = wahl === 'gemischt' ? RICHTUNGEN : [wahl];
  const karten: Karte[] = [];
  for (const l of lektionen) {
    for (const eintrag of l.eintraege) {
      const schluessel = eintragSchluessel(l.id, eintrag.fremdsprache);
      const schwer = richtungen.filter((r) => istSchwierig(daten.lernstand[standSchluessel(schluessel, r)]));
      if (schwer.length === 0) continue;
      const richtung = schwer[Math.floor(zufall() * schwer.length)];
      karten.push({ schluessel, lektionId: l.id, sprache: l.sprache, eintrag, richtung });
    }
  }
  return karten;
}

function tagDavor(tag: string): string {
  const [j, m, t] = tag.split('-').map(Number);
  return lokalesDatum(new Date(j, m - 1, t - 1));
}

/**
 * Lerntage in Folge. Zählt bis heute; wurde heute noch nicht geübt,
 * bleibt die Serie von gestern bestehen (der Tag ist ja noch nicht vorbei).
 */
export function lerntageInFolge(lerntage: readonly string[], heute: string = lokalesDatum()): { tage: number; heuteGeuebt: boolean } {
  const menge = new Set(lerntage);
  const heuteGeuebt = menge.has(heute);
  let tag = heuteGeuebt ? heute : tagDavor(heute);
  let tage = 0;
  while (menge.has(tag)) {
    tage++;
    tag = tagDavor(tag);
  }
  return { tage, heuteGeuebt };
}

/** Führt zwei Datenstände zusammen; pro Eintrag gewinnt die neuere Bewertung. */
export function fuehreZusammen(a: Daten, b: Daten): Daten {
  const lernstand: Lernstand = { ...a.lernstand };
  for (const [k, s] of Object.entries(b.lernstand)) {
    const alt = lernstand[k];
    if (!alt || s.zuletzt > alt.zuletzt) lernstand[k] = s;
  }
  const lerntage = [...new Set([...a.lerntage, ...b.lerntage])].sort();
  return { version: 1, lernstand, lerntage };
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Prüft eine importierte Datei. Wirft einen Error mit verständlicher Meldung. */
export function pruefeImport(roh: unknown): Export {
  const fehler = (m: string) => new Error(`Die Datei ist kein gültiges Backup: ${m}`);
  if (typeof roh !== 'object' || roh === null) throw fehler('kein JSON-Objekt.');
  const d = roh as Record<string, unknown>;
  if (d.app !== 'voci-trainer') throw fehler('stammt nicht vom Voci-Trainer.');
  if (d.version !== 1) throw fehler(`unbekannte Version ${String(d.version)}.`);
  if (typeof d.lernstand !== 'object' || d.lernstand === null || Array.isArray(d.lernstand)) throw fehler('Lernstand fehlt.');
  const lernstand: Lernstand = {};
  for (const [k, s] of Object.entries(d.lernstand as Record<string, unknown>)) {
    const st = s as Partial<Stand> | null;
    if (
      !st ||
      typeof st.gewusst !== 'number' ||
      typeof st.nochmals !== 'number' ||
      (st.letztes !== 'gewusst' && st.letztes !== 'nochmals') ||
      typeof st.zuletzt !== 'string'
    ) {
      throw fehler(`ungültiger Eintrag "${k}".`);
    }
    lernstand[k] = st as Stand;
  }
  const lerntage = Array.isArray(d.lerntage) ? d.lerntage.filter((t): t is string => typeof t === 'string' && DATUM.test(t)) : [];
  const einstellungen = { ...STANDARD, ...(typeof d.einstellungen === 'object' && d.einstellungen ? d.einstellungen : {}) } as Einstellungen;
  return {
    app: 'voci-trainer',
    version: 1,
    exportiertAm: typeof d.exportiertAm === 'string' ? d.exportiertAm : '',
    einstellungen,
    lernstand,
    lerntage,
  };
}

// ---------- Zugriff auf den gespeicherten Stand ----------

let cache: Daten | undefined;

export function ladeDaten(): Daten {
  if (!cache) {
    const d = lies<Daten>(SCHLUESSEL);
    cache = d && d.version === 1 && d.lernstand && Array.isArray(d.lerntage) ? d : leereDaten();
  }
  return cache;
}

export function speichereDaten(d: Daten): void {
  cache = d;
  schreibe(SCHLUESSEL, d);
}

export function merkeErgebnis(karte: Karte, ergebnis: Ergebnis, ersterVersuch: boolean): void {
  const d = ladeDaten();
  trageEin(d, standSchluessel(karte.schluessel, karte.richtung), ergebnis, new Date(), ersterVersuch);
  speichereDaten(d);
}

export function erstelleExport(): Export {
  return { app: 'voci-trainer', exportiertAm: new Date().toISOString(), einstellungen: ladeEinstellungen(), ...ladeDaten() };
}
