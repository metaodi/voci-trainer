---
description: Neue Lektion aus Fotos einer Voci-Seite erfassen und als Pull Request vorschlagen
argument-hint: <en|fr> <Lektionsname> [Prüfungsdatum] (Fotos anhängen)
---

# Neue Lektion erfassen

Angaben: $ARGUMENTS

Halte dich an die Regeln in `CLAUDE.md` (Datenformat und „Regeln fürs Abschreiben von Voci-Seiten“).

## 1. Angaben klären

- Benötigt: ein oder mehrere Fotos, Sprache (`en`/`fr`), Lektionsname (z.B. „Unit 4“, „Unité 3“).
  Optional: Prüfungsdatum. Fehlt etwas, kurz nachfragen. Relative Angaben („Freitag in zwei Wochen“) in ein
  konkretes Datum umrechnen (heutiges Datum beachten) und zur Bestätigung nennen.
- id und Dateiname bestimmen (`fr-unite-3`, `fr/unite-3.csv`). Prüfen, dass es die id noch nicht gibt. Existiert
  die Lektion schon, fragen, ob sie ergänzt werden soll – dann den Workflow „Lektion ergänzen“ aus `CLAUDE.md` nutzen.

## 2. Auslesen

- Alle Fotos vollständig lesen, auch Einträge, die über zwei Seiten gehen. Reihenfolge wie im Buch.
- Artikel behalten, Lautschrift und Seitenzahlen weglassen, Spalten Fremdsprache/Deutsch korrekt zuordnen,
  Akzente sorgfältig setzen, Deutsch mit „ss“.
- `typ`: `wort` oder `satz`. Notizen nur, wenn sie im Buch stehen oder fürs Lernen wirklich helfen.
- Doppelte Einträge zusammenführen (mehrere Übersetzungen mit ` / `).

## 3. Vorschau zeigen – und warten

Zeige eine Markdown-Tabelle mit **allen** erkannten Einträgen:

| # | Fremdsprache | Deutsch | Typ | Notiz | ⚠ |
|---|--------------|---------|-----|-------|---|

- In der Spalte ⚠ unsichere Stellen markieren und kurz begründen (unleserlich, Akzent unklar, Zuordnung unklar,
  abgeschnitten, Wort nur halb sichtbar …).
- Darunter: Anzahl Wörter/Sätze, geplante id/Datei, Prüfungsdatum.
- **Erst weitermachen, wenn die Korrekturen eingearbeitet sind und ein OK kommt.** Nach Korrekturen die geänderten
  Zeilen nochmals zeigen.

## 4. Dateien schreiben, prüfen, Pull Request

```bash
git switch main && git pull --ff-only
git switch -c lektion/<id>
```

1. CSV `lektionen/<sprache>/<name>.csv` schreiben (UTF-8, `;`, Kopfzeile `fremdsprache;deutsch;typ;notiz`).
2. Eintrag in `lektionen/lektionen.json` **am Ende** anhängen (mit `pruefung`, falls angegeben).
3. `npm run check-lektionen` ausführen; Fehler beheben, bis alles grün ist. Optional `npm test`.
4. Nur die Lektionsdateien committen – **keine Fotos**:
   ```bash
   git add lektionen/lektionen.json lektionen/<sprache>/<name>.csv
   git commit -m "Neue Lektion: <Name> (<Sprache>)"
   git push -u origin lektion/<id>
   ```
5. Pull Request auf `main` öffnen (`gh pr create`), Titel `Neue Lektion: <Name> (<Englisch|Französisch>)`.
   PR-Text kurz:
   - Anzahl Einträge (davon Wörter / Sätze)
   - Prüfungsdatum (falls gesetzt)
   - Auffälligkeiten: unsichere Stellen und wie sie entschieden wurden
6. Link zum PR zeigen und erwähnen: Nach dem Merge wird die App automatisch aktualisiert; auf dem Gerät erscheint
   „Neue Wörter verfügbar“.
