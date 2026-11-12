// Vite-Plugin: macht die Lektionen als virtuelles Modul "virtual:lektionen" verfügbar.
// Beim Build und im Dev-Server wird alles validiert; Fehler brechen den Build ab.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
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
