// Startseite: Lektionen nach Sprache, Fortschritt, Prüfungs-Countdown, Auswahl.
import { lektionen } from 'virtual:lektionen';
import type { Lektion, Sprache } from '../../scripts/lektionen-lib.ts';
import { ladeEinstellungen, speichereEinstellungen } from '../lib/einstellungen.ts';
import { ladeDaten, lektionsFortschritt, lerntageInFolge, lokalesDatum } from '../lib/lernstand.ts';
import type { RichtungsWahl } from '../lib/runde.ts';
import { h, icon } from '../ui/dom.ts';
import { geheZu, starteSitzung, zustand } from '../zustand.ts';

const SPRACHNAME: Record<Sprache, string> = { en: 'Englisch', fr: 'Französisch' };
const KURZ: Record<Sprache, string> = { en: 'EN', fr: 'FR' };

/** Tage von heute bis zum Datum (lokal), negativ = vorbei. */
export function tageBis(datum: string, heute: string = lokalesDatum()): number {
  const [a, b] = [datum, heute].map((s) => {
    const [j, m, t] = s.split('-').map(Number);
    return Date.UTC(j, m - 1, t);
  });
  return Math.round((a - b) / 86_400_000);
}

export function pruefungsText(tage: number): string | null {
  if (tage < 0) return null;
  if (tage === 0) return 'Prüfung heute';
  if (tage === 1) return 'Prüfung morgen';
  return `Prüfung in ${tage} Tagen`;
}

function sortiere(liste: Lektion[]): Lektion[] {
  const mitPruefung = liste
    .filter((l) => l.pruefung && tageBis(l.pruefung) >= 0)
    .sort((a, b) => a.pruefung!.localeCompare(b.pruefung!));
  // Ohne anstehende Prüfung: neueste (zuletzt eingetragene) zuerst
  const rest = liste.filter((l) => !mitPruefung.includes(l)).reverse();
  return [...mitPruefung, ...rest];
}

