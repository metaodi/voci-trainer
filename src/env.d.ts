/// <reference types="vite/client" />

declare module 'virtual:lektionen' {
  import type { Lektion } from '../scripts/lektionen-lib.ts';
  export const lektionen: Lektion[];
  /** Hash über alle Lektionsdaten, ändert sich bei jeder Änderung. */
  export const datenVersion: string;
}
