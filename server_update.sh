#!/bin/bash

# Update-Script für die Household-App auf dem Server
# Dieses Script aktualisiert die App nach einem Git Pull

# Exit bei Fehlern
set -e

# Konfiguration
APP_DIR="/var/www/household"

echo "=== Household App Update ==="
echo "Aktualisiere die Household-App..."

# 1. Ins Projektverzeichnis wechseln
cd $APP_DIR

# 2. NPM-Abhängigkeiten aktualisieren (falls neue hinzugekommen sind)
echo "1. Aktualisiere NPM-Abhängigkeiten..."
npm ci --only=production

# 3. PM2 neustarten
echo "2. Starte die Anwendung neu..."
if command -v pm2 &> /dev/null; then
    pm2 restart household-server || pm2 start ecosystem.config.js --env production
    echo "   Die Anwendung wurde neugestartet."
else
    echo "   FEHLER: PM2 ist nicht installiert!"
    exit 1
fi

echo ""
echo "=== Update abgeschlossen! ==="
echo "Die Household App wurde erfolgreich aktualisiert."
