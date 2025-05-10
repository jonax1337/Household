# Household - Wohnungsmanagement App

Eine benutzerfreundliche React-App mit Apple-inspiriertem Design für die Verwaltung von Wohnungsangelegenheiten, Reinigungsplänen und Einkaufslisten.

## Features

- **Benutzeranmeldung/Registrierung**: Einfache Anmeldung und Registrierung
- **Wohnungsverwaltung**: Erstellen und Verwalten von Wohnungsdetails
- **Reinigungszeitpläne**: Wiederholbare Aufgaben mit Erinnerungen und Belohnungspunkten
- **Einkaufslisten**: Listen erstellen mit automatischer Kategorisierung und Vorschlägen
- **Design-Themen**: Drei verschiedene Themes (hell, dunkel und niedlich)

## Erste Schritte

### Voraussetzungen

- Node.js (v14.x oder höher)
- npm (v6.x oder höher)

### Installation

1. Abhängigkeiten installieren:

```bash
npm install
```

2. Die Anwendung im Entwicklungsmodus starten:

```bash
npm start
```

Die Anwendung öffnet sich automatisch unter [http://localhost:3000](http://localhost:3000) in Ihrem Browser.

### Produktion

Um einen produktionsfertigen Build zu erstellen:

```bash
npm run build
```

## Anwendungsstruktur

- `/src/components`: Wiederverwendbare UI-Komponenten
- `/src/pages`: Hauptseiten der Anwendung
- `/src/context`: React Context für Zustandsverwaltung
- `/src/themes`: Styling und Theme-Konfiguration
- `/src/assets`: Bilder und andere statische Assets

## Technologie-Stack

- React (Frontend-Bibliothek)
- React Router (Routing)
- Styled Components (CSS-in-JS-Styling)
- Framer Motion (Animationen)
- Material UI Icons (Symbolbibliothek)

## Theming

Die App unterstützt drei verschiedene Themes:
- **Hell**: Heller Hintergrund, iOS-inspirierte Farben
- **Dunkel**: Dunkler Hintergrund, angepasste iOS-Dunkelmodus-Farben
- **Niedlich**: Heller Hintergrund mit pastellfarbenen Akzenten

Themes können in der App über das Dashboard angepasst werden.

## Vorläufige Daten

In dieser Version werden Daten lokal im Browser-Speicher (localStorage) gespeichert. Eine zukünftige Version wird die Integration mit einer MySQL-Datenbank enthalten.
