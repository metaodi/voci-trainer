import { describe, expect, it } from 'vitest';
import type { Lektion } from '../scripts/lektionen-lib.ts';
import {
  fuehreZusammen,
  leereDaten,
  lektionsFortschritt,
  lerntageInFolge,
  pruefeImport,
  standSchluessel,
  istSchwierig,
  schwierigeKarten,
  trageEin,
} from '../src/lib/lernstand.ts';
import { eintragSchluessel } from '../src/lib/runde.ts';

const lektion: Lektion = {
  id: 'fr-1',
  name: 'Unité 1',
  sprache: 'fr',
  datei: 'fr/unite-1.csv',
  eintraege: [
    { fremdsprache: 'le chien', deutsch: 'der Hund', typ: 'wort' },
    { fremdsprache: 'le chat', deutsch: 'die Katze', typ: 'wort' },
  ],
};
const hund = eintragSchluessel('fr-1', 'le chien');

describe('trageEin', () => {
  it('zählt Bewertungen und merkt das letzte Ergebnis', () => {
    const d = leereDaten();
    const k = standSchluessel(hund, 'fremd-de');
    trageEin(d, k, 'nochmals', new Date(2026, 10, 12, 10));
    trageEin(d, k, 'gewusst', new Date(2026, 10, 12, 11));
    expect(d.lernstand[k]).toMatchObject({ gewusst: 1, nochmals: 1, letztes: 'gewusst' });
    expect(d.lerntage).toEqual(['2026-11-12']);
  });

  it('behält reservierte Felder für Spaced Repetition', () => {
    const d = leereDaten();
    const k = standSchluessel(hund, 'fremd-de');
    d.lernstand[k] = { gewusst: 1, nochmals: 0, letztes: 'gewusst', zuletzt: '2026-01-01T00:00:00Z', stufe: 2, faelligAm: '2026-01-05' };
    trageEin(d, k, 'gewusst');
    expect(d.lernstand[k]).toMatchObject({ gewusst: 2, stufe: 2, faelligAm: '2026-01-05' });
  });
});

describe('schwierige Karten', () => {
  const katze = eintragSchluessel('fr-1', 'le chat');

  it('merkt sich, ob eine Karte beim letzten Üben auf Anhieb gewusst war', () => {
    const d = leereDaten();
    const k = standSchluessel(hund, 'fremd-de');
    // Runde 1: zuerst nochmals, dann gewusst → schwierig
    trageEin(d, k, 'nochmals', new Date(), true);
    trageEin(d, k, 'gewusst', new Date(), false);
    expect(d.lernstand[k].letztes).toBe('gewusst');
    expect(istSchwierig(d.lernstand[k])).toBe(true);
    // Runde 2: auf Anhieb gewusst → nicht mehr schwierig
    trageEin(d, k, 'gewusst', new Date(), true);
    expect(istSchwierig(d.lernstand[k])).toBe(false);
  });

  it('nimmt bei älterem Lernstand ohne Angabe "mindestens einmal nochmals"', () => {
    expect(istSchwierig({ gewusst: 2, nochmals: 1, letztes: 'gewusst', zuletzt: '' })).toBe(true);
    expect(istSchwierig({ gewusst: 2, nochmals: 0, letztes: 'gewusst', zuletzt: '' })).toBe(false);
    expect(istSchwierig(undefined)).toBe(false);
  });

  it('liefert nur schwierige Einträge in der gewählten Richtung', () => {
    const d = leereDaten();
    trageEin(d, standSchluessel(hund, 'de-fremd'), 'nochmals', new Date(), true);
    trageEin(d, standSchluessel(katze, 'fremd-de'), 'gewusst', new Date(), true);
    expect(schwierigeKarten(d, [lektion], 'fremd-de')).toEqual([]);
    const karten = schwierigeKarten(d, [lektion], 'de-fremd');
    expect(karten.map((k) => [k.eintrag.fremdsprache, k.richtung])).toEqual([['le chien', 'de-fremd']]);
  });

  it('nimmt bei "gemischt" jeden Eintrag nur einmal, in einer schwierigen Richtung', () => {
    const d = leereDaten();
    trageEin(d, standSchluessel(hund, 'fremd-de'), 'nochmals', new Date(), true);
    trageEin(d, standSchluessel(hund, 'de-fremd'), 'nochmals', new Date(), true);
    trageEin(d, standSchluessel(katze, 'de-fremd'), 'nochmals', new Date(), true);
    const karten = schwierigeKarten(d, [lektion], 'gemischt', () => 0.99);
    expect(karten.map((k) => [k.eintrag.fremdsprache, k.richtung])).toEqual([
      ['le chien', 'de-fremd'],
      ['le chat', 'de-fremd'],
    ]);
    expect(karten[0].schluessel).toBe(hund);
  });
});

