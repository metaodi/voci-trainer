// Vite-Plugin: macht die Lektionen als virtuelles Modul "virtual:lektionen" verfügbar.
// Beim Build und im Dev-Server wird alles validiert; Fehler brechen den Build ab.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { ladeLektionen } from './scripts/lektionen-laden.ts';
import { formatiereFehler } from './scripts/lektionen-lib.ts';

const VIRTUELL = 'virtual:lektionen';
const AUFGELOEST = '\0' + VIRTUELL;

export function lektionenPlugin(ordner = resolve(import.meta.dirname, 'lektionen')): Plugin {
  let server: ViteDevServer | undefined;

  return {
    name: 'voci-lektionen',
    resolveId(id) {
      if (id === VIRTUELL) return AUFGELOEST;
    },
    load(id) {
      if (id !== AUFGELOEST) return;
      const { lektionen, fehler } = ladeLektionen(ordner);
      if (fehler.length > 0) {
        throw new Error(`Fehler in den Lektionen:\n${fehler.map((f) => '  - ' + formatiereFehler(f)).join('\n')}`);
      }
      const json = JSON.stringify(lektionen);
      const version = createHash('sha256').update(json).digest('hex').slice(0, 12);
      return `export const lektionen = ${json};\nexport const datenVersion = ${JSON.stringify(version)};\n`;
    },
    configureServer(s) {
      server = s;
      s.watcher.add(ordner);
      const neuLaden = (pfad: string) => {
        if (!resolve(pfad).startsWith(ordner)) return;
        const mod = server?.moduleGraph.getModuleById(AUFGELOEST);
        if (mod) server?.moduleGraph.invalidateModule(mod);
        server?.ws.send({ type: 'full-reload' });
      };
      s.watcher.on('change', neuLaden);
      s.watcher.on('add', neuLaden);
      s.watcher.on('unlink', neuLaden);
    },
  };
}

/**
 * Erzeugt nach dem Build dist/sw.js aus src/sw-vorlage.js: mit der Liste aller
 * Dateien (zum Vorab-Cachen) und einer Version, die sich bei jeder Änderung ändert.
 */
export function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'voci-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const dateien = alleDateien(outDir)
        .filter((f) => f !== 'sw.js')
        .sort();
      const hash = createHash('sha256');
      for (const f of dateien) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const vorlage = readFileSync(resolve(import.meta.dirname, 'src/sw-vorlage.js'), 'utf8');
      const sw = vorlage
        .replace("const VERSION = '__VERSION__';", `const VERSION = ${JSON.stringify(version)};`)
        .replace('const DATEIEN = __DATEIEN__;', `const DATEIEN = ${JSON.stringify(['./', ...dateien])};`);
      if (sw.includes('__VERSION__') || sw.includes('__DATEIEN__')) {
        throw new Error('Service Worker: Platzhalter in src/sw-vorlage.js nicht gefunden.');
      }
      writeFileSync(join(outDir, 'sw.js'), sw);
      console.log(`Service Worker: ${dateien.length} Dateien, Version ${version}`);
    },
  };
}

function alleDateien(ordner: string, basis = ordner): string[] {
  const ergebnis: string[] = [];
  for (const e of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) ergebnis.push(...alleDateien(pfad, basis));
    else ergebnis.push(relative(basis, pfad).split(sep).join('/'));
  }
  return ergebnis;
}
