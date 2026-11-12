// Karteikarten als Stapel: umdrehen per Tap, bewerten per Swipe oder Button.
// "Gewusst" fliegt weg, "Nochmals" wird hinten an der Stelle der Wiederholung eingeschoben.
import { aktuelleKarte, bewerte, fortschritt, istFertig, type Ergebnis, type Karte } from '../lib/runde.ts';
import { ladeEinstellungen } from '../lib/einstellungen.ts';
import { kannVorlesen, stoppeVorlesen, vorlesen } from '../lib/sprache.ts';
import { merkeErgebnis } from '../lib/lernstand.ts';
import { h, icon } from '../ui/dom.ts';
import { aktiviereSwipe, setzeLage, wegfliegen, type Seite } from '../ui/swipe.ts';
import { geheZu, zustand } from '../zustand.ts';

const SPRACHNAME = { en: 'Englisch', fr: 'Französisch' } as const;

/** So lange bleibt die Lösung sichtbar, wenn die Karte erst beim Bewerten umgedreht wird (inkl. Dreh-Animation). */
const LOESUNG_ZEIGEN_MS = 1100;

/** So viele Blätter des Stapels sind sichtbar (oberste Karte mitgezählt). */
const STAPEL_SICHTBAR = 4;

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

/** Farbiger Rand beim Bewerten – liegt auf beiden Seiten, damit er sich mit der Karte dreht. */
function swipeFarbe(): HTMLElement {
  return h('div', { class: 'swipe-farbe', 'aria-hidden': 'true' });
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
    swipeFarbe(),
  );
  const hinten = h(
    'div',
    { class: 'seite hinten', 'aria-hidden': 'true' },
    h('div', { class: `sprach-chip ${fremdZuerst ? 'de' : sprache}` }, antwortSprache),
    h('p', { class: laengenKlasse(antwort), lang: fremdZuerst ? 'de' : sprache }, antwort),
    h('p', { class: 'frage-klein', lang: fremdZuerst ? sprache : 'de' }, frage),
    eintrag.notiz && h('p', { class: 'notiz' }, eintrag.notiz),
    vorlesenKnopf(karte),
    swipeFarbe(),
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
  let farben: HTMLElement[] = [];
  let swipeAus: (() => void) | null = null;
  let beschaeftigt = false;
  let aktiv = true;

  function umdrehen() {
    if (!karteEl) return;
    const umgedreht = karteEl.classList.toggle('umgedreht');
    karteEl.querySelector('.vorne')?.setAttribute('aria-hidden', String(umgedreht));
    karteEl.querySelector('.hinten')?.setAttribute('aria-hidden', String(!umgedreht));
  }

  function zeigeFarbe(anteil: number) {
    if (anteil === 0) {
      for (const farbe of farben) farbe.style.opacity = '0';
      return;
    }
    const e = ergebnisFuer(anteil < 0 ? 'links' : 'rechts');
    for (const farbe of farben) {
      farbe.className = `swipe-farbe ${e}`;
      farbe.replaceChildren(h('span', { class: 'swipe-label' }, icon(e === 'gewusst' ? 'haken' : 'nochmals'), e === 'gewusst' ? 'Gewusst' : 'Nochmals'));
      farbe.style.opacity = String(Math.min(1, Math.abs(anteil)));
    }
  }

  function aktualisiereZaehler() {
    const { gewusst, gesamt } = fortschritt(runde);
    zaehler.textContent = `${gewusst} / ${gesamt}`;
    fuellung.style.width = `${gesamt ? (gewusst / gesamt) * 100 : 0}%`;
  }

  /** Karten-Index → Blatt im Stapel. Das Blatt trägt die Stapeltiefe, die Hülle darin die Swipe-Lage. */
  const blaetter = new Map<number, HTMLElement>();
  const reduziert = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const warte = (ms: number) => new Promise<void>((ok) => setTimeout(ok, reduziert() ? 0 : ms));

  function setzeTiefe(blatt: HTMLElement, tiefe: number) {
    blatt.style.setProperty('--tiefe', String(tiefe));
    blatt.style.zIndex = String(STAPEL_SICHTBAR + 1 - tiefe);
    blatt.classList.toggle('versteckt', tiefe >= STAPEL_SICHTBAR);
    if (tiefe > 0) blatt.setAttribute('aria-hidden', 'true');
    else blatt.removeAttribute('aria-hidden');
  }

  function neuesBlatt(): HTMLElement {
    const blatt = h('div', { class: 'blatt' }, h('div', { class: 'karte-huelle leer' }));
    setzeTiefe(blatt, STAPEL_SICHTBAR);
    stapel.prepend(blatt);
    blatt.getBoundingClientRect(); // Startlage übernehmen, damit das Auftauchen animiert wird
    return blatt;
  }

  /** Bringt die Blätter in die Reihenfolge der Warteschlange (oben = Tiefe 0). */
  function ordneStapel(ausser?: number) {
    const sichtbar = runde.warteschlange.slice(0, STAPEL_SICHTBAR);
    for (const [i, blatt] of blaetter) {
      if (i === ausser || sichtbar.includes(i)) continue;
      blaetter.delete(i);
      setzeTiefe(blatt, STAPEL_SICHTBAR);
      setTimeout(() => blatt.remove(), reduziert() ? 0 : 400);
    }
    sichtbar.forEach((i, tiefe) => {
      if (i === ausser) return;
      let blatt = blaetter.get(i);
      if (!blatt) {
        blatt = neuesBlatt();
        blaetter.set(i, blatt);
      }
      setzeTiefe(blatt, tiefe);
    });
  }

  /** Macht aus der Hülle wieder ein leeres Blatt (der Inhalt blendet aus). */
  function leeren(el: HTMLElement) {
    el.className = 'karte-huelle leer';
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
  }

  /** Füllt die oberste Karte des Stapels mit Inhalt (noch ohne Wischen). */
  function fuelleOben() {
    const karte = aktuelleKarte(runde);
    const blatt = karte && blaetter.get(runde.warteschlange[0]);
    if (!karte || !blatt) return;
    const el = blatt.firstElementChild as HTMLElement;
    karteEl = kartenInhalt(karte);
    farben = [...karteEl.querySelectorAll<HTMLElement>('.swipe-farbe')];
    el.className = 'karte-huelle';
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Karte umdrehen');
    setzeLage(el, 0);
    el.replaceChildren(karteEl);
    huelle = el;
  }

  /** Zeigt die oberste Karte an und macht sie bedienbar. */
  function zeigeOben() {
    aktualisiereZaehler();
    swipeAus?.();
    swipeAus = null;
    if (!aktuelleKarte(runde) || istFertig(runde)) {
      geheZu('#/fertig', true);
      return;
    }
    ordneStapel();
    if (!huelle) fuelleOben();
    if (!huelle) return;
    swipeAus = aktiviereSwipe({
      element: huelle,
      onTap: umdrehen,
      onZiehen: zeigeFarbe,
      onSwipe: (seite) => void bewerteAktuelle(ergebnisFuer(seite)),
    });
  }

  /** "Nochmals": Karte gleitet zur Seite hinaus und von hinten an ihre neue Stelle im Stapel. */
  async function einreihen(index: number, blatt: HTMLElement, el: HTMLElement, seite: Seite, stelle: number) {
    const tiefe = Math.min(stelle, STAPEL_SICHTBAR);
    blatt.classList.add('unterwegs');
    leeren(el);
    ordneStapel(index); // die anderen Karten rücken nach
    blatt.style.setProperty('--tiefe', String(tiefe));
    const weite = el.offsetWidth * 0.8;
    setzeLage(el, seite === 'links' ? -weite : weite, -20);
    await warte(320);
    el.replaceChildren();
    blatt.classList.remove('unterwegs');
    setzeTiefe(blatt, tiefe);
    setzeLage(el, 0);
    await warte(380);
    if (tiefe >= STAPEL_SICHTBAR) {
      blaetter.delete(index);
      blatt.remove();
    }
  }

  async function bewerteAktuelle(e: Ergebnis) {
    const karte = aktuelleKarte(runde);
    const index = runde.warteschlange[0];
    const blatt = blaetter.get(index);
    if (beschaeftigt || !karte || !huelle || !blatt) return;
    beschaeftigt = true;
    stoppeVorlesen();
    const seite = seiteFuer(e);
    zeigeFarbe(seite === 'links' ? -1 : 1);
    navigator.vibrate?.(e === 'gewusst' ? 12 : [8, 50, 8]);
    if (karteEl && !karteEl.classList.contains('umgedreht')) {
      // Noch nicht umgedreht: Karte zurück in die Mitte, umdrehen und die Lösung kurz zeigen.
      setzeLage(huelle, 0);
      umdrehen();
      await loesungZeigen();
      if (!aktiv) return;
    }
    const el = huelle;
    swipeAus?.();
    swipeAus = null;
    huelle = karteEl = null;
    farben = [];
    merkeErgebnis(karte, e);
    const stelle = bewerte(runde, e);
    let animation: Promise<void>;
    if (stelle === null) {
      blaetter.delete(index);
      blatt.classList.add('unterwegs');
      ordneStapel(); // der Stapel rückt nach, während die Karte wegfliegt
      animation = wegfliegen(el, seite).then(() => blatt.remove());
    } else {
      animation = einreihen(index, blatt, el, seite, stelle);
    }
    // Die nächste Karte zeigt ihren Inhalt sofort – ausser es ist dieselbe Karte (nur noch eine übrig).
    if (!istFertig(runde) && runde.warteschlange[0] !== index) fuelleOben();
    aktualisiereZaehler();
    await animation;
    beschaeftigt = false;
    if (aktiv) zeigeOben();
  }

  /** Wartet, bis die Lösung lange genug sichtbar war – ein Tippen oder eine Taste geht sofort weiter. */
  function loesungZeigen(): Promise<void> {
    return new Promise((ok) => {
      const weiter = () => {
        clearTimeout(zeit);
        document.removeEventListener('pointerdown', weiter, true);
        document.removeEventListener('keydown', weiter, true);
        ok();
      };
      const zeit = setTimeout(weiter, LOESUNG_ZEIGEN_MS);
      document.addEventListener('pointerdown', weiter, true);
      document.addEventListener('keydown', weiter, true);
    });
  }

  const tasten = (ev: KeyboardEvent) => {
    if (ev.target instanceof HTMLButtonElement && ev.target !== huelle) return;
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      if (!beschaeftigt) umdrehen();
    } else if (ev.key === 'ArrowLeft') {
      void bewerteAktuelle(ergebnisFuer('links'));
    } else if (ev.key === 'ArrowRight') {
      void bewerteAktuelle(ergebnisFuer('rechts'));
    } else if (ev.key === 'Escape') {
      geheZu('#/');
    }
  };
  document.addEventListener('keydown', tasten);

  zeigeOben();
  return () => {
    aktiv = false;
    document.removeEventListener('keydown', tasten);
    swipeAus?.();
    stoppeVorlesen();
    if (huelle) setzeLage(huelle, 0);
  };
}
