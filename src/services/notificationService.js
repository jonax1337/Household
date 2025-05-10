import axios from 'axios';

// API-Basis-URL von der api.js übernehmen (gleiche Logik wie in anderen Services)
const getBaseUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  if (window.location.port === '3000') {
    return `${protocol}//${hostname}:5000`;
  }
  
  return `${protocol}//${hostname}`;
};

const BASE_URL = getBaseUrl();

// Axios-Instanz für API-Aufrufe
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor für Token-Hinzufügung
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['x-auth-token'] = token;
  }
  return config;
});

// VAPID-Schlüssel vom Server für WebPush
const PUBLIC_VAPID_KEY = 'BBw49gSTEPK0ucHMmyIqQ26aVPxcGfQp0xtfU7uDm9wZOz21afVNPQ0zaIafAJiusbwbYe9NOjunGk1Mxnug5yg';

/**
 * Notification-Service für die Verwaltung von Push-Benachrichtigungen
 */
const notificationService = {
  /**
   * Prüft, ob der Browser Push-Benachrichtigungen unterstützt
   */
  isPushSupported: () => {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  },

  /**
   * Fragt Berechtigung für Push-Benachrichtigungen an
   */
  requestPermission: async () => {
    if (!notificationService.isPushSupported()) {
      throw new Error('Push-Benachrichtigungen werden nicht unterstützt');
    }

    const permission = await Notification.requestPermission();
    return permission;
  },

  /**
   * Gibt den aktuellen ServiceWorker zurück
   */
  getServiceWorkerRegistration: async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('ServiceWorker wird nicht unterstützt');
    }

    return navigator.serviceWorker.ready;
  },

  /**
   * Konvertiert einen Base64-String in ein Uint8Array
   * Benötigt für VAPID-Schlüssel
   */
  urlBase64ToUint8Array: (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  },

  /**
   * Abonniert den Benutzer für Push-Benachrichtigungen
   * @param {number} [apartmentId] - Optional: Die ID der Wohnung (wenn nicht angegeben, wird versucht, automatisch eine zu bestimmen)
   */
  subscribeToPush: async (apartmentId = null) => {
    try {
      console.log('Push-Subscription wird erstellt...');
      
      if (!notificationService.isPushSupported()) {
        throw new Error('Push-Benachrichtigungen werden nicht unterstützt');
      }
  
      // Prüfe, ob die Berechtigung erteilt wurde
      if (Notification.permission !== 'granted') {
        const permission = await notificationService.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Keine Berechtigung für Benachrichtigungen');
        }
      }

      // Service Worker holen
      const registration = await notificationService.getServiceWorkerRegistration();
      console.log('ServiceWorker für Push:', registration);
      
      // Vorhandene Subscription prüfen
      let subscription = await registration.pushManager.getSubscription();
      
      // Falls keine Subscription existiert, eine neue erstellen
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: notificationService.urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
        console.log('Neue Push-Subscription erstellt:', subscription);
      } else {
        console.log('Bestehende Push-Subscription gefunden:', subscription);
      }
      
      // Zur späteren Identifikation den Benutzer abrufen
      // Es gibt mehrere mögliche Speicherorte für die Benutzer-ID in dieser App
      let userId = null;
      
      // Methode 1: Direkt aus dem token entschlüsseln
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Token-Payload entschlüsseln (ohne Signaturprüfung)
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          if (payload && payload.id) {
            userId = payload.id;
            console.log('Benutzer-ID aus Token geladen:', userId);
          }
        } catch (error) {
          console.warn('Fehler beim Entschlüsseln des Tokens:', error);
        }
      }
      
      // Methode 2: Aus dem 'user' Objekt
      if (!userId) {
        try {
          const userJson = localStorage.getItem('user');
          if (userJson) {
            const user = JSON.parse(userJson);
            if (user && user.id) {
              userId = user.id;
              console.log('Benutzer-ID aus user-Objekt geladen:', userId);
            }
          }
        } catch (error) {
          console.warn('Fehler beim Laden des user-Objekts:', error);
        }
      }
      
      // Methode 3: Aus currentUser
      if (!userId) {
        try {
          const currentUserJson = localStorage.getItem('currentUser');
          if (currentUserJson) {
            const currentUser = JSON.parse(currentUserJson);
            if (currentUser && currentUser.id) {
              userId = currentUser.id;
              console.log('Benutzer-ID aus currentUser geladen:', userId);
            }
          }
        } catch (error) {
          console.warn('Fehler beim Laden des currentUser-Objekts:', error);
        }
      }
      
      if (!userId) {
        throw new Error('Benutzer-ID konnte nicht ermittelt werden - bitte neu einloggen');
      }
      
      // Zuerst versuchen, die gewählte Wohnung aus dem localStorage zu laden, falls keine explizit angegeben wurde
      let finalApartmentId = apartmentId;
      if (!finalApartmentId) {
        try {
          const selectedApartment = JSON.parse(localStorage.getItem('selectedApartment'));
          if (selectedApartment && selectedApartment.id) {
            finalApartmentId = selectedApartment.id;
            console.log(`Verwende ausgewählte Wohnung aus localStorage: ${finalApartmentId}`);
          }
        } catch (error) {
          console.warn('Fehler beim Laden der ausgewählten Wohnung:', error);
        }
      }
      
      // Daten für die Speicherung vorbereiten
      const subscriptionData = {
        subscription: subscription,
        userId: userId,
        apartmentId: finalApartmentId // kann null sein, der Server wählt dann automatisch eine
      };
      
      console.log('Sende Subscription an Server:', subscriptionData);
      
      try {
        // Subscription an Backend senden mit ausführlicher Fehlerbehandlung
        const response = await api.post('/notifications/subscribe', subscriptionData);
        console.log('Push-Subscription erfolgreich gespeichert:', response.data);
      } catch (saveError) {
        console.error('FEHLER BEIM SPEICHERN DER SUBSCRIPTION:', saveError);
        console.error('Server-Antwort:', saveError.response ? saveError.response.data : 'Keine Antwort');
        console.error('Anfrage-URL:', saveError.config ? saveError.config.url : 'Unbekannt');
        console.error('HTTP-Status:', saveError.response ? saveError.response.status : 'Unbekannt');
        throw new Error(`Subscription konnte nicht gespeichert werden: ${saveError.message}`);
      }
      return subscription;
    } catch (error) {
      console.error('Fehler beim Abonnieren von Push-Benachrichtigungen:', error);
      throw error;
    }
  },

  /**
   * Aktive Subscription löschen und vom Server entfernen
   */
  unsubscribeFromPush: async () => {
    try {
      // Service Worker holen
      const registration = await notificationService.getServiceWorkerRegistration();
      
      // Vorhandene Subscription prüfen
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Subscription beim Browser löschen
        await subscription.unsubscribe();
        
        // Subscription auch vom Server löschen
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id;
        
        if (userId) {
          await api.post('/notifications/unsubscribe', {
            userId: userId,
            endpoint: subscription.endpoint
          });
        }
        
        console.log('Push-Subscription erfolgreich gelöscht');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Fehler beim Abbestellen von Push-Benachrichtigungen:', error);
      throw error;
    }
  },

  /**
   * Sendet eine Push-Benachrichtigung an alle Benutzer eines Apartments (außer den Absender)
   */
  sendNotificationToApartment: async (apartmentId, notification, excludeUserId = null) => {
    try {
      if (!apartmentId || !notification) {
        throw new Error('Apartment-ID und Benachrichtigung sind erforderlich');
      }
      
      // Benutzer-ID des aktuellen Benutzers zur Ausnahmeliste hinzufügen
      if (!excludeUserId) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        excludeUserId = user.id;
      }
      
      // Benachrichtigung an den Server senden
      const response = await api.post('/notifications/send', {
        apartmentId: apartmentId,
        notification: notification,
        excludeUserId: excludeUserId
      });
      
      console.log('Benachrichtigung gesendet:', response.data);
      return response.data;
    } catch (error) {
      console.error('Fehler beim Senden der Benachrichtigung:', error);
      throw error;
    }
  },

  /**
   * Helper zur Erstellung konsistenter Benachrichtigungs-Farben basierend auf Wichtigkeit
   */
  getNotificationColor: (priority = 'normal') => {
    const colors = {
      low: '#4a90e2',      // Blau für informative Benachrichtigungen
      normal: '#605CFF',   // Standard-App-Farbe
      medium: '#f6c343',   // Gelb für wichtige Benachrichtigungen
      high: '#e95f5c',     // Rot für kritische Benachrichtigungen
      success: '#4CAF50',  // Grün für erfolgreiche Aktionen
      warning: '#FF9800'   // Orange für Warnungen
    };
    return colors[priority] || colors.normal;
  },

  /**
   * Generiert ein Emoji basierend auf der Priorität oder dem Typ
   */
  getNotificationEmoji: (type = 'info', useEmoji = true) => {
    if (!useEmoji) return '';
    
    const emojis = {
      info: '💬',      // Sprechblase
      task: '📅',       // Kalender
      success: '✅',       // Grüner Haken
      warning: '⚠️',    // Warnung
      error: '❌',         // Kreuz
      money: '💰',       // Geldsack
      shopping: '🛍️',   // Einkaufstasche
      message: '📲',      // Handy
      party: '🎉',       // Party-Popper
      star: '⭐'           // Stern
    };
    return emojis[type] || '';
  },

  /**
   * Erzeugt ein Badge-Icon basierend auf der Priorität oder dem Typ
   */
  getNotificationBadge: (type = 'info') => {
    // Hier könnte man verschiedene Badge-Icons zurückgeben,
    // falls du mehrere Icons hinzufügen möchtest
    return '/icons/android-chrome-192x192.png';
  },

  /**
   * Erzeugt ein optimales Vibrationsmuster basierend auf der Priorität
   */
  getVibrationPattern: (priority = 'normal') => {
    // Verschiedene Vibrationsmuster für verschiedene Prioritäten
    // Standard: 100ms AN, 50ms AUS, 100ms AN
    const patterns = {
      low: [100],                           // Kurz und sanft
      normal: [100, 50, 100],               // Standard-Pattern
      medium: [100, 50, 100, 50, 100],      // Mehrfaches Pattern für wichtigere Nachrichten
      high: [200, 100, 200, 100, 200],      // Länger und intensiver für dringende Nachrichten
      critical: [300, 150, 300, 150, 300],  // Sehr lange für kritische Benachrichtigungen
      silent: []                            // Kein Vibrieren für leise Benachrichtigungen
    };
    return patterns[priority] || patterns.normal;
  },
  
  /**
   * Erweiterte modulare Methode zum Anzeigen von lokalen Benachrichtigungen
   * @param {Object} config - Konfigurationsobjekt für die Benachrichtigung
   * @param {string} config.title - Titel der Benachrichtigung
   * @param {string} config.body - Text der Benachrichtigung
   * @param {string} config.type - Art der Benachrichtigung (info, task, success, warning, error, money, shopping, message, party, star)
   * @param {string} config.priority - Priorität der Benachrichtigung (low, normal, medium, high, critical, silent)
   * @param {boolean} config.useEmoji - Ob ein Emoji im Titel angezeigt werden soll
   * @param {string} config.url - URL, zu der die Benachrichtigung führen soll
   * @param {Object} config.data - Zusätzliche Daten für die Benachrichtigung
   * @param {Array} config.actions - Benutzerdefinierte Aktionen für die Benachrichtigung
   * @param {string} config.tag - Eindeutiger Tag für die Benachrichtigung (für Gruppierung)
   * @param {boolean} config.renotify - Ob der Benutzer über neue Benachrichtigungen mit dem gleichen Tag informiert werden soll
   * @param {boolean} config.requireInteraction - Ob die Benachrichtigung geöffnet bleiben soll, bis der Benutzer interagiert
   */
  createNotification: async (config = {}) => {
    try {
      if (Notification.permission !== 'granted') {
        throw new Error('Keine Berechtigung für Benachrichtigungen');
      }
      
      const registration = await notificationService.getServiceWorkerRegistration();
      
      const type = config.type || 'info';
      const priority = config.priority || 'normal';
      const useEmoji = config.useEmoji !== undefined ? config.useEmoji : true;
      
      // Emoji basierend auf Typ hinzufügen, wenn aktiviert
      const emoji = notificationService.getNotificationEmoji(type, useEmoji);
      const title = useEmoji && emoji ? `${emoji} ${config.title}` : config.title;
      
      // Basis-Konfiguration für die Benachrichtigung
      const notificationOptions = {
        body: config.body || 'Keine weiteren Details',
        icon: config.icon || '/icons/android-chrome-192x192.png',
        badge: notificationService.getNotificationBadge(type),
        vibrate: config.vibrate || notificationService.getVibrationPattern(priority),
        silent: priority === 'silent',  // Leise Benachrichtigung, wenn Priorität 'silent' ist
        data: {
          dateOfArrival: Date.now(),
          url: config.url || '/',
          type: type,
          priority: priority,
          ...(config.data || {})  // Alle benutzerdefinierten Daten hinzufügen
        },
        actions: config.actions || [
          {
            action: 'view',
            title: 'Ansehen'
          },
          {
            action: 'close',
            title: 'Schließen'
          }
        ],
        tag: config.tag,                               // Optional: Tag für Gruppierung
        renotify: config.renotify !== undefined ? config.renotify : false,  // Optional: Erneute Benachrichtigung bei gleichem Tag
        requireInteraction: config.requireInteraction !== undefined ? config.requireInteraction : false  // Optional: Benötigt Benutzerinteraktion zum Schließen
      };
      
      // Wenn tag gesetzt ist, aber renotify nicht, dann setze renotify auf true
      if (notificationOptions.tag && notificationOptions.renotify === undefined) {
        notificationOptions.renotify = true;
      }
      
      await registration.showNotification(title, notificationOptions);
      return true;
    } catch (error) {
      console.error('Fehler beim Anzeigen der Benachrichtigung:', error);
      throw error;
    }
  },
  
  /**
   * Lokale Test-Benachrichtigung anzeigen (ohne Push)
   * (Alte Methode, bleibt für Kompatibilität erhalten)
   */
  showLocalNotification: async (title, options = {}) => {
    // Konvertiere das alte Format in das neue modulare Format
    return notificationService.createNotification({
      title: title,
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      vibrate: options.vibrate,
      data: options.data,
      actions: options.actions,
      useEmoji: false // Keine automatischen Emojis für Abwärtskompatibilität
    });
  }
};

export default notificationService;
