// Aussprache über die Web Speech API (funktioniert offline mit den Stimmen des Geräts).
import type { Sprache } from '../../scripts/lektionen-lib.ts';

const LANG: Record<Sprache, string> = { en: 'en-GB', fr: 'fr-FR' };

function stimmen(): SpeechSynthesisVoice[] {
  return 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
}

function passendeStimme(sprache: Sprache): SpeechSynthesisVoice | undefined {
  const ziel = LANG[sprache].toLowerCase();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  const alle = stimmen();
  return (
    alle.find((v) => norm(v) === ziel && v.localService) ??
    alle.find((v) => norm(v) === ziel) ??
    alle.find((v) => norm(v).startsWith(sprache))
  );
}

/** true, wenn Vorlesen in dieser Sprache wahrscheinlich klappt. */
export function kannVorlesen(sprache: Sprache): boolean {
  if (!('speechSynthesis' in window)) return false;
  // Manche Browser laden die Stimmen verzögert – dann optimistisch sein.
  return stimmen().length === 0 || passendeStimme(sprache) !== undefined;
}

export function vorlesen(text: string, sprache: Sprache): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  // "big / large" → "big, large" (kurze Pause statt "Schrägstrich")
  const u = new SpeechSynthesisUtterance(text.replaceAll(' / ', ', '));
  u.lang = LANG[sprache];
  const stimme = passendeStimme(sprache);
  if (stimme) u.voice = stimme;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export function stoppeVorlesen(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/** Chrome liefert die Stimmen erst nach dem ersten Aufruf. */
export function stimmenVorladen(): void {
  stimmen();
}
