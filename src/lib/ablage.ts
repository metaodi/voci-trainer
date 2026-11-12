// Sicherer Zugriff auf localStorage (kann im privaten Modus fehlen oder voll sein).

const PREFIX = 'voci:';

export function lies<T>(schluessel: string): T | undefined {
  try {
    const roh = localStorage.getItem(PREFIX + schluessel);
    return roh === null ? undefined : (JSON.parse(roh) as T);
  } catch {
    return undefined;
  }
}

export function schreibe(schluessel: string, wert: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + schluessel, JSON.stringify(wert));
    return true;
  } catch {
    return false;
  }
}

export function loesche(schluessel: string): void {
  try {
    localStorage.removeItem(PREFIX + schluessel);
  } catch {
    // ignorieren
  }
}
