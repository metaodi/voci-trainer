// Kleiner Helfer zum Erzeugen von DOM-Elementen ohne Framework.

export type Kind = Node | string | number | null | undefined | false;
type Attribute = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attribute = {},
  ...kinder: (Kind | Kind[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, wert] of Object.entries(attrs)) {
    if (wert === undefined || wert === null || wert === false) continue;
    if (name.startsWith('on') && typeof wert === 'function') {
      el.addEventListener(name.slice(2).toLowerCase(), wert as EventListener);
    } else if (name === 'class') {
      el.className = String(wert);
    } else if (wert === true) {
      el.setAttribute(name, '');
    } else if (name === 'value' || name === 'checked') {
      (el as unknown as Record<string, unknown>)[name] = wert;
    } else {
      el.setAttribute(name, String(wert));
    }
  }
  fuegeEin(el, kinder);
  return el;
}

export function fuegeEin(el: Element, kinder: (Kind | Kind[])[]): void {
  for (const k of kinder.flat()) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : String(k));
  }
}

/** Inline-SVG-Icons (keine externen Ressourcen). */
const PFADE = {
  lautsprecher:
    '<path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  schliessen: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  zahnrad:
    '<rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(0 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(45 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(90 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(135 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(180 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(225 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(270 12 12)"/><rect x="10.4" y="1.8" width="3.2" height="4.4" rx="1" fill="currentColor" transform="rotate(315 12 12)"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  zurueck: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  haken: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  nochmals:
    '<path d="M4 12a8 8 0 1 0 2.3-5.7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  stern: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z" fill="currentColor"/>',
  flamme:
    '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.6-2.4-5.6-3.6-8.7-.3-.8-1.4-.8-1.7 0-.4 1.2-1 2.3-1.9 2.9.2-2.8-.8-5.6-2.8-7.3-.5-.4-1.3 0-1.2.7.2 3.2-3.8 5.8-3.8 12.4C4 19.2 8 22 12 22Z" fill="currentColor"/>',
  kalender:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  pfeil: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
} as const;

export type IconName = keyof typeof PFADE;

export function icon(name: IconName, klasse = 'icon'): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="${klasse}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PFADE[name]}</svg>`;
  return tpl.content.firstElementChild as SVGSVGElement;
}
