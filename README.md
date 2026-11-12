# Voci-Trainer

Karteikarten-App zum Lernen von Englisch- und Französisch-Vokabeln für die Primarschule. Läuft im Browser, lässt
sich auf dem Homescreen installieren und funktioniert danach komplett offline. Kein Backend, keine Tracker; der
Lernstand bleibt auf dem Gerät.

**App:** https://metaodi.github.io/voci-trainer/

## Funktionen

- Lektionen nach Sprache, mit Fortschrittsbalken und Countdown bis zur Prüfung
- Eine oder mehrere Lektionen gemeinsam üben: Fremdsprache → Deutsch, Deutsch → Fremdsprache oder gemischt
- Karte antippen zum Umdrehen; wischen zum Bewerten (Standard: links = Gewusst, rechts = Nochmals – umschaltbar)
- „Nochmals“-Karten kommen in derselben Runde wieder, bis alle gewusst sind
- Zusammenfassung mit Sternen, Konfetti und den schwierigsten Wörtern („Nur die schwierigen nochmals“)
- Aussprache über die Stimmen des Geräts (en-GB / fr-FR)
- Lerntage in Folge, Hell/Dunkel, Backup des Lernstands als JSON-Datei

## Setup

Voraussetzung: Node.js 24 oder neuer (die Skripte nutzen die eingebaute TypeScript-Unterstützung von Node).

```bash
npm install
npm run dev
```

Dann http://localhost:5173/voci-trainer/ öffnen.

| Befehl                    | Zweck                                                     |
| ------------------------- | --------------------------------------------------------- |
| `npm run dev`             | Dev-Server mit Live-Reload (auch bei CSV-Änderungen)      |
| `npm run check-lektionen` | Alle Lektionen prüfen                                     |
| `npm test`                | Tests (CSV-Parser, Validierung, Wiederhol-Logik, Lernstand) |
| `npm run build`           | Prüfen und Produktions-Build nach `dist/`                 |
| `npm run preview`         | Produktions-Build lokal ansehen (mit Service Worker)      |
| `npm run icons`           | App-Icons neu erzeugen                                    |

## Lektionen

Die Wortlisten liegen in `lektionen/`:

```
lektionen/
  lektionen.json     Verzeichnis aller Lektionen
  en/unit-1.csv
  fr/unite-1.csv
```

`lektionen.json`:

```json
[
  { "id": "fr-unite-3", "name": "Unité 3", "sprache": "fr", "datei": "fr/unite-3.csv", "pruefung": "2026-12-04" }
]
```

Optional: `pruefung` (Datum `JJJJ-MM-TT`) und `archiviert` (`true` blendet die Lektion aus; sie bleibt unter „Archiv“
abrufbar).

CSV-Dateien (UTF-8, Trennzeichen `;`):

```csv
fremdsprache;deutsch;typ;notiz
l'école;die Schule;wort;f.
big / large;gross;wort;
J'habite à Zurich, en Suisse.;Ich wohne in Zürich, in der Schweiz.;satz;
```

- `typ` ist `wort` oder `satz`, `notiz` ist optional.
- Mehrere gültige Übersetzungen mit ` / ` trennen.
- Der Lernstand eines Eintrags hängt an Lektions-ID + Fremdsprachentext. Die Reihenfolge darf sich ändern; wird der
  Text selbst geändert, beginnt dieser Eintrag von vorn.

`npm run check-lektionen` prüft: Dateien und Verzeichnis passen zusammen, Kopfzeile, keine leeren Pflichtfelder,
gültige Typen, keine Duplikate innerhalb einer Lektion, gültige Datumsangaben. Dieselbe Prüfung läuft beim Build und
in der CI – fehlerhafte Lektionen werden nie veröffentlicht.

## Neue Lektion erfassen (mit Claude Code)

1. Fotos der Voci-Seite machen.
2. In Claude Code im Projektordner:
   ```
   /neue-lektion fr Unité 3 Prüfung am 4. Dezember
   ```
   und die Fotos anhängen.
3. Claude zeigt eine Tabelle aller erkannten Einträge und markiert unsichere Stellen. Korrigieren, dann OK geben.
4. Claude legt einen Branch an, schreibt CSV und `lektionen.json`, prüft alles und öffnet einen Pull Request.
5. Pull Request ansehen und mergen. Wenige Minuten später ist die Lektion online; in der App erscheint
   „Neue Version verfügbar“.

Genauso lassen sich Lektionen ergänzen oder korrigieren, Prüfungsdaten setzen und Lektionen archivieren – einfach in
Worten sagen, was geändert werden soll. Die Regeln dafür stehen in [`CLAUDE.md`](CLAUDE.md). Fotos werden nie
committet.

## Deployment

Die App wird mit GitHub Actions auf GitHub Pages veröffentlicht ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- Bei jedem Pull Request: Lektionen prüfen, Typen prüfen, Tests, Build.
- Bei jedem Push auf `main`: dasselbe, danach Veröffentlichung – nur wenn alles grün ist.

Einmalig einrichten: Im Repository unter **Settings → Pages → Build and deployment → Source** „GitHub Actions“ wählen.

Wird das Repository umbenannt oder unter einer eigenen Domain betrieben, `base` in [`vite.config.ts`](vite.config.ts)
anpassen.

## Auf dem Gerät installieren

- **iPhone/iPad (Safari):** Teilen → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Nach dem ersten Öffnen ist alles offline verfügbar. Neue Lektionen und App-Updates werden geladen, sobald das Gerät
wieder online ist; dann erscheint der Hinweis „Neue Version verfügbar – Neu laden“.

## Lernstand und Datenschutz

Der Lernstand liegt nur im Browser des Geräts (localStorage). Unter **Einstellungen → Backup speichern** lässt er sich
als JSON-Datei sichern und auf einem anderen Gerät mit **Backup laden** übernehmen (zusammenführen oder ersetzen).
Die App lädt keine externen Ressourcen und sendet keine Daten.

Hinweis: Wird die App lange nicht genutzt, kann iOS die gespeicherten Daten einer Web-App löschen. Ein gelegentliches
Backup schadet nicht.

## Technik

Vite + TypeScript, kein UI-Framework, keine Laufzeit-Abhängigkeiten. Der Service Worker wird beim Build aus
`src/sw-vorlage.js` erzeugt und cacht alle Dateien vorab. Das Datenmodell enthält bereits Felder für spätere
Spaced Repetition (`stufe`, `faelligAm`).