describe('lektionsFortschritt', () => {
  it('zählt beide Richtungen, "gewusst" nur beim letzten Ergebnis', () => {
    const d = leereDaten();
    trageEin(d, standSchluessel(hund, 'fremd-de'), 'gewusst');
    trageEin(d, standSchluessel(hund, 'de-fremd'), 'nochmals');
    expect(lektionsFortschritt(d, lektion)).toMatchObject({ gewusst: 1, geuebt: 2, gesamt: 4 });
  });

  it('bleibt erhalten, wenn sich die Reihenfolge im CSV ändert', () => {
    const d = leereDaten();
    trageEin(d, standSchluessel(hund, 'fremd-de'), 'gewusst');
    const umgestellt = { ...lektion, eintraege: [...lektion.eintraege].reverse() };
    expect(lektionsFortschritt(d, umgestellt).gewusst).toBe(1);
  });
});

describe('lerntageInFolge', () => {
  it('zählt zusammenhängende Tage bis heute', () => {
    expect(lerntageInFolge(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-12')).toEqual({ tage: 3, heuteGeuebt: true });
  });

  it('lässt die Serie von gestern bestehen, solange heute noch nicht geübt wurde', () => {
    expect(lerntageInFolge(['2026-11-10', '2026-11-11'], '2026-11-12')).toEqual({ tage: 2, heuteGeuebt: false });
  });

  it('beginnt nach einer Lücke von vorne', () => {
    expect(lerntageInFolge(['2026-11-08', '2026-11-10'], '2026-11-12').tage).toBe(0);
  });

  it('funktioniert über Monats- und Jahresgrenzen', () => {
    expect(lerntageInFolge(['2026-12-31', '2027-01-01'], '2027-01-01').tage).toBe(2);
    expect(lerntageInFolge(['2026-02-28', '2026-03-01'], '2026-03-01').tage).toBe(2);
  });
});

describe('Export/Import', () => {
  it('führt zusammen, die neuere Bewertung gewinnt', () => {
    const a = leereDaten();
    const b = leereDaten();
    const k = standSchluessel(hund, 'fremd-de');
    trageEin(a, k, 'gewusst', new Date('2026-11-01T10:00:00Z'));
    trageEin(b, k, 'nochmals', new Date('2026-11-05T10:00:00Z'));
    trageEin(b, standSchluessel(hund, 'de-fremd'), 'gewusst', new Date('2026-11-05T10:00:00Z'));
    const z = fuehreZusammen(a, b);
    expect(z.lernstand[k].letztes).toBe('nochmals');
    expect(Object.keys(z.lernstand)).toHaveLength(2);
    expect(fuehreZusammen(b, a).lernstand[k].letztes).toBe('nochmals');
    expect(z.lerntage).toHaveLength(2);
  });

  it('akzeptiert ein gültiges Backup', () => {
    const d = leereDaten();
    trageEin(d, standSchluessel(hund, 'fremd-de'), 'gewusst');
    const backup = JSON.parse(JSON.stringify({ app: 'voci-trainer', exportiertAm: '2026-11-12T10:00:00Z', einstellungen: { swipeLinks: 'nochmals' }, ...d }));
    const r = pruefeImport(backup);
    expect(r.lernstand).toEqual(d.lernstand);
    expect(r.einstellungen.swipeLinks).toBe('nochmals');
    expect(r.einstellungen.darstellung).toBe('system');
  });

  it.each([
    [null, /kein JSON-Objekt/],
    [{ app: 'andere-app', version: 1, lernstand: {} }, /Voci-Trainer/],
    [{ app: 'voci-trainer', version: 2, lernstand: {} }, /Version/],
    [{ app: 'voci-trainer', version: 1 }, /Lernstand fehlt/],
    [{ app: 'voci-trainer', version: 1, lernstand: { x: { gewusst: 'viel' } } }, /ungültiger Eintrag/],
  ])('lehnt ungültige Backups ab (%j)', (roh, muster) => {
    expect(() => pruefeImport(roh)).toThrow(muster);
  });
});
