# Freie Zeitfenster Rechner (Frontend-only)

Eine statische Web-App (Vanilla HTML/CSS/JS), um freie Zeitfenster pro Woche zu berechnen.

## Was die App macht

- Definiert ein tägliches Arbeitszeitfenster (Standard: `07:00` bis `18:00`).
- Verwendet **5 feste wiederkehrende Termine** (jede Woche gleich).
- Verwendet **10 variable Termine** für die aktuell gewählte Woche (modelliert über Wochentag).
- Berechnet pro Wochentag die freien Zeitfenster.
- Filtert freie Slots über eine Mindestdauer in Stunden.
- Speichert alle Eingaben im Browser via `localStorage`.

## Lokal starten

1. Repository klonen oder Dateien herunterladen.
2. `index.html` im Browser öffnen.
   - Optional (sauberer): lokaler Static-Server, z. B. `python3 -m http.server` und dann `http://localhost:8000` öffnen.

## GitHub Pages Deployment

1. Repository auf GitHub pushen.
2. In GitHub: **Settings → Pages**.
3. Unter **Build and deployment** `Deploy from a branch` auswählen.
4. Branch (`main` oder gewünschter Branch) und Root (`/`) wählen.
5. Speichern; nach kurzer Zeit ist die Seite über die Pages-URL erreichbar.

## Hinweis zum Modell der variablen Termine

Variable Termine sind im MVP über den **Wochentag (Mo–So)** modelliert, nicht über exakte Datumswerte einzelner Termine.
Das kann später erweitert werden (z. B. datumsgenaue Einträge pro Woche).
