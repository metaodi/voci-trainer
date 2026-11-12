/// <reference types="vite/client" />

declare module 'virtual:lektionen' {
  export const lektionen: import('../scripts/lektionen-lib.ts').Lektion[];
  /** Hash über alle Lektionsdaten, ändert sich bei jeder Änderung. */
  export const datenVersion: string;
}