export function startScreen(root: HTMLElement): void {
  const daten = ladeDaten();
  const einst = ladeEinstellungen();
  const auswahl = zustand.auswahl;
  // Nicht mehr vorhandene Lektionen aus der Auswahl entfernen
  for (const id of [...auswahl]) if (!lektionen.some((l) => l.id === id)) auswahl.delete(id);

  const leiste = h('div', { class: 'start-leiste' });

  function lektionsKarte(l: Lektion): HTMLElement {
    const f = lektionsFortschritt(daten, l);
    const prozent = f.gesamt ? Math.round((f.gewusst / f.gesamt) * 100) : 0;
    const tage = l.pruefung ? tageBis(l.pruefung) : -1;
    const pruefung = pruefungsText(tage);
    const knopf = h(
      'button',
      {
        class: `lektion ${l.sprache}`,
        type: 'button',
        'aria-pressed': String(auswahl.has(l.id)),
        onclick: () => {
          if (auswahl.has(l.id)) auswahl.delete(l.id);
          else auswahl.add(l.id);
          knopf.setAttribute('aria-pressed', String(auswahl.has(l.id)));
          zeichneLeiste();
        },
      },
      h('span', { class: 'lektion-kopf' }, h('span', { class: 'lektion-name' }, l.name), h('span', { class: 'auswahl-kreis', 'aria-hidden': 'true' }, icon('haken'))),
      h(
        'span',
        { class: 'lektion-meta' },
        `${l.eintraege.length} Einträge`,
        pruefung && h('span', { class: `pruefung${tage <= 3 ? ' bald' : ''}` }, icon('kalender'), pruefung),
      ),
      h(
        'span',
        { class: 'lektion-fortschritt' },
        h('span', { class: 'balken klein' }, h('span', { class: 'balken-fuellung', style: `width:${prozent}%` })),
        h('span', { class: 'prozent' }, f.geuebt === 0 ? 'neu' : `${prozent} %`),
      ),
    );
    knopf.setAttribute('aria-label', `${l.name}, ${SPRACHNAME[l.sprache]}, ${prozent} Prozent gewusst${pruefung ? ', ' + pruefung : ''}`);
    return h('li', {}, knopf);
  }

  function gruppe(sprache: Sprache, liste: Lektion[]): HTMLElement | null {
    if (liste.length === 0) return null;
    return h(
      'section',
      { class: 'sprach-gruppe' },
      h('h2', {}, h('span', { class: `sprach-punkt ${sprache}` }, KURZ[sprache]), SPRACHNAME[sprache]),
      h('ul', { class: 'lektionen' }, sortiere(liste).map(lektionsKarte)),
    );
  }

  const aktiv = lektionen.filter((l) => !l.archiviert);
  const archiv = lektionen.filter((l) => l.archiviert);
  const sprachen: Sprache[] = ['en', 'fr'];

  const serie = lerntageInFolge(daten.lerntage);

  root.append(
    h(
      'main',
      { class: 'start' },
      h(
        'header',
        { class: 'kopf' },
        h('h1', {}, 'Voci-Trainer'),
        serie.tage > 0 &&
          h(
            'span',
            { class: `serie${serie.heuteGeuebt ? ' heute' : ''}`, title: serie.heuteGeuebt ? 'Heute schon geübt' : 'Heute noch nicht geübt' },
            icon('flamme'),
            `${serie.tage} ${serie.tage === 1 ? 'Tag' : 'Tage'}`,
          ),
        h('button', { class: 'rund-knopf', type: 'button', 'aria-label': 'Einstellungen', onclick: () => geheZu('#/einstellungen') }, icon('zahnrad')),
      ),
      aktiv.length === 0 && h('p', { class: 'leer' }, 'Noch keine Lektionen vorhanden.'),
      aktiv.length > 0 && h('p', { class: 'einleitung' }, 'Wähle eine oder mehrere Lektionen aus.'),
      sprachen.map((s) => gruppe(s, aktiv.filter((l) => l.sprache === s))),
      archiv.length > 0 &&
        h(
          'details',
          { class: 'archiv' },
          h('summary', {}, `Archiv (${archiv.length})`),
          sprachen.map((s) => gruppe(s, archiv.filter((l) => l.sprache === s))),
        ),
    ),
    leiste,
  );

  function zeichneLeiste() {
    const gewaehlt = lektionen.filter((l) => auswahl.has(l.id));
    leiste.classList.toggle('sichtbar', gewaehlt.length > 0);
    document.body.classList.toggle('mit-leiste', gewaehlt.length > 0);
    if (gewaehlt.length === 0) {
      leiste.replaceChildren();
      return;
    }
    const sprachenGewaehlt = new Set(gewaehlt.map((l) => l.sprache));
    const fremd = sprachenGewaehlt.size === 1 ? SPRACHNAME[gewaehlt[0].sprache] : 'Fremdsprache';
    const optionen: [RichtungsWahl, string][] = [
      ['fremd-de', `${fremd} → Deutsch`],
      ['de-fremd', `Deutsch → ${fremd}`],
      ['gemischt', 'Gemischt'],
    ];
    const anzahl = gewaehlt.reduce((n, l) => n + l.eintraege.length, 0);
    leiste.replaceChildren(
      h(
        'div',
        { class: 'segmente', role: 'radiogroup', 'aria-label': 'Richtung' },
        optionen.map(([wert, text]) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(einst.richtung === wert),
              onclick: () => {
                einst.richtung = wert;
                speichereEinstellungen(einst);
                zeichneLeiste();
              },
            },
            text,
          ),
        ),
      ),
      h(
        'button',
        {
          class: 'haupt-knopf',
          type: 'button',
          onclick: () => starteSitzung(gewaehlt.map((l) => l.id), einst.richtung),
        },
        `Los geht's · ${anzahl} Karten`,
      ),
    );
  }
  zeichneLeiste();
}
