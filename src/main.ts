import './styles.css';
import { ladeEinstellungen, wendeDarstellungAn } from './lib/einstellungen.ts';
import { registriereServiceWorker } from './lib/pwa.ts';
import { stimmenVorladen } from './lib/sprache.ts';
import { einstellungenScreen } from './screens/einstellungen.ts';
import { fertigScreen } from './screens/fertig.ts';
import { startScreen } from './screens/start.ts';
import { uebenScreen } from './screens/ueben.ts';

type Screen = (root: HTMLElement) => (() => void) | void;

const ROUTEN: Record<string, Screen> = {
  '#/': startScreen,
  '#/ueben': uebenScreen,
  '#/fertig': fertigScreen,
  '#/einstellungen': einstellungenScreen,
};

const app = document.getElementById('app')!;
let aufraeumen: (() => void) | void;

function zeichne() {
  aufraeumen?.();
  aufraeumen = undefined;
  document.body.classList.remove('mit-leiste');
  const screen = ROUTEN[location.hash] ?? startScreen;
  app.replaceChildren();
  app.dataset.screen = (location.hash || '#/').slice(2) || 'start';
  window.scrollTo(0, 0);
  aufraeumen = screen(app);
}

wendeDarstellungAn(ladeEinstellungen().darstellung);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => wendeDarstellungAn(ladeEinstellungen().darstellung));
stimmenVorladen();
window.addEventListener('hashchange', zeichne);
zeichne();
registriereServiceWorker();
