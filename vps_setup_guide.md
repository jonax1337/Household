# VPS-Setup-Anleitung fu00fcr Household App

## u00dcberblick

Diese Anleitung fu00fchrt dich durch die Installation und Konfiguration deiner Household-App auf deinem VPS mit der Domain `app.laux.media` und der IP `176.103.220.130`.

## 1. VPS-Vorbereitung

### Node.js und npm installieren

```bash
# Repository aktualisieren
sudo apt update

# Node.js Repository hinzufu00fcgen (v20.x)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js installieren
sudo apt install -y nodejs

# Version pru00fcfen
node --version  # Sollte v20.x anzeigen
npm --version
```

### PM2 global installieren

```bash
sudo npm install -g pm2
```

### Nginx installieren

```bash
sudo apt install -y nginx
```

### Firewall konfigurieren (UFW)

```bash
# Standardports erlauben
sudo ufw allow 'Nginx Full'  # Erlaubt Ports 80 und 443
sudo ufw allow ssh           # Port 22 fu00fcr SSH-Zugriff

# Node.js-Anwendungsport (nur fu00fcr lokalen Zugriff, nicht direkt u00fcber Internet erreichbar)
# sudo ufw allow 5000         # Optional, wenn direkter Zugriff benu00f6tigt wird

# Firewall aktivieren
sudo ufw enable

# Status anzeigen
sudo ufw status
```

## 2. Bereitstellung der Anwendung

### Applikationsverzeichnisse erstellen

```bash
sudo mkdir -p /var/www/household
sudo chown -R $USER:$USER /var/www/household
```

### Ausfu00fchren des Deployment-Skripts von deinem lokalen Computer

Auf deinem lokalen Computer:

```bash
chmod +x deploy.sh
./deploy.sh
```

## 3. Nginx als Reverse Proxy konfigurieren

### SSL-Zertifikat mit Let's Encrypt einrichten

```bash
# Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# Zertifikat generieren (folge den Anweisungen)
sudo certbot --nginx -d app.laux.media
```

### Nginx-Konfiguration einrichten

```bash
# Kopiere die bereitgestellte Nginx-Konfiguration auf den Server
sudo nano /etc/nginx/sites-available/household
```

Fu00fcge den Inhalt von `nginx.conf` ein und speichere die Datei.

```bash
# Aktiviere die Site
sudo ln -s /etc/nginx/sites-available/household /etc/nginx/sites-enabled/

# Entferne die Standardkonfiguration (optional)
sudo rm /etc/nginx/sites-enabled/default

# Konfiguration testen
sudo nginx -t

# Nginx neustarten
sudo systemctl restart nginx
```

## 4. u00dcberpru00fcfung und Wartung

### Status der Anwendung u00fcberpru00fcfen

```bash
pm2 status
pm2 logs household-server
```

### Automatischen Neustart mit PM2 einrichten

```bash
pm2 startup  # Folge den Anweisungen
pm2 save       # Speichere die aktuelle Prozessliste
```

## 5. Fehlersuche

### Nginx-Logs anzeigen

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Anwendungslogs anzeigen

```bash
pm2 logs household-server
```

### Firewall-Status

```bash
sudo ufw status
```

## 6. Aktualisierung der Anwendung

Fu00fchre einfach das Deployment-Skript erneut aus, um die Anwendung zu aktualisieren:

```bash
./deploy.sh
```