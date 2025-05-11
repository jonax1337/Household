# Git-basierte Deployment-Anleitung für Household App

Diese Anleitung beschreibt einen einfachen Git-basierten Workflow für das Deployment deiner Household-App auf deinem VPS-Server.

## Übersicht des Workflows

1. Du pushst deine Änderungen zu einem Git-Repository (z.B. GitHub oder GitLab)
2. Auf deiner VPS klonst du das Repository und führst das Setup-Script aus
3. Bei Updates ziehst du die neuesten Änderungen mit Git und führst das Update-Script aus

## 1. Vorbereitung auf dem lokalen Rechner

### Git-Repository erstellen (falls noch nicht geschehen)

1. Erstelle ein Repository bei GitHub oder GitLab
2. Füge dein lokales Projekt zum Repository hinzu:

```cmd
git remote add origin https://github.com/dein-username/household.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

## 2. Ersteinrichtung auf der VPS

### Verbindung zur VPS herstellen

Verbinde dich mit deiner VPS über SSH oder die Konsole deines Hosting-Anbieters:

```
ssh household@176.103.220.130
```

### Notwendige Software installieren

```bash
# System-Pakete aktualisieren
sudo apt update
sudo apt upgrade -y

# Node.js installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 global installieren
sudo npm install -g pm2

# Git installieren (falls nicht vorhanden)
sudo apt install -y git

# Nginx installieren
sudo apt install -y nginx
```

### Projekt klonen

```bash
# Verzeichnis erstellen
sudo mkdir -p /var/www/
sudo chown -R $USER:$USER /var/www/

# Repository klonen
cd /var/www/
git clone https://github.com/dein-username/household.git household
cd household
```

### Erstinstallation durchführen

```bash
# Script ausführbar machen
chmod +x server_setup.sh

# Erstinstallation durchführen
./server_setup.sh
```

## 3. Nginx als Reverse Proxy einrichten

### SSL-Zertifikat mit Let's Encrypt einrichten

```bash
# Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# Zertifikat generieren (folge den Anweisungen)
sudo certbot --nginx -d app.laux.media
```

### Nginx-Konfiguration einrichten

```bash
# Nginx-Konfiguration erstellen
sudo cp nginx.conf /etc/nginx/sites-available/household

# Konfiguration aktivieren
sudo ln -s /etc/nginx/sites-available/household /etc/nginx/sites-enabled/

# Standardkonfiguration entfernen (optional)
sudo rm /etc/nginx/sites-enabled/default

# Konfiguration testen
sudo nginx -t

# Nginx neustarten
sudo systemctl restart nginx
```

## 4. Updates deployen

Wenn du neue Features entwickelt hast und sie auf den Server bringen möchtest:

### Auf deinem lokalen Rechner

```cmd
git add .
git commit -m "Update: Neue Features hinzugefügt"
git push origin main
```

### Auf deiner VPS

```bash
# Ins Projektverzeichnis wechseln
cd /var/www/household

# Neueste Änderungen pullen
git pull origin main

# Update-Script ausführen
chmod +x server_update.sh
./server_update.sh
```

## 5. Monitoring und Wartung

### PM2-Status überprüfen

```bash
pm2 status
pm2 logs household-server
```

### Nginx-Logs anzeigen

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Fehlerbehebung

### Problem: Die Anwendung startet nicht

Überprüfe die PM2-Logs:
```bash
pm2 logs household-server
```

### Problem: Nginx zeigt "502 Bad Gateway"

Überprüfe, ob deine Node.js-Anwendung läuft:
```bash
pm2 status
```

Überprüfe die Nginx-Konfiguration:
```bash
sudo nginx -t
```
