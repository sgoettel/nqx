# nqx – Freie Zeitfenster Rechner

Eine statische Vanilla-Web-App (HTML/CSS/JS) zur Berechnung freier Zeitfenster pro Woche.
Die App läuft ohne Build-Tooling und speichert alle Eingaben im Browser via `localStorage`.

## Features

- Dynamische Listen für **feste** und **variable Termine** (Zeilen per „+ Hinzufügen“).
- Berechnung freier Slots je Wochentag mit Validierung (Zeitformat, Reihenfolge, Mindestdauer).
- **Filter und Sortierung**:
  - Slots anzeigen ab wählbarer Dauer (z. B. 0.5h / 1h / 2h …)
  - Sortierung chronologisch oder nach Slot-Länge (absteigend)
- **Arbeitszeiten pro Tag** (optional):
  - globale Arbeitszeit bleibt Standard
  - pro Tag kann optional ein eigenes Arbeitsfenster gesetzt werden
- **Aufgabenplanung**:
  - Eingabe „Aufgabendauer (Stunden)“ + „Slot finden“
  - findet passende Einzel-Slots
  - wenn kein Einzel-Slot passt: Vorschlag für sinnvolle Aufteilung über mehrere freie Slots
  - passende Slots werden markiert
- **Visualisierung**:
  - Listenansicht (detailreich)
  - optionale Mini-Timeline pro Tag (belegt/frei auf einen Blick)
- **Interaktive Ergebnisse**:
  - freie Slots sind klickbar
  - per Dialog kann ein Slot direkt als neuer variabler Termin übernommen werden
- **Kompakte, sticky Zusammenfassung** über den Ergebnissen:
  - Anzahl Slots
  - gesamte freie Zeit
  - längster Slot

## Bedienung

1. Woche, globale Arbeitszeit und Mindestdauer setzen.
2. Optional Tages-Arbeitszeiten aktivieren und je Wochentag überschreiben.
3. Feste/variable Termine hinzufügen und aktivieren.
4. Auf „Freie Zeitfenster berechnen“ klicken.
5. Optional „Slot finden“ für eine konkrete Aufgabendauer nutzen.
6. Bei Bedarf freien Slot anklicken und als variablen Termin übernehmen.

## Deployment auf GitHub Pages

Da es eine statische App ist, reicht es, diese Dateien im Repo zu halten:

- `index.html`
- `styles.css`
- `app.js`

Dann in GitHub:

1. Repository öffnen → **Settings** → **Pages**.
2. Unter **Build and deployment** bei **Source**: *Deploy from a branch* wählen.
3. Branch (z. B. `main`) und Ordner (`/root`) auswählen.
4. Speichern – danach wird die Seite unter der angegebenen Pages-URL veröffentlicht.
