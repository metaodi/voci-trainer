// Zusammenfassung am Ende einer Runde.
import { fortschritt, istFertig, schwierigste, sterne } from '../lib/runde.ts';
import { h, icon } from '../ui/dom.ts';
import { geheZu, starteMitKarten, zustand } from '../zustand.ts';

const TITEL = { 3: 'Super gemacht!', 2: 'Gut gemacht!', 1: 'Geschafft!' } as const;
const TEXT = {
  3: 'Fast alles auf Anhieb gewusst.',
  2: 'Du kennst schon viele Wörter.',
  1: 'Dranbleiben lohnt sich – jede Runde hilft.',
} as const;

export function fertigScreen(root: HTMLElement): void {
  const sitzung = zustand.sitzung;
  if (!sitzung || !istFertig(sitzung.runde)) {
    geheZu('#/', true);
    return;
  }
  const r = sitzung.runde;
  const anzahlSterne = sterne(r);
  const schwer = schwierigste(r);
  const { gesamt } = fortschritt(r);
  const aufAnhieb = gesamt - schwer.length;

  root.append(
    h(
      'main',
      { class: 'fertig' },
      h(
        'div',
        { class: 'sterne', role: 'img', 'aria-label': `${anzahlSterne} von 3 Sternen` },
        [1, 2, 3].map((i) => h('span', { class: `stern${i <= anzahlSterne ? ' voll' : ''}`, style: `--i:${i}` }, icon('stern'))),
      ),
      h('h1', {}, TITEL[anzahlSterne]),
      h('p', { class: 'fertig-text' }, TEXT[anzahlSterne]),
      h('p', { class: 'statistik' }, h('strong', {}, String(aufAnhieb)), ` von ${gesamt} ${gesamt === 1 ? 'Karte' : 'Karten'} auf Anhieb gewusst`),
      schwer.length > 0 &&
        h(
          'section',
          { class: 'schwierige' },
          h('h2', {}, 'Diese waren knifflig'),
          h(
            'ul',
            {},
            schwer.slice(0, 12).map(({ karte, nochmals }) =>
              h(
                'li',
                {},
                h('span', { class: 'fremd', lang: karte.sprache }, karte.eintrag.fremdsprache),
                h('span', { class: 'deutsch' }, karte.eintrag.deutsch),
                h('span', { class: 'anzahl', title: `${nochmals}× nochmals` }, `${nochmals}×`),
              ),
            ),
          ),
          schwer.length > 12 && h('p', { class: 'mehr' }, `… und ${schwer.length - 12} weitere`),
        ),
      h(
        'div',
        { class: 'fertig-knoepfe' },
        schwer.length > 0 &&
          h(
            'button',
            { class: 'haupt-knopf', type: 'button', onclick: () => starteMitKarten(schwer.map((s) => s.karte), true) },
            `Nur die schwierigen nochmals (${schwer.length})`,
          ),
        h(
          'button',
          { class: schwer.length > 0 ? 'zweit-knopf' : 'haupt-knopf', type: 'button', onclick: () => starteMitKarten(r.karten, false) },
          'Alles nochmals',
        ),
        h('button', { class: 'zweit-knopf', type: 'button', onclick: () => geheZu('#/') }, 'Zur Startseite'),
      ),
    ),
  );
}
