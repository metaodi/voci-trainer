import { describe, expect, it } from 'vitest';
import type { Lektion } from '../scripts/lektionen-lib.ts';
import {
  aktuelleKarte,
  bewerte,
  eintragSchluessel,
  erstelleKarten,
  fortschritt,
  istFertig,
  neueRunde,
  schwierigste,
  sterne,
  type Karte,
} from '../src/lib/runde.ts';

/** Deterministischer Zufallsgenerator für reproduzierbare Tests. */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

const lektion: Lektion = {
  id: 'en-unit-1',
  name: 'Unit 1',
  sprache: 'en',
  datei: 'en/unit-1.csv',
  eintraege: Array.from({ length: 10 }, (_, i) => ({ fremdsprache: `word ${i}`, deutsch: `Wort ${i}`, typ: 'wort' as const })),
};

function karten(n = 10): Karte[] {
  return erstelleKarten([{ ...lektion, eintraege: lektion.eintraege.slice(0, n) }], 'fremd-de');
}

describe('eintragSchluessel', () => {
  it('ist stabil gegenüber Leerraum und Unicode-Form', () => {
    expect(eintragSchluessel('fr-1', ' l’école ')).toBe(eintragSchluessel('fr-1', 'l’école'));
  });
});

describe('erstelleKarten', () => {
  it('setzt die gewählte Richtung', () => {
    expect(new Set(erstelleKarten([lektion], 'de-fremd').map((k) => k.richtung))).toEqual(new Set(['de-fremd']));
  });

  it('mischt die Richtungen bei "gemischt"', () => {
    const r = new Set(erstelleKarten([lektion], 'gemischt', seeded()).map((k) => k.richtung));
    expect(r).toEqual(new Set(['fremd-de', 'de-fremd']));
  });
});

describe('Runde', () => {
  it('mischt die Reihenfolge, enthält aber alle Karten', () => {
    const r = neueRunde(karten(), seeded());
    expect(r.karten.map((k) => k.eintrag.fremdsprache)).not.toEqual(lektion.eintraege.map((e) => e.fremdsprache));
    expect(new Set(r.karten.map((k) => k.schluessel)).size).toBe(10);
  });

  it('ist fertig, wenn alle Karten gewusst sind', () => {
    const r = neueRunde(karten(3), seeded());
    expect(fortschritt(r)).toEqual({ gewusst: 0, gesamt: 3 });
    bewerte(r, 'gewusst');
    bewerte(r, 'gewusst');
    expect(istFertig(r)).toBe(false);
    bewerte(r, 'gewusst');
    expect(istFertig(r)).toBe(true);
    expect(fortschritt(r)).toEqual({ gewusst: 3, gesamt: 3 });
    expect(aktuelleKarte(r)).toBeUndefined();
  });

  it('reiht "Nochmals"-Karten 3–6 Karten später wieder ein', () => {
    for (let seed = 1; seed < 50; seed++) {
      const zufall = seeded(seed);
      const r = neueRunde(karten(10), zufall);
      const erste = aktuelleKarte(r)!;
      bewerte(r, 'nochmals', zufall);
      const pos = r.warteschlange.findIndex((i) => r.karten[i] === erste);
      expect(pos).toBeGreaterThanOrEqual(3);
      expect(pos).toBeLessThanOrEqual(6);
      expect(r.warteschlange).toHaveLength(10);
    }
  });

  it('reiht ans Ende ein, wenn nur noch wenige Karten übrig sind', () => {
    const r = neueRunde(karten(3), seeded());
    const erste = aktuelleKarte(r)!;
    bewerte(r, 'nochmals', () => 0.99);
    expect(r.karten[r.warteschlange[2]]).toBe(erste);
  });

  it('zeigt die letzte Karte so lange, bis sie gewusst ist', () => {
    const r = neueRunde(karten(1));
    bewerte(r, 'nochmals');
    bewerte(r, 'nochmals');
    expect(istFertig(r)).toBe(false);
    bewerte(r, 'gewusst');
    expect(istFertig(r)).toBe(true);
    expect(r.nochmals).toEqual([2]);
  });

  it('endet immer, auch wenn oft "Nochmals" gewählt wird', () => {
    const zufall = seeded(7);
    const r = neueRunde(karten(10), zufall);
    let schritte = 0;
    while (!istFertig(r) && schritte < 1000) {
      bewerte(r, zufall() < 0.4 ? 'nochmals' : 'gewusst', zufall);
      schritte++;
    }
    expect(istFertig(r)).toBe(true);
    expect(fortschritt(r).gewusst).toBe(10);
  });

  it('listet die schwierigsten Karten absteigend', () => {
    const r = neueRunde(karten(4), seeded());
    const [a, b] = [r.karten[r.warteschlange[0]], r.karten[r.warteschlange[1]]];
    bewerte(r, 'nochmals', () => 0); // a
    bewerte(r, 'nochmals', () => 0); // b
    // die übrigen Karten gewusst, bis a wieder vorne ist
    while (aktuelleKarte(r) !== a) bewerte(r, 'gewusst');
    bewerte(r, 'nochmals', () => 0);
    expect(schwierigste(r).map((x) => [x.karte, x.nochmals])).toEqual([
      [a, 2],
      [b, 1],
    ]);
  });

  it('vergibt Sterne nach Anteil beim ersten Versuch', () => {
    const r = neueRunde(karten(10));
    expect(sterne(r)).toBe(3);
    r.nochmals = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(sterne(r)).toBe(3);
    r.nochmals = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
    expect(sterne(r)).toBe(2);
    r.nochmals = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
    expect(sterne(r)).toBe(1);
  });
});
