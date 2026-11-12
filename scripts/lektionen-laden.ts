// Liest die Lektionen vom Dateisystem (nur Node).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pruefeAlles, type Fehler, type Lektion } from './lektionen-lib.ts';

function alleCsv(ordner: string, basis = ordner): string[] {
  const ergebnis: string[] = [];
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) ergebnis.push(...alleCsv(pfad, basis));
    else if (eintrag.name.toLowerCase().endsWith('.csv')) ergebnis.push(relative(basis, pfad).split(sep).join('/'));
  }
  return ergebnis;
}

export function ladeLektionen(ordner: string): { lektionen: Lektion[]; fehler: Fehler[] } {
  const verzeichnisPfad = join(ordner, 'lektionen.json');
  if (!existsSync(verzeichnisPfad)) {
    return { lektionen: [], fehler: [{ datei: 'lektionen.json', meldung: 'Datei fehlt.' }] };
  }
  const csv = new Map<string, string>();
  for (const pfad of alleCsv(ordner)) csv.set(pfad, readFileSync(join(ordner, pfad), 'utf8'));
  return pruefeAlles(readFileSync(verzeichnisPfad, 'utf8'), csv);
}
