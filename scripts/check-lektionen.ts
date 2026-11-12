// npm run check-lektionen – prüft alle Lektionen und bricht bei Fehlern ab.
import { fileURLToPath } from 'node:url';
import { ladeLektionen } from './lektionen-laden.ts';
import { formatiereFehler } from './lektionen-lib.ts';

const ordner = fileURLToPath(new URL('../lektionen/', import.meta.url));
const { lektionen, fehler } = ladeLektionen(ordner);

if (fehler.length > 0) {
  console.error(`✗ ${fehler.length} Fehler in den Lektionen:\n`);
  for (const f of fehler) console.error(`  - ${formatiereFehler(f)}`);
  process.exit(1);
}

for (const l of lektionen) {
  const woerter = l.eintraege.filter((e) => e.typ === 'wort').length;
  const saetze = l.eintraege.length - woerter;
  const extra = [l.pruefung && `Prüfung ${l.pruefung}`, l.archiviert && 'archiviert'].filter(Boolean).join(', ');
  console.log(`✓ ${l.id.padEnd(16)} ${String(l.eintraege.length).padStart(3)} Einträge (${woerter} Wörter, ${saetze} Sätze)${extra ? ` – ${extra}` : ''}`);
}
console.log(`\nAlles in Ordnung: ${lektionen.length} Lektionen.`);
