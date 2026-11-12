// Swipe-Geste für die Karten: ziehen, antippen, wegwischen.

export type Seite = 'links' | 'rechts';

export interface SwipeOptionen {
  /** Das Element, das bewegt wird. */
  element: HTMLElement;
  /** Antippen ohne Ziehen. */
  onTap: () => void;
  /** Während des Ziehens: Anteil -1 (ganz links) … 1 (ganz rechts) bis zur Schwelle. */
  onZiehen: (anteil: number) => void;
  /** Karte wurde weggewischt (die Wegflieg-Animation läuft bereits). */
  onSwipe: (seite: Seite) => void;
}

const TAP_TOLERANZ = 10; // px
const MIN_SCHWUNG = 0.6; // px/ms – ein schneller kurzer Wisch zählt auch

function schwelle(el: HTMLElement): number {
  return Math.min(140, el.offsetWidth * 0.3);
}

export function setzeLage(el: HTMLElement, dx: number, dy = 0): void {
  el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)` : '';
}

/** Lässt die Karte zur Seite hinaus fliegen. */
export function wegfliegen(el: HTMLElement, seite: Seite): Promise<void> {
  const weite = window.innerWidth * 0.9 + el.offsetWidth;
  const dx = seite === 'links' ? -weite : weite;
  el.classList.add('fliegt');
  setzeLage(el, dx, 40);
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((ok) => setTimeout(ok, reduziert ? 0 : 260));
}

export function aktiviereSwipe(o: SwipeOptionen): () => void {
  const el = o.element;
  let start: { x: number; y: number; t: number; id: number } | null = null;
  let zieht = false;
  let dx = 0;
  let gesperrt = false;

  const runter = (e: PointerEvent) => {
    if (gesperrt || start || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    zieht = false;
    dx = 0;
    el.setPointerCapture(e.pointerId);
  };

  const bewegen = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!zieht && Math.hypot(dx, dy) > TAP_TOLERANZ) {
      zieht = true;
      el.classList.add('zieht');
    }
    if (!zieht) return;
    setzeLage(el, dx, dy * 0.25);
    o.onZiehen(Math.max(-1, Math.min(1, dx / schwelle(el))));
  };

  const hoch = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const dauer = Math.max(1, performance.now() - start.t);
    start = null;
    el.classList.remove('zieht');
    if (!zieht) {
      o.onTap();
      return;
    }
    const schwung = Math.abs(dx) / dauer;
    if (Math.abs(dx) >= schwelle(el) || (schwung > MIN_SCHWUNG && Math.abs(dx) > 40)) {
      gesperrt = true;
      o.onSwipe(dx < 0 ? 'links' : 'rechts');
    } else {
      setzeLage(el, 0);
      o.onZiehen(0);
    }
  };

  const abbrechen = () => {
    start = null;
    el.classList.remove('zieht');
    setzeLage(el, 0);
    o.onZiehen(0);
  };

  el.addEventListener('pointerdown', runter);
  el.addEventListener('pointermove', bewegen);
  el.addEventListener('pointerup', hoch);
  el.addEventListener('pointercancel', abbrechen);
  return () => {
    el.removeEventListener('pointerdown', runter);
    el.removeEventListener('pointermove', bewegen);
    el.removeEventListener('pointerup', hoch);
    el.removeEventListener('pointercancel', abbrechen);
  };
}
