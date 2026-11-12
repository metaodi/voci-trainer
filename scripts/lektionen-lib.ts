// Reine Funktionen zum Parsen und Prüfen der Lektionen.
// Wird von der Validierung (Node), vom Vite-Plugin und von den Tests genutzt.
// Keine Node-spezifischen Imports hier, damit die Datei überall läuft.

export type Sprache = 'en' | 'fr';
export type Typ = 'wort' | 'satz';

export interface VerzeichnisEintrag {
  id: string;
  name: string;
  sprache: Sprache;
  datei: string;
  pruefung?: string;
  archiviert?: boolean;
}

export interface Eintrag {
  fremdsprache: string;
  deutsch: string;
  typ: Typ;
  notiz?: string;
}

export interface Lektion extends VerzeichnisEintrag {
  eintraege: Eintrag[];
}

export interface Fehler {
  datei: string;
  zeile?: number;
  meldung: string;
}

export const KOPFZEILE = ['fremdsprache', 'deutsch', 'typ', 'notiz'] as const;
export const SPRACHEN: readonly Sprache[] = ['en', 'fr'];
export const TYPEN: readonly Typ[] = ['wort', 'satz'];
export const ID_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Normalisiert einen Text für Vergleiche und Schlüssel (Unicode NFC, Leerraum). */
export function normalisiere(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export interface CsvZeile {
  /** 1-basierte Zeilennummer in der Datei (Beginn des Datensatzes). */
  zeile: number;
  felder: string[];
}

/**
 * Parst CSV-Text mit frei wählbarem Trennzeichen.
 * Unterstützt Anführungszeichen ("a;b", "" als Escape), BOM und \r\n.
 * Komplett leere Zeilen werden übersprungen.
 */
export function parseCsv(text: string, trenner = ';'): CsvZeile[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const zeilen: CsvZeile[] = [];
  let felder: string[] = [];
  let feld = '';
  let inQuotes = false;
  let zeilenNr = 1;
  let startZeile = 1;
  let feldHatInhalt = false;

  const zeileAbschliessen = () => {
    felder.push(feld);
    const leer = felder.length === 1 && felder[0].trim() === '' && !feldHatInhalt;
    if (!leer) zeilen.push({ zeile: startZeile, felder });
    felder = [];
    feld = '';
    feldHatInhalt = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (c === '\n') zeilenNr++;
        feld += c;
      }
      continue;
    }
    if (c === '"' && feld.trim() === '') {
      feld = '';
      inQuotes = true;
      feldHatInhalt = true;
    } else if (c === trenner) {
      felder.push(feld);
      feld = '';
    } else if (c === '\r') {
      // ignorieren, \n folgt
    } else if (c === '\n') {
      zeileAbschliessen();
      zeilenNr++;
      startZeile = zeilenNr;
    } else {
      feld += c;
    }
  }
  if (feld !== '' || felder.length > 0 || feldHatInhalt) zeileAbschliessen();
  return zeilen;
}

/** Prüft, ob ein String ein gültiges Kalenderdatum im Format JJJJ-MM-TT ist. */
export function istGueltigesDatum(wert: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(j, mo - 1, t));
  return d.getUTCFullYear() === j && d.getUTCMonth() === mo - 1 && d.getUTCDate() === t;
}

/** Parst und prüft eine Lektions-CSV. */
export function parseLektionCsv(text: string, datei: string): { eintraege: Eintrag[]; fehler: Fehler[] } {
  const fehler: Fehler[] = [];
  const eintraege: Eintrag[] = [];
  const zeilen = parseCsv(text);

  if (zeilen.length === 0) {
    fehler.push({ datei, meldung: 'Die Datei ist leer.' });
    return { eintraege, fehler };
  }

  const kopf = zeilen[0].felder.map((f) => f.trim().toLowerCase());
  const kopfOk = kopf.length === KOPFZEILE.length && KOPFZEILE.every((k, i) => kopf[i] === k);
  if (!kopfOk) {
    fehler.push({
      datei,
      zeile: zeilen[0].zeile,
      meldung: `Falsche Kopfzeile "${zeilen[0].felder.join(';')}", erwartet "${KOPFZEILE.join(';')}".`,
    });
    return { eintraege, fehler };
  }

  const gesehen = new Map<string, number>();
  for (const { zeile, felder } of zeilen.slice(1)) {
    if (felder.length < 3 || felder.length > 4) {
      fehler.push({
        datei,
        zeile,
        meldung: `Erwartet 3 oder 4 Spalten (getrennt mit ";"), gefunden: ${felder.length}.`,
      });
      continue;
    }
    const [fremd, deutsch, typRoh, notizRoh = ''] = felder.map(normalisiere);
    let ok = true;
    if (!fremd) {
      fehler.push({ datei, zeile, meldung: 'Spalte "fremdsprache" ist leer.' });
      ok = false;
    }
    if (!deutsch) {
      fehler.push({ datei, zeile, meldung: 'Spalte "deutsch" ist leer.' });
      ok = false;
    }
    const typ = typRoh.toLowerCase();
    if (!TYPEN.includes(typ as Typ)) {
      fehler.push({
        datei,
        zeile,
        meldung: `Ungültiger Typ "${typRoh}", erlaubt sind: ${TYPEN.join(', ')}.`,
      });
      ok = false;
    }
    if (fremd) {
      const vorher = gesehen.get(fremd);
      if (vorher !== undefined) {
        fehler.push({ datei, zeile, meldung: `Doppelter Eintrag "${fremd}" (schon in Zeile ${vorher}).` });
        ok = false;
      } else {
        gesehen.set(fremd, zeile);
      }
    }
    if (!ok) continue;
    const eintrag: Eintrag = { fremdsprache: fremd, deutsch, typ: typ as Typ };
    if (notizRoh) eintrag.notiz = notizRoh;
    eintraege.push(eintrag);
  }

  if (zeilen.length === 1) fehler.push({ datei, meldung: 'Die Lektion enthält keine Einträge.' });
  return { eintraege, fehler };
}

