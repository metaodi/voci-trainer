// Karteikarten: umdrehen per Tap, bewerten per Swipe oder Button.
import { aktuelleKarte, bewerte, fortschritt, istFertig, type Ergebnis, type Karte } from '../lib/runde.ts';
import { ladeEinstellungen } from '../lib/einstellungen.ts';
import { kannVorlesen, stoppeVorlesen, vorlesen } from '../lib/sprache.ts';
import { merkeErgebnis } from '../lib/lernstand.ts';
import { h, icon } from '../ui/dom.ts';
import { aktiviereSwipe, setzeLage, wegfliegen, type Seite } from '../ui/swipe.ts';
import { geheZu, zustand } from '../zustand.ts';

const SPRACHNAME = { en: 'Englisch', fr: 'Französisch' } as const;

function gegenteil(e: Ergebnis): Ergebnis {
  return e === 'gewusst' ? 'nochmals' : 'gewusst';
}

function laengenKlasse(text: string): string {
  if (text.length > 70) return 'text sehr-lang';
  if (text.length > 32) return 'text lang';
  return 'text';
}

function vorlesenKnopf(karte: Karte): HTMLButtonElement | null {
  if (!kannVorlesen(karte.sprache)) return null;
  return h(
    'button',
    {
      class: 'rund-knopf vorlesen',
      type: 'button',
      'aria-label': 'Vorlesen',
      onpointerdown: (e: Event) => e.stopPropagation(),
      onclick: (e: Event) => {
        e.stopPropagation();
        vorlesen(karte.eintrag.fremdsprache, karte.sprache);
      },
    },
    icon('lautsprecher'),
  );
}

function kartenInhalt(karte: Karte): HTMLElement {
  const { eintrag, sprache, richtung } = karte;
  const fremdZuerst = richtung === 'fremd-de';
  const frage = fremdZuerst ? eintrag.fremdsprache : eintrag.deutsch;
  const antwort = fremdZuerst ? eintrag.deutsch : eintrag.fremdsprache;
  const frageSprache = fremdZuerst ? SPRACHNAME[sprache] : 'Deutsch';
  const antwortSprache = fremdZuerst ? 'Deutsch' : SPRACHNAME[sprache];

  const vorne = h(
    'div',
    { class: 'seite vorne' },
    h('div', { class: `sprach-chip ${fremdZuerst ? sprache : 'de'}` }, frageSprache),
    h('p', { class: laengenKlasse(frage), lang: fremdZuerst ? sprache : 'de' }, frage),
    fremdZuerst && vorlesenKnopf(karte),
  );
  const hinten = h(
    'div',
    { class: 'seite hinten', 'aria-hidden': 'true' },
    h('div', { class: `sprach-chip ${fremdZuerst ? 'de' : sprache}` }, antwortSprache),
    h('p', { class: laengenKlasse(antwort), lang: fremdZuerst ? 'de' : sprache }, antwort),
    h('p', { class: 'frage-klein', lang: fremdZuerst ? sprache : 'de' }, frage),
    eintrag.notiz && h('p', { class: 'notiz' }, eintrag.notiz),
    vorlesenKnopf(karte),
  );
  return h('div', { class: 'karte' }, vorne, hinten);
}

