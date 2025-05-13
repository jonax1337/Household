// Update Service für automatische PWA-Updates

/**
 * Service zur Überprüfung und Verarbeitung von PWA-Updates
 * Ermöglicht regelmäßige Überprüfungen im Hintergrund und zeigt Update-Benachrichtigungen an
 */
class UpdateService {
  constructor() {
    this.currentVersion = null;
    this.updateCheckInterval = 3600000; // Standard: Stündliche Überprüfung (3.600.000 ms)
    this.updateCheckTimer = null;
    this.isUpdateAvailable = false;
    this.lastChecked = null;
  }

  /**
   * Initialisiert den Update-Service und beginnt mit regelmäßigen Überprüfungen
   * @param {Object} options - Konfigurationsoptionen
   * @param {number} options.checkInterval - Intervall für Überprüfungen in Millisekunden
   * @returns {Promise<boolean>} - Erfolg der Initialisierung
   */
  async init(options = {}) {
    console.log('[UpdateService] Initialisiere Update-Service');
    
    // Konfigurationsoptionen anwenden
    if (options.checkInterval) {
      this.updateCheckInterval = options.checkInterval;
    }

    try {
      // Aktuelle Version ermitteln
      this.currentVersion = await this.getCurrentVersion();
      console.log('[UpdateService] Aktuelle Version:', this.currentVersion);
      
      // Überprüfe sofort beim Start
      await this.checkForUpdates();
      
      // Starte regelmäßige Überprüfungen
      this.startPeriodicChecks();
      
      return true;
    } catch (error) {
      console.error('[UpdateService] Fehler bei der Initialisierung:', error);
      return false;
    }
  }

