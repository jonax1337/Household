#!/bin/bash

# Server-Setup-Script für die erste Installation auf der VPS
# Dieses Script wird EINMALIG auf dem Server ausgeführt

# Exit bei Fehlern
set -e

# Konfiguration
APP_DIR="/var/www/household"
DOMAIN="app.laux.media"

echo "=== Household Server Setup ==="
echo "Dieses Script führt die Erstinstallation der Household-App durch."

# 1. Verzeichnisse erstellen
echo "1. Erstelle Verzeichnisse..."
mkdir -p $APP_DIR

# 2. Abhängigkeiten installieren
echo "2. Installiere NPM-Abhängigkeiten..."
cd $APP_DIR
npm ci --only=production

# 3. Umgebungsvariablen einrichten
echo "3. Konfiguriere Umgebungsvariablen..."
if [ -f .env.production ]; then
    cp .env.production .env
    echo "   .env.production nach .env kopiert."
else
    echo "   WARNUNG: .env.production nicht gefunden!"
fi

# 4. PM2 konfigurieren
echo "4. Konfiguriere PM2..."
if command -v pm2 &> /dev/null; then
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo "   PM2 wurde konfiguriert und die App gestartet."
else
    echo "   FEHLER: PM2 ist nicht installiert! Bitte installiere es mit 'npm install -g pm2'."
    exit 1
fi

echo ""
echo "=== Setup abgeschlossen! ==="
echo "Die Household App wurde installiert und gestartet."
echo "Nächste Schritte:"
echo "1. Richte Nginx als Reverse Proxy ein"
echo "2. Besorge ein SSL-Zertifikat mit Let's Encrypt"
echo ""
echo "Besuche http://localhost:5000 um zu prüfen, ob der Server läuft."