/** Prüft den Inhalt von lektionen.json (bereits als JSON geparst). */
export function pruefeVerzeichnis(daten: unknown, datei = 'lektionen.json'): { eintraege: VerzeichnisEintrag[]; fehler: Fehler[] } {
  const fehler: Fehler[] = [];
  const eintraege: VerzeichnisEintrag[] = [];
  if (!Array.isArray(daten)) {
    fehler.push({ datei, meldung: 'lektionen.json muss ein Array sein.' });
    return { eintraege, fehler };
  }
  const ids = new Set<string>();
  const dateien = new Set<string>();
  daten.forEach((roh, index) => {
    const wo = `Eintrag ${index + 1}`;
    const melde = (meldung: string) => fehler.push({ datei, meldung: `${wo}: ${meldung}` });
    if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
      melde('muss ein Objekt sein.');
      return;
    }
    const e = roh as Record<string, unknown>;
    let ok = true;
    const erlaubt = new Set(['id', 'name', 'sprache', 'datei', 'pruefung', 'archiviert']);
    for (const k of Object.keys(e)) {
      if (!erlaubt.has(k)) {
        melde(`unbekanntes Feld "${k}".`);
        ok = false;
      }
    }
    if (typeof e.id !== 'string' || !ID_MUSTER.test(e.id)) {
      melde('"id" fehlt oder ist ungültig (nur Kleinbuchstaben, Ziffern und "-").');
      ok = false;
    } else if (ids.has(e.id)) {
      melde(`doppelte id "${e.id}".`);
      ok = false;
    } else {
      ids.add(e.id);
    }
    if (typeof e.name !== 'string' || !e.name.trim()) {
      melde('"name" fehlt.');
      ok = false;
    }
    if (typeof e.sprache !== 'string' || !SPRACHEN.includes(e.sprache as Sprache)) {
      melde(`"sprache" muss ${SPRACHEN.join(' oder ')} sein.`);
      ok = false;
    }
    if (typeof e.datei !== 'string' || !/^[a-z]{2}\/[a-z0-9-]+\.csv$/.test(e.datei)) {
      melde('"datei" fehlt oder ist ungültig (z.B. "fr/unite-3.csv").');
      ok = false;
    } else {
      if (SPRACHEN.includes(e.sprache as Sprache) && !e.datei.startsWith(`${e.sprache}/`)) {
        melde(`"datei" muss im Ordner "${e.sprache}/" liegen.`);
        ok = false;
      }
      if (dateien.has(e.datei)) {
        melde(`Datei "${e.datei}" ist mehrfach eingetragen.`);
        ok = false;
      }
      dateien.add(e.datei);
    }
    if (e.pruefung !== undefined && (typeof e.pruefung !== 'string' || !istGueltigesDatum(e.pruefung))) {
      melde(`"pruefung" muss ein gültiges Datum im Format JJJJ-MM-TT sein, gefunden: ${JSON.stringify(e.pruefung)}.`);
      ok = false;
    }
    if (e.archiviert !== undefined && typeof e.archiviert !== 'boolean') {
      melde('"archiviert" muss true oder false sein.');
      ok = false;
    }
    if (ok) eintraege.push(e as unknown as VerzeichnisEintrag);
  });
  return { eintraege, fehler };
}

/**
 * Prüft alles zusammen.
 * @param verzeichnisText Inhalt von lektionen.json
 * @param csvDateien Alle CSV-Dateien unter lektionen/ (relativer Pfad mit "/" → Inhalt)
 */
export function pruefeAlles(
  verzeichnisText: string,
  csvDateien: Map<string, string>,
): { lektionen: Lektion[]; fehler: Fehler[] } {
  const fehler: Fehler[] = [];
  const lektionen: Lektion[] = [];
  let daten: unknown;
  try {
    daten = JSON.parse(verzeichnisText);
  } catch (e) {
    fehler.push({ datei: 'lektionen.json', meldung: `Kein gültiges JSON: ${(e as Error).message}` });
    return { lektionen, fehler };
  }
  const verzeichnis = pruefeVerzeichnis(daten);
  fehler.push(...verzeichnis.fehler);

  for (const v of verzeichnis.eintraege) {
    const text = csvDateien.get(v.datei);
    if (text === undefined) {
      fehler.push({ datei: 'lektionen.json', meldung: `Datei "${v.datei}" (Lektion "${v.id}") existiert nicht.` });
      continue;
    }
    const { eintraege, fehler: csvFehler } = parseLektionCsv(text, v.datei);
    fehler.push(...csvFehler);
    lektionen.push({ ...v, eintraege });
  }

  const eingetragen = new Set(
    Array.isArray(daten) ? daten.map((d) => (d as { datei?: unknown })?.datei).filter((d) => typeof d === 'string') : [],
  );
  for (const pfad of csvDateien.keys()) {
    if (!eingetragen.has(pfad)) {
      fehler.push({ datei: pfad, meldung: 'Die Datei ist nicht in lektionen.json eingetragen.' });
    }
  }
  return { lektionen, fehler };
}

export function formatiereFehler(f: Fehler): string {
  return `${f.datei}${f.zeile !== undefined ? `:${f.zeile}` : ''}: ${f.meldung}`;
}
