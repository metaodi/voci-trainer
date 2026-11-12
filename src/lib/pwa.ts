// Registriert den Service Worker und zeigt einen Hinweis, wenn eine neue Version bereitliegt.
import { h } from '../ui/dom.ts';

function zeigeHinweis(wartend: ServiceWorker): void {
  if (document.querySelector('.update-hinweis')) return;
  const hinweis = h(
    'div',
    { class: 'update-hinweis', role: 'status' },
    h('span', {}, 'Neue Version verfügbar'),
    h(
      'button',
      {
        type: 'button',
        class: 'haupt-knopf klein',
        onclick: () => {
          hinweis.querySelector('button')!.disabled = true;
          wartend.postMessage('aktivieren');
        },
      },
      'Neu laden',
    ),
  );
  document.body.append(hinweis);
}

export function registriereServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (neuGeladen) return;
    neuGeladen = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const beobachte = (sw: ServiceWorker | null) => {
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // Nur bei einem Update hinweisen, nicht bei der allerersten Installation
          if (sw.state === 'installed' && navigator.serviceWorker.controller) zeigeHinweis(sw);
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) zeigeHinweis(reg.waiting);
      beobachte(reg.installing);
      reg.addEventListener('updatefound', () => beobachte(reg.installing));
      // Als installierte App bleibt sie oft lange offen: beim Zurückkehren nach Updates schauen
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service Worker konnte nicht registriert werden', e);
    }
  });
}