  /**
   * Überprüft auf Updates durch Vergleich der aktuellen Version mit der Service Worker Version
   * @returns {Promise<boolean>} - true wenn ein Update verfügbar ist
   */
  async checkForUpdates() {
    console.log('[UpdateService] Überprüfe auf Updates...');
    this.lastChecked = new Date();
    
    try {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        console.warn('[UpdateService] Kein aktiver Service Worker gefunden');
        return false;
      }
      
      // Fordere Service Worker auf, die aktuellste Version zu laden
      await navigator.serviceWorker.ready;
      
      // Cache-Busting durch Hinzufügen eines Zeitstempels
      const timestamp = new Date().getTime();
      const swUrl = `${window.location.origin}/serviceWorker.js?v=${timestamp}`;
      
      // Registriere den Service Worker erneut, um auf Updates zu prüfen
      const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
      
      // Prüfe, ob ein Update verfügbar ist
      if (registration.waiting) {
        console.log('[UpdateService] Update verfügbar (waiting state)');
        this.isUpdateAvailable = true;
        return true;
      }
      
      // Überprüfe zusätzlich durch direkten Versionsvergleich
      const latestVersion = await this.getLatestVersion();
      if (latestVersion && this.currentVersion && latestVersion !== this.currentVersion) {
        console.log('[UpdateService] Update verfügbar:', this.currentVersion, '->', latestVersion);
        this.isUpdateAvailable = true;
        return true;
      }
      
      console.log('[UpdateService] Keine Updates verfügbar');
      this.isUpdateAvailable = false;
      return false;
    } catch (error) {
      console.error('[UpdateService] Fehler bei der Update-Überprüfung:', error);
      return false;
    }
  }

  /**
   * Startet regelmäßige Update-Überprüfungen im Hintergrund
   */
  startPeriodicChecks() {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
    }
    
    console.log(`[UpdateService] Starte regelmäßige Update-Überprüfungen alle ${this.updateCheckInterval/1000} Sekunden`);
    
    this.updateCheckTimer = setInterval(async () => {
      console.log('[UpdateService] Geplante Update-Überprüfung');
      const hasUpdate = await this.checkForUpdates();
      
      // Benachrichtigung anzeigen, wenn ein Update verfügbar ist
      if (hasUpdate) {
        this.notifyUpdateAvailable();
      }
    }, this.updateCheckInterval);
  }

  /**
   * Stoppt regelmäßige Update-Überprüfungen
   */
  stopPeriodicChecks() {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
      console.log('[UpdateService] Regelmäßige Update-Überprüfungen gestoppt');
    }
  }

  /**
   * Ermittelt die aktuelle Version des Service Workers
   * @returns {Promise<string>} - Aktuelle Version
   */
  async getCurrentVersion() {
    try {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        console.warn('[UpdateService] Kein aktiver Service Worker für Versionsabfrage');
        return 'unknown';
      }
      
      await navigator.serviceWorker.ready;
      
      return new Promise((resolve) => {
        // Verwende MessageChannel für die Kommunikation
        const messageChannel = new MessageChannel();
        
        // Handler für die Antwort
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'UPDATE_CHECK_RESULT') {
            resolve(event.data.version);
          } else {
            resolve('unknown');
          }
        };
        
        // Anfrage an Service Worker senden
        navigator.serviceWorker.controller.postMessage(
          { type: 'CHECK_UPDATE' },
          [messageChannel.port2]
        );
        
        // Timeout für den Fall, dass keine Antwort kommt
        setTimeout(() => resolve('unknown'), 3000);
      });
    } catch (error) {
      console.error('[UpdateService] Fehler bei der Versionsabfrage:', error);
      return 'unknown';
    }
  }

  /**
   * Ermittelt die neueste verfügbare Version durch erneute Registration des Service Workers
   * @returns {Promise<string>} - Neueste Version
   */
  async getLatestVersion() {
    try {
      // Cache-Busting durch Hinzufügen eines Zeitstempels
      const timestamp = new Date().getTime();
      const swUrl = `${window.location.origin}/serviceWorker.js?v=${timestamp}`;
      
      // Hole den aktuellen Service Worker ohne ihn zu registrieren
      const response = await fetch(swUrl);
      if (!response.ok) {
        throw new Error(`Fetch fehlgeschlagen: ${response.status}`);
      }
      
      const text = await response.text();
      // Extrahiere die Version aus dem Service Worker Code
      const versionMatch = text.match(/const SW_VERSION = ['"](.*?)['"];/);
      
      if (versionMatch && versionMatch[1]) {
        return versionMatch[1];
      }
      
      return 'unknown';
    } catch (error) {
      console.error('[UpdateService] Fehler bei der Abfrage der neuesten Version:', error);
      return 'unknown';
    }
  }

  /**
   * Benachrichtigt den Benutzer über ein verfügbares Update
   */
  notifyUpdateAvailable() {
    // Prüfen, ob Browser-Benachrichtigungen unterstützt werden
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('App-Update verfügbar', {
        body: 'Tippe hier, um die neueste Version zu laden',
        icon: '/icons/android-chrome-192x192.png',
        requireInteraction: true
      });
      
      notification.onclick = () => {
        console.log('[UpdateService] Update-Benachrichtigung angeklickt');
        this.applyUpdate();
        notification.close();
      };
    }
    
    // Event für die App auslösen, um UI-Benachrichtigung anzuzeigen
    const updateEvent = new CustomEvent('appUpdateAvailable');
    window.dispatchEvent(updateEvent);
  }

  /**
   * Wendet das verfügbare Update an
   */
  async applyUpdate() {
    console.log('[UpdateService] Wende Update an');
    
    if (!navigator.serviceWorker) {
      console.warn('[UpdateService] Service Worker wird nicht unterstützt');
      return false;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Falls ein wartender Service Worker existiert, aktiviere ihn
      if (registration.waiting) {
        console.log('[UpdateService] Aktiviere wartenden Service Worker');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      
      // Andernfalls erzwinge eine vollständige Aktualisierung
      console.log('[UpdateService] Kein wartender Service Worker, erzwinge Neuladen');
      window.location.reload();
      return true;
    } catch (error) {
      console.error('[UpdateService] Fehler beim Anwenden des Updates:', error);
      return false;
    }
  }

  /**
   * Informiert, ob ein Update verfügbar ist
   * @returns {boolean} - true wenn ein Update verfügbar ist
   */
  hasUpdate() {
    return this.isUpdateAvailable;
  }

  /**
   * Gibt den Zeitpunkt der letzten Überprüfung zurück
   * @returns {Date|null} - Zeitpunkt der letzten Überprüfung oder null
   */
  getLastCheckedTime() {
    return this.lastChecked;
  }
}

// Singleton-Instanz exportieren
const updateService = new UpdateService();
export default updateService;
