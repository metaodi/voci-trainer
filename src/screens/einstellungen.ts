// Einstellungen, Backup (Export/Import) und Zurücksetzen.
import { datenVersion } from 'virtual:lektionen';
import { ladeEinstellungen, speichereEinstellungen, type Einstellungen } from '../lib/einstellungen.ts';
import { erstelleExport, fuehreZusammen, ladeDaten, leereDaten, lokalesDatum, pruefeImport, speichereDaten, type Export } from '../lib/lernstand.ts';
import { h, icon } from '../ui/dom.ts';
import { geheZu } from '../zustand.ts';

function segmente<T extends string>(label: string, optionen: [T, string][], wert: T, onWahl: (w: T) => void): HTMLElement {
  const gruppe = h('div', { class: 'segmente', role: 'radiogroup', 'aria-label': label });
  const zeichne = (aktuell: T) =>
    gruppe.replaceChildren(
      ...optionen.map(([w, text]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(w === aktuell),
            onclick: () => {
              onWahl(w);
              zeichne(w);
            },
          },
          text,
        ),
      ),
    );
  zeichne(wert);
  return gruppe;
}

function herunterladen(dateiname: string, inhalt: string): void {
  const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
  const a = h('a', { href: url, download: dateiname });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function einstellungenScreen(root: HTMLElement): void {
  const einst: Einstellungen = ladeEinstellungen();
  const aendere = <K extends keyof Einstellungen>(k: K, v: Einstellungen[K]) => {
    einst[k] = v;
    speichereEinstellungen(einst);
  };

  const meldung = h('div', { class: 'meldung', role: 'status', 'aria-live': 'polite' });
  const zeigeMeldung = (text: string, art: 'ok' | 'fehler' = 'ok') => {
    meldung.className = `meldung ${art}`;
    meldung.textContent = text;
  };

  const importBox = h('div', { class: 'import-box' });
  const dateiFeld = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'versteckt',
    onchange: async () => {
      const datei = dateiFeld.files?.[0];
      dateiFeld.value = '';
      if (!datei) return;
      try {
        const backup = pruefeImport(JSON.parse(await datei.text()));
        zeigeImportFrage(backup);
      } catch (e) {
        importBox.replaceChildren();
        zeigeMeldung(e instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : (e as Error).message, 'fehler');
      }
    },
  });

  function zeigeImportFrage(backup: Export) {
    const anzahl = Object.keys(backup.lernstand).length;
    const datum = backup.exportiertAm ? new Date(backup.exportiertAm).toLocaleDateString('de-CH') : 'unbekannt';
    const fertig = (text: string) => {
      importBox.replaceChildren();
      zeigeMeldung(text);
    };
    zeigeMeldung('');
    importBox.replaceChildren(
      h('p', {}, `Backup vom ${datum} mit ${anzahl} gespeicherten Antworten.`),
      h(
        'div',
        { class: 'knopf-reihe' },
        h(
          'button',
          {
            class: 'haupt-knopf',
            type: 'button',
            onclick: () => {
              speichereDaten(fuehreZusammen(ladeDaten(), backup));
              fertig('Backup wurde mit dem aktuellen Lernstand zusammengeführt.');
            },
          },
          'Zusammenführen',
        ),
        h(
          'button',
          {
            class: 'zweit-knopf',
            type: 'button',
            onclick: () => {
              speichereDaten({ version: 1, lernstand: backup.lernstand, lerntage: backup.lerntage });
              speichereEinstellungen(backup.einstellungen);
              fertig('Lernstand und Einstellungen wurden aus dem Backup ersetzt.');
              setTimeout(() => geheZu('#/einstellungen'), 50);
            },
          },
          'Ersetzen',
        ),
        h('button', { class: 'text-knopf', type: 'button', onclick: () => importBox.replaceChildren() }, 'Abbrechen'),
      ),
    );
  }

  const anzahlAntworten = Object.keys(ladeDaten().lernstand).length;

  root.append(
    h(
      'main',
      { class: 'einstellungen' },
      h(
        'header',
        { class: 'kopf' },
        h('button', { class: 'rund-knopf', type: 'button', 'aria-label': 'Zurück', onclick: () => geheZu('#/') }, icon('zurueck')),
        h('h1', {}, 'Einstellungen'),
      ),
      h(
        'section',
        { class: 'block' },
        h('h2', {}, 'Wischen'),
        h('p', { class: 'erklaerung' }, 'Was bedeutet es, wenn du eine Karte nach links wischst?'),
        segmente(
          'Nach links wischen',
          [
            ['gewusst', '← Gewusst'],
            ['nochmals', '← Nochmals'],
          ],
          einst.swipeLinks,
          (w) => aendere('swipeLinks', w),
        ),
      ),
      h(
        'section',
        { class: 'block' },
        h('h2', {}, 'Darstellung'),
        segmente(
          'Darstellung',
          [
            ['system', 'Automatisch'],
            ['hell', 'Hell'],
            ['dunkel', 'Dunkel'],
          ],
          einst.darstellung,
          (w) => aendere('darstellung', w),
        ),
      ),
      h(
        'section',
        { class: 'block' },
        h('h2', {}, 'Lernstand sichern'),
        h(
          'p',
          { class: 'erklaerung' },
          'Der Lernstand ist nur auf diesem Gerät gespeichert. Mit einem Backup kannst du ihn sichern oder auf ein anderes Gerät übertragen.',
        ),
        h(
          'div',
          { class: 'knopf-reihe' },
          h(
            'button',
            {
              class: 'zweit-knopf',
              type: 'button',
              onclick: () => {
                herunterladen(`voci-trainer-backup-${lokalesDatum()}.json`, JSON.stringify(erstelleExport(), null, 2));
                zeigeMeldung('Backup wurde gespeichert.');
              },
            },
            'Backup speichern',
          ),
          h('button', { class: 'zweit-knopf', type: 'button', onclick: () => dateiFeld.click() }, 'Backup laden'),
          dateiFeld,
        ),
        importBox,
        meldung,
      ),
      h(
        'section',
        { class: 'block' },
        h('h2', {}, 'Neu beginnen'),
        h('p', { class: 'erklaerung' }, `Gespeicherte Antworten: ${anzahlAntworten}`),
        h(
          'button',
          {
            class: 'text-knopf gefahr',
            type: 'button',
            onclick: () => {
              if (confirm('Den ganzen Lernstand und die Lerntage löschen? Das kann nicht rückgängig gemacht werden.')) {
                speichereDaten(leereDaten());
                geheZu('#/');
              }
            },
          },
          'Lernstand zurücksetzen',
        ),
      ),
      h('p', { class: 'version' }, `Datenstand ${datenVersion}`),
    ),
  );
}
