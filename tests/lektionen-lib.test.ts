import { describe, expect, it } from 'vitest';
import {
  istGueltigesDatum,
  normalisiere,
  parseCsv,
  parseLektionCsv,
  pruefeAlles,
  pruefeVerzeichnis,
} from '../scripts/lektionen-lib.ts';

const KOPF = 'fremdsprache;deutsch;typ;notiz\n';

describe('parseCsv', () => {
  it('trennt mit Semikolon und lässt Kommas stehen', () => {
    const z = parseCsv('a;b, c;d\n');
    expect(z).toEqual([{ zeile: 1, felder: ['a', 'b, c', 'd'] }]);
  });

  it('entfernt BOM und versteht \\r\\n', () => {
    const z = parseCsv('﻿a;b\r\nc;d\r\n');
    expect(z.map((r) => r.felder)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('überspringt leere Zeilen und zählt Zeilennummern korrekt', () => {
    const z = parseCsv('a;b\n\n\nc;d');
    expect(z).toEqual([
      { zeile: 1, felder: ['a', 'b'] },
      { zeile: 4, felder: ['c', 'd'] },
    ]);
  });

  it('versteht Anführungszeichen mit Trennzeichen, Zeilenumbruch und "" als Escape', () => {
    const z = parseCsv('"a;b";"er sagt ""hi""";"x\ny"\nz;w');
    expect(z[0].felder).toEqual(['a;b', 'er sagt "hi"', 'x\ny']);
    expect(z[1]).toEqual({ zeile: 3, felder: ['z', 'w'] });
  });

  it('behält leere Felder am Ende', () => {
    expect(parseCsv('a;b;c;\n')[0].felder).toEqual(['a', 'b', 'c', '']);
  });

  it('lässt Apostrophe in Wörtern unverändert', () => {
    expect(parseCsv("l'école;die Schule")[0].felder[0]).toBe("l'école");
  });
});

describe('normalisiere', () => {
  it('vereinheitlicht Unicode und Leerraum', () => {
    const zerlegt = 'école'; // e + kombinierender Akut
    expect(normalisiere(`  ${zerlegt}   du  `)).toBe('école du');
  });
});

describe('istGueltigesDatum', () => {
  it.each([
    ['2026-11-20', true],
    ['2024-02-29', true],
    ['2025-02-29', false],
    ['2026-13-01', false],
    ['20.11.2026', false],
    ['2026-1-5', false],
  ])('%s → %s', (wert, erwartet) => {
    expect(istGueltigesDatum(wert)).toBe(erwartet);
  });
});

describe('parseLektionCsv', () => {
  it('liest gültige Einträge mit optionaler Notiz', () => {
    const { eintraege, fehler } = parseLektionCsv(`${KOPF}the dog;der Hund;wort;\nHi!;Hallo!;satz;informell\nthe cat;die Katze;wort`, 't.csv');
    expect(fehler).toEqual([]);
    expect(eintraege).toEqual([
      { fremdsprache: 'the dog', deutsch: 'der Hund', typ: 'wort' },
      { fremdsprache: 'Hi!', deutsch: 'Hallo!', typ: 'satz', notiz: 'informell' },
      { fremdsprache: 'the cat', deutsch: 'die Katze', typ: 'wort' },
    ]);
  });

  it('meldet falsche Kopfzeile', () => {
    const { fehler } = parseLektionCsv('englisch;deutsch;typ;notiz\na;b;wort;', 't.csv');
    expect(fehler).toHaveLength(1);
    expect(fehler[0].meldung).toMatch(/Kopfzeile/);
  });

  it('meldet leere Pflichtfelder, ungültigen Typ und falsche Spaltenzahl mit Zeilennummer', () => {
    const { eintraege, fehler } = parseLektionCsv(`${KOPF};der Hund;wort;\nthe cat;;wort;\nhi;hallo;phrase;\nnur;zwei`, 't.csv');
    expect(eintraege).toEqual([]);
    expect(fehler.map((f) => [f.zeile, f.meldung])).toEqual([
      [2, 'Spalte "fremdsprache" ist leer.'],
      [3, 'Spalte "deutsch" ist leer.'],
      [4, expect.stringMatching(/Ungültiger Typ "phrase"/)],
      [5, expect.stringMatching(/3 oder 4 Spalten/)],
    ]);
  });

  it('meldet Duplikate (auch mit abweichendem Leerraum)', () => {
    const { fehler } = parseLektionCsv(`${KOPF}the dog;der Hund;wort;\nthe  dog ;der Hund;wort;`, 't.csv');
    expect(fehler).toEqual([{ datei: 't.csv', zeile: 3, meldung: 'Doppelter Eintrag "the dog" (schon in Zeile 2).' }]);
  });

  it('meldet Lektionen ohne Einträge', () => {
    expect(parseLektionCsv(KOPF, 't.csv').fehler[0].meldung).toMatch(/keine Einträge/);
  });
});

describe('pruefeVerzeichnis', () => {
  const gut = { id: 'fr-unite-3', name: 'Unité 3', sprache: 'fr', datei: 'fr/unite-3.csv' };

  it('akzeptiert gültige Einträge', () => {
    const r = pruefeVerzeichnis([gut, { ...gut, id: 'x', datei: 'fr/x.csv', pruefung: '2026-12-01', archiviert: true }]);
    expect(r.fehler).toEqual([]);
    expect(r.eintraege).toHaveLength(2);
  });

  it.each([
    [{ ...gut, sprache: 'de' }, /sprache/],
    [{ ...gut, id: 'Unité 3' }, /"id"/],
    [{ ...gut, pruefung: '2026-02-30' }, /pruefung/],
    [{ ...gut, pruefung: '20.11.2026' }, /pruefung/],
    [{ ...gut, datei: 'en/unite-3.csv' }, /Ordner "fr\/"/],
    [{ ...gut, archiviert: 'ja' }, /archiviert/],
    [{ ...gut, extra: 1 }, /unbekanntes Feld/],
    [{ ...gut, name: '' }, /name/],
  ])('meldet Fehler für %j', (eintrag, muster) => {
    const r = pruefeVerzeichnis([eintrag]);
    expect(r.fehler).toHaveLength(1);
    expect(r.fehler[0].meldung).toMatch(muster);
  });

  it('meldet doppelte ids', () => {
    const r = pruefeVerzeichnis([gut, { ...gut, datei: 'fr/b.csv' }]);
    expect(r.fehler[0].meldung).toMatch(/doppelte id/);
  });

  it('verlangt ein Array', () => {
    expect(pruefeVerzeichnis({}).fehler[0].meldung).toMatch(/Array/);
  });
});

describe('pruefeAlles', () => {
  const verzeichnis = JSON.stringify([{ id: 'en-1', name: 'Unit 1', sprache: 'en', datei: 'en/unit-1.csv' }]);

  it('verbindet Verzeichnis und CSV', () => {
    const r = pruefeAlles(verzeichnis, new Map([['en/unit-1.csv', `${KOPF}a;b;wort;`]]));
    expect(r.fehler).toEqual([]);
    expect(r.lektionen[0]).toMatchObject({ id: 'en-1', eintraege: [{ fremdsprache: 'a' }] });
  });

  it('meldet fehlende Dateien', () => {
    const r = pruefeAlles(verzeichnis, new Map());
    expect(r.fehler[0].meldung).toMatch(/existiert nicht/);
  });

  it('meldet CSV-Dateien, die nicht eingetragen sind', () => {
    const r = pruefeAlles(verzeichnis, new Map([['en/unit-1.csv', `${KOPF}a;b;wort;`], ['en/unit-2.csv', KOPF]]));
    expect(r.fehler).toEqual([{ datei: 'en/unit-2.csv', meldung: 'Die Datei ist nicht in lektionen.json eingetragen.' }]);
  });

  it('meldet ungültiges JSON', () => {
    expect(pruefeAlles('[', new Map()).fehler[0].meldung).toMatch(/JSON/);
  });
});