export function uebenScreen(root: HTMLElement): (() => void) | void {
  const sitzung = zustand.sitzung;
  if (!sitzung) {
    geheZu('#/', true);
    return;
  }
  const runde = sitzung.runde;
  const einst = ladeEinstellungen();
  const ergebnisFuer = (seite: Seite): Ergebnis => (seite === 'links' ? einst.swipeLinks : gegenteil(einst.swipeLinks));
  const seiteFuer = (e: Ergebnis): Seite => (e === einst.swipeLinks ? 'links' : 'rechts');

  const zaehler = h('span', { class: 'zaehler', 'aria-live': 'polite' });
  const fuellung = h('div', { class: 'balken-fuellung' });
  const stapel = h('div', { class: 'stapel' });

  const knopf = (e: Ergebnis) =>
    h(
      'button',
      { class: `bewerten-knopf ${e}`, type: 'button', onclick: () => void bewerteAktuelle(e) },
      icon(e === 'gewusst' ? 'haken' : 'nochmals'),
      e === 'gewusst' ? 'Gewusst' : 'Nochmals',
    );
  const links = einst.swipeLinks;

  root.append(
    h(
      'main',
      { class: 'ueben' },
      h(
        'header',
        { class: 'ueben-kopf' },
        h('button', { class: 'rund-knopf', type: 'button', 'aria-label': 'Runde beenden', onclick: () => geheZu('#/') }, icon('schliessen')),
        h('div', { class: 'balken', role: 'presentation' }, fuellung),
        zaehler,
      ),
      stapel,
      h('p', { class: 'hinweis' }, 'Tippen zum Umdrehen · Wischen zum Bewerten'),
      h('div', { class: 'bewerten' }, knopf(links), knopf(gegenteil(links))),
    ),
  );

  let huelle: HTMLElement | null = null;
  let karteEl: HTMLElement | null = null;
  let farbe: HTMLElement | null = null;
  let swipeAus: (() => void) | null = null;
  let beschaeftigt = false;

  function umdrehen() {
    if (!karteEl) return;
    const umgedreht = karteEl.classList.toggle('umgedreht');
    karteEl.querySelector('.vorne')?.setAttribute('aria-hidden', String(umgedreht));
    karteEl.querySelector('.hinten')?.setAttribute('aria-hidden', String(!umgedreht));
  }

  function zeigeFarbe(anteil: number) {
    if (!farbe) return;
    if (anteil === 0) {
      farbe.style.opacity = '0';
      return;
    }
    const e = ergebnisFuer(anteil < 0 ? 'links' : 'rechts');
    farbe.className = `swipe-farbe ${e}`;
    farbe.replaceChildren(h('span', { class: 'swipe-label' }, icon(e === 'gewusst' ? 'haken' : 'nochmals'), e === 'gewusst' ? 'Gewusst' : 'Nochmals'));
    farbe.style.opacity = String(Math.min(1, Math.abs(anteil)));
  }

  function aktualisiereZaehler() {
    const { gewusst, gesamt } = fortschritt(runde);
    zaehler.textContent = `${gewusst} / ${gesamt}`;
    fuellung.style.width = `${gesamt ? (gewusst / gesamt) * 100 : 0}%`;
  }

  function zeigeKarte() {
    aktualisiereZaehler();
    swipeAus?.();
    stapel.replaceChildren();
    const karte = aktuelleKarte(runde);
    if (!karte || istFertig(runde)) {
      geheZu('#/fertig', true);
      return;
    }
    karteEl = kartenInhalt(karte);
    farbe = h('div', { class: 'swipe-farbe', 'aria-hidden': 'true' });
    huelle = h('div', { class: 'karte-huelle neu', tabindex: '0', role: 'button', 'aria-label': 'Karte umdrehen' }, karteEl, farbe);
    stapel.append(huelle);
    huelle.addEventListener('animationend', () => huelle?.classList.remove('neu'), { once: true });
    swipeAus = aktiviereSwipe({
      element: huelle,
      onTap: umdrehen,
      onZiehen: zeigeFarbe,
      onSwipe: (seite) => void bewerteAktuelle(ergebnisFuer(seite)),
    });
  }

  async function bewerteAktuelle(e: Ergebnis) {
    const karte = aktuelleKarte(runde);
    if (beschaeftigt || !karte || !huelle) return;
    beschaeftigt = true;
    stoppeVorlesen();
    const seite = seiteFuer(e);
    zeigeFarbe(seite === 'links' ? -1 : 1);
    navigator.vibrate?.(e === 'gewusst' ? 12 : [8, 50, 8]);
    await wegfliegen(huelle, seite);
    merkeErgebnis(karte, e);
    bewerte(runde, e);
    beschaeftigt = false;
    zeigeKarte();
  }

  const tasten = (ev: KeyboardEvent) => {
    if (ev.target instanceof HTMLButtonElement && ev.target !== huelle) return;
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      umdrehen();
    } else if (ev.key === 'ArrowLeft') {
      void bewerteAktuelle(ergebnisFuer('links'));
    } else if (ev.key === 'ArrowRight') {
      void bewerteAktuelle(ergebnisFuer('rechts'));
    } else if (ev.key === 'Escape') {
      geheZu('#/');
    }
  };
  document.addEventListener('keydown', tasten);

  zeigeKarte();
  return () => {
    document.removeEventListener('keydown', tasten);
    swipeAus?.();
    stoppeVorlesen();
    if (huelle) setzeLage(huelle, 0);
  };
}
