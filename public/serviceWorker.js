// Service Worker Version für Debug
const SW_VERSION = 'v2.1.3';
// Version als Meta-Daten für Update-Überprüfungen
self.SW_VERSION = SW_VERSION;
// Cache-Namen mit Versionierung für einfache Updates
const CACHE_NAME = 'household-app' + SW_VERSION.toString();
console.log('[ServiceWorker] Version ' + SW_VERSION + ' wird geladen');

// Bestimme die Basis-URL basierend auf der aktuellen Umgebung
const getBaseUrl = () => {
  // In Entwicklungsumgebung ist es '/' (lokaler Server)
  // In Produktionsumgebung (Render.com) ist es leer, damit URLs relativ sind
  return '';
};

const baseUrl = getBaseUrl();
console.log('[ServiceWorker] Verwende Base-URL:', baseUrl || '/');

// Bei Installation des ServiceWorkers
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install-Event');
  // skipWaiting erzwingt sofortige Aktivierung ohne Neuladen
  self.skipWaiting();
});

// Bei Aktivierung des ServiceWorkers (nach Installation)
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Aktiviert');
  
  // Sorgt dafür, dass der Service Worker sofort die Kontrolle übernimmt
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Alter Cache wird gelöscht:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handler für Messages vom Client (z.B. skipWaiting)
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Nachricht empfangen:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Aktiviere sofort durch skipWaiting()');
    self.skipWaiting();
  } else if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    console.log('[ServiceWorker] Sende Test-Benachrichtigung');
    
    // Direkte Test-Benachrichtigung
    self.registration.showNotification('Test-Benachrichtigung', {
      body: 'Dies ist eine direkte Benachrichtigung (kein Push)',
      icon: '/icons/android-chrome-192x192.png',
      badge: '/icons/android-chrome-192x192.png',
      vibrate: [100, 50, 100],
      requireInteraction: true
    }).then(() => {
      console.log('[ServiceWorker] Test-Benachrichtigung erfolgreich angezeigt');
    }).catch(err => {
      console.error('[ServiceWorker] Fehler bei Test-Benachrichtigung:', err);
    });
  } else if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Sende die aktuelle Service Worker Version zurück
    console.log('[ServiceWorker] Antwort auf Update-Check mit Version:', self.SW_VERSION);
    event.ports[0].postMessage({
      type: 'UPDATE_CHECK_RESULT',
      version: self.SW_VERSION,
      timestamp: Date.now()
    });
  }
});

// Bei Fetch-Anfragen
self.addEventListener('fetch', (event) => {
  // Ignoriere nicht-cacheable URLs (chrome-extension://, data:, etc.)
  const url = new URL(event.request.url);
  
  // Nur http/https Requests behandeln
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // Strategie: Network first, dann Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Kopie der Response für Cache erstellen
        const responseClone = response.clone();
        
        caches.open(CACHE_NAME)
          .then((cache) => {
            // Nur erfolgreiche GET-Anfragen cachen
            if (event.request.method === 'GET' && response.status === 200) {
              try {
                cache.put(event.request, responseClone);
              } catch (e) {
                console.log('Cache error:', e);
              }
            }
          })
          .catch(err => console.log('Cache open error:', err));
        
        return response;
      })
      .catch(() => {
        // Wenn Netzwerkanfrage fehlschlägt, aus Cache laden
        return caches.match(event.request);
      })
  );
});

// Push-Benachrichtigungen empfangen
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push-Event empfangen', event);
  
  // Prüfen, ob event.data vorhanden ist
  if (!event.data) {
    console.log('[ServiceWorker] Keine Daten im Push-Event');
    return;
  }
  
  let notificationData;
  const rawData = event.data.text();
  console.log('[ServiceWorker] Empfangene Rohdaten:', rawData);
  
  try {
    notificationData = JSON.parse(rawData);
    console.log('[ServiceWorker] Geparste Daten:', notificationData);
    
    // Formatiere Zeitstempel, falls vorhanden
    if (notificationData.data && notificationData.data.timestamp) {
      const date = new Date(notificationData.data.timestamp);
      const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      
      // Füge Zeitstempel zum Body hinzu, wenn nicht bereits vorhanden
      if (!notificationData.body.includes(timeStr)) {
        notificationData.body = `${notificationData.body} (${timeStr})`;
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Fehler beim Parsen der Push-Daten:', error);
    
    // Fallback-Benachrichtigung zeigen, wenn Parsing fehlschlägt
    notificationData = {
      title: 'Neue Benachrichtigung',
      body: 'Keine weiteren Details verfügbar',
    };
  }
  
  // Task-ID für Tag extrahieren
  let taskId = 'notification';
  if (notificationData.data && notificationData.data.taskId) {
    taskId = `task-${notificationData.data.taskId}`;
  } else if (notificationData.data && notificationData.data.type) {
    taskId = notificationData.data.type;
  }
  
  // Übernehme vibrate-Muster aus Benachrichtigungsdaten oder Fallback
  const vibrationPattern = notificationData.vibrate || [100, 50, 100];
  
  // Alle vorhandenen Daten übernehmen oder Fallback verwenden
  const options = {
    body: notificationData.body || 'Keine Details verfügbar',
    icon: notificationData.icon || '/icons/android-chrome-192x192.png',
    badge: notificationData.badge || '/icons/android-chrome-192x192.png',
    vibrate: vibrationPattern,
    data: {
      dateOfArrival: Date.now(),
      url: notificationData.data?.url || '/',
      // Alle originalen Daten für Aktionen übernehmen
      originalData: rawData,
      userName: notificationData.data?.userName || null,
      taskTitle: notificationData.data?.taskTitle || null,
      pointsAwarded: notificationData.data?.pointsAwarded || 0,
      taskColor: notificationData.data?.taskColor || '#4a90e2',
      type: notificationData.data?.type || 'unknown'
    },
    actions: [
      {
        action: 'view',
        title: 'Ansehen'
      },
      {
        action: 'close',
        title: 'Schließen'
      }
    ],
    // Sicherstellen, dass die Benachrichtigung angezeigt wird
    requireInteraction: true,
    tag: taskId, // Tag ist erforderlich, wenn renotify gesetzt ist
    renotify: true
  };
  
  console.log('[ServiceWorker] Zeige Benachrichtigung an:', notificationData.title);
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => {
        console.log('[ServiceWorker] Benachrichtigung erfolgreich angezeigt');
      })
      .catch(err => {
        console.error('[ServiceWorker] Fehler beim Anzeigen der Benachrichtigung:', err);
      })
  );
});

// Klick auf Benachrichtigung
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then((windowClients) => {
      // Prüfen, ob bereits ein Fenster/Tab geöffnet ist
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Wenn kein Fenster geöffnet ist, neues öffnen
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
