# Voci-Trainer – Hinweise für Claude Code

Statische PWA (Vite + TypeScript, ohne Framework und ohne Laufzeit-Abhängigkeiten), mit der ein Kind der 5. Klasse
Englisch- und Französisch-Vokabeln mit Karteikarten lernt. Hosting auf GitHub Pages, kein Backend.

## Grundregeln

- **Sprache:** Oberfläche, Commits, PR-Texte und Kommentare auf Deutsch, Schweizer Schreibweise (immer „ss“, nie „ß“).
- **Keine persönlichen Daten** ins Repo: keine Namen, keine Schule, keine Klasse, keine Lehrpersonen, keine Fotos.
- **Fotos von Schulbuchseiten werden nie committet.** Sie liegen ausserhalb des Repos oder im ignorierten Ordner `fotos/`.
  Beim Committen nur gezielt Dateien unter `lektionen/` hinzufügen, nie `git add -A`.
- Keine Tracker, keine externen Fonts/CDNs, keine neuen Laufzeit-Abhängigkeiten ohne Rückfrage.

## Befehle

```bash
npm run dev               # Dev-Server (http://localhost:5173/voci-trainer/)
npm run check-lektionen   # Lektionen validieren (läuft auch in der CI)
npm test                  # Vitest
npm run typecheck         # tsc --noEmit
npm run build             # check-lektionen + typecheck + vite build (mit Service Worker)
npm run icons             # App-Icons neu erzeugen (public/icons/)
```

## Struktur

```
lektionen/lektionen.json   Verzeichnis aller Lektionen
lektionen/en/*.csv         Englisch
lektionen/fr/*.csv         Französisch
scripts/lektionen-lib.ts   CSV-Parser + Validierung (rein, getestet)
scripts/check-lektionen.ts npm run check-lektionen
vite-plugin-lektionen.ts   Lektionen als Modul "virtual:lektionen", erzeugt dist/sw.js
src/lib/runde.ts           Wiederhol-Logik einer Runde
src/lib/lernstand.ts       Lernstand (localStorage), Lerntage, Export/Import
src/screens/               start, ueben, fertig, einstellungen
src/sw-vorlage.js          Service Worker (Vorlage)
tests/                     Tests
```

## Datenformat

`lektionen/lektionen.json` ist ein Array:

```json
{ "id": "fr-unite-3", "name": "Unité 3", "sprache": "fr", "datei": "fr/unite-3.csv", "pruefung": "2026-12-04", "archiviert": false }
```

- `id`: nur Kleinbuchstaben, Ziffern und `-`, Muster `<sprache>-<name-als-slug>` (z.B. `en-unit-4`, `fr-unite-3`).
  Ist die id schon vergeben (z.B. gleiche Unit in einem späteren Schuljahr), ein Suffix anhängen (`en-unit-4-b`).
  **Die id einer bestehenden Lektion nie ändern** – der Lernstand hängt daran.
- `datei`: muss im Ordner der Sprache liegen und gleich heissen wie die id ohne Sprach-Präfix (`fr/unite-3.csv`).
- `pruefung` (optional): ISO-Datum `JJJJ-MM-TT`. `archiviert` (optional): `true` blendet die Lektion auf der Startseite aus.
- Neue Lektionen werden **ans Ende** des Arrays angehängt (die App zeigt die neuesten zuerst).

CSV-Dateien: UTF-8, Trennzeichen `;`, Kopfzeile genau `fremdsprache;deutsch;typ;notiz`.

| Spalte         | Inhalt                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| `fremdsprache` | Wort/Satz in Englisch bzw. Französisch                                  |
| `deutsch`      | Übersetzung                                                             |
| `typ`          | `wort` (Wörter, kurze Ausdrücke) oder `satz` (ganze Sätze und Fragen)   |
| `notiz`        | optional, kurz: z.B. `f.`, `pl.`, `unregelmässig`, `ugs.`, Merkhilfe    |

- Mehrere gültige Übersetzungen mit ` / ` trennen: `big / large;gross;wort;`
- Enthält ein Feld ein `;`, das Feld in `"…"` setzen.
- **Der Fremdsprachentext ist Teil des Schlüssels für den Lernstand.** Wird er geändert (auch nur ein Akzent), beginnt
  dieser Eintrag beim Lernstand von vorn. Das ist bei echten Korrekturen in Ordnung, muss aber im PR erwähnt werden.
  Die Reihenfolge der Zeilen darf sich jederzeit ändern.
- Innerhalb einer Lektion darf jeder Fremdsprachentext nur einmal vorkommen.

## Regeln fürs Abschreiben von Voci-Seiten

- Artikel behalten: `the dog`, `le chien`, `la maison`, `l'école`, `les amis`. Auf Deutsch ebenfalls mit Artikel
  (`der Hund`). Bei `l'`/`les` das Geschlecht als Notiz ergänzen, wenn es im Buch steht (`f.` / `m.`).
- Englische Verben so wie im Buch, meist mit `to` (`to play`).
- Lautschrift (`[ˈbrekfəst]`), Seitenzahlen, Nummern, Icons und Beispielbilder ignorieren.
- Spalten richtig zuordnen: Fremdsprache links/zuerst, Deutsch rechts – bei Zweifel nach Inhalt entscheiden, nicht nach Position.
- Akzente sorgfältig setzen: é è ê ë à â ç î ï ô û ù œ, auch auf Grossbuchstaben (`À bientôt !`).
- Französische Satzzeichen wie im Buch übernehmen (z.B. Leerzeichen vor `?` und `!`). Apostroph als `'`.
- Deutsch in Schweizer Schreibweise: `gross`, `Strasse`, `heisst` – nie `ß`.
- Beispielsätze aus dem Buch als eigene Zeile mit `typ` `satz` aufnehmen, wenn sie zum Lernstoff gehören.
- Nichts erfinden: Unleserliches als unsicher markieren und nachfragen.

## Workflows

Alle Workflows laufen gleich ab: zuerst Vorschau zeigen und auf OK warten, dann Branch, Dateien, `npm run check-lektionen`,
Commit, Pull Request. Nie direkt auf `main` committen. Ein Merge auf `main` veröffentlicht automatisch.

- **Neue Lektion erfassen:** siehe `/neue-lektion` (`.claude/commands/neue-lektion.md`).
- **Lektion ergänzen oder korrigieren:** Fotos/Angaben auslesen wie bei einer neuen Lektion, dann eine Tabelle mit
  neuen, geänderten und gelöschten Einträgen zeigen. Bei Änderungen am Fremdsprachentext darauf hinweisen, dass der
  Lernstand dieses Eintrags zurückgesetzt wird. Branch `lektion/<id>-ergaenzen`.
- **Prüfungsdatum setzen/ändern:** `pruefung` in `lektionen.json` setzen (ISO-Datum; Angaben wie „nächsten Freitag“
  ausrechnen und das konkrete Datum zur Bestätigung nennen). Branch `lektion/<id>-pruefung`.
- **Lektion archivieren:** `"archiviert": true` setzen, `pruefung` darf bleiben. Lernstand bleibt erhalten, die Lektion
  ist in der App unter „Archiv“ weiter abrufbar. Branch `lektion/<id>-archivieren`.
- Mehrere kleine Änderungen auf einmal (z.B. drei Lektionen archivieren) dürfen in einen gemeinsamen PR.

PR-Titel z.B. `Neue Lektion: Unité 3 (Französisch)`. PR-Text: Anzahl Einträge (Wörter/Sätze), Prüfungsdatum,
Auffälligkeiten (unsichere Stellen und wie sie entschieden wurden, geänderte Schlüssel).
