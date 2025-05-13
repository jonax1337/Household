// Cache-Namen mit Versionierung für einfache Updates
const CACHE_NAME = 'household-app-v3';

// Service Worker Version für Debug
const SW_VERSION = 'v3.0.0';
console.log('[ServiceWorker] Version ' + SW_VERSION + ' wird geladen');

// Bestimme die Basis-URL basierend auf der aktuellen Umgebung
const getBaseUrl = () => {
  // In Entwicklungsumgebung ist es '/' (lokaler Server)
  // In Produktionsumgebung (Render.com) ist es leer, damit URLs relativ sind
  return '';
};

const baseUrl = getBaseUrl();
console.log('[ServiceWorker] Verwende Base-URL:', baseUrl || '/');

// Cache-URLs mit korrigierten Pfaden für Render.com
const URLS_TO_CACHE = [
  baseUrl + '/',
  baseUrl + '/index.html',
  baseUrl + 'site.webmanifest', // Ohne führenden Slash
  baseUrl + 'icons/android-chrome-192x192.png', // Ohne führenden Slash
  baseUrl + 'icons/android-chrome-512x512.png', // Ohne führenden Slash
  baseUrl + 'icons/apple-touch-icon.png', // Ohne führenden Slash
  baseUrl + 'icons/favicon-16x16.png', // Ohne führenden Slash
  baseUrl + 'icons/favicon-32x32.png' // Ohne führenden Slash
];

// Bei Installation des ServiceWorkers
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install-Event');
  // skipWaiting erzwingt sofortige Aktivierung ohne Neuladen
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache geöffnet');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
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
  
  // Periodic Sync registrieren, wenn verfügbar
  if ('periodicSync' in self.registration) {
    const registerPeriodicSync = async () => {
      try {
        // Bestehende Tags prüfen und ggf. alte entfernen
        const tags = await self.registration.periodicSync.getTags();
        console.log('[ServiceWorker] Bestehende Periodic Sync Tags:', tags);
        
        // Verschiedene Periodic Sync Intervalle für verschiedene Datentypen
        const syncConfig = [
          { tag: 'sync-tasks', minInterval: 60 * 15 },        // Alle 15 Minuten
          { tag: 'sync-shopping', minInterval: 60 * 30 },      // Alle 30 Minuten
          { tag: 'sync-transactions', minInterval: 60 * 60 },   // Stündlich
          { tag: 'sync-messages', minInterval: 60 * 3 }         // Alle 3 Minuten
        ];
        
        // Registriere alle Sync-Tags
        for (const config of syncConfig) {
          await self.registration.periodicSync.register(config.tag, {
            minInterval: config.minInterval * 1000 // In Millisekunden umwandeln
          });
          console.log(`[ServiceWorker] Periodic Sync registriert: ${config.tag}`);
        }
      } catch (error) {
        console.error('[ServiceWorker] Fehler beim Registrieren von Periodic Sync:', error);
      }
    };
    
    registerPeriodicSync();
  } else {
    console.log('[ServiceWorker] Periodic Sync wird vom Browser nicht unterstützt');
  }
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

// Background Sync Event Handler
self.addEventListener('sync', async (event) => {
  console.log('[ServiceWorker] Background Sync Event:', event.tag);
  
  if (event.tag.startsWith('sync-')) {
    // Extrahiere den Typ aus dem Tag (z.B. 'tasks' aus 'sync-tasks')
    const syncType = event.tag.replace('sync-', '');
    
    event.waitUntil(processSyncEvent(syncType));
  }
});

// Periodic Sync Event Handler
self.addEventListener('periodicsync', async (event) => {
  console.log('[ServiceWorker] Periodic Sync Event:', event.tag);
  
  if (event.tag.startsWith('sync-')) {
    // Extrahiere den Typ aus dem Tag (z.B. 'tasks' aus 'sync-tasks')
    const syncType = event.tag.replace('sync-', '');
    
    event.waitUntil(processSyncEvent(syncType));
  }
});

// Gemeinsame Funktion zur Bearbeitung von Sync-Events
async function processSyncEvent(syncType) {
  console.log(`[ServiceWorker] Verarbeite ${syncType} Sync`);
  
  // Holen der zu synchronisierenden Daten aus IndexedDB
  try {
    // Öffne IndexedDB
    const db = await openDatabase();
    
    // Hole ungesendete Daten aus der entsprechenden Store
    const pendingItems = await getPendingItems(db, syncType);
    
    if (pendingItems.length === 0) {
      console.log(`[ServiceWorker] Keine ausstehenden ${syncType} zum Synchronisieren`);
      return;
    }
    
    console.log(`[ServiceWorker] Synchronisiere ${pendingItems.length} ${syncType}`);
    
    // API-Endpunkte basierend auf dem Synchronisationstyp
    const apiEndpoints = {
      'tasks': '/api/tasks/sync',
      'shopping': '/api/shopping/sync',
      'transactions': '/api/financial/sync',
      'messages': '/api/messages/sync'
    };
    
    // Synchronisiere mit dem Server
    if (apiEndpoints[syncType]) {
      const response = await fetch(apiEndpoints[syncType], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: pendingItems,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[ServiceWorker] ${syncType} erfolgreich synchronisiert:`, result);
        
        // Markiere Elemente als synchronisiert
        await markItemsAsSynced(db, syncType, pendingItems.map(item => item.id));
        
        // Benachrichtigung an Clients senden, dass Daten aktualisiert wurden
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_COMPLETED',
              syncType: syncType,
              timestamp: Date.now()
            });
          });
        });
        
        // Optional: Zeige eine Benachrichtigung
        if (result.showNotification) {
          await self.registration.showNotification('Synchronisierung abgeschlossen', {
            body: `${pendingItems.length} ${syncType} wurden synchronisiert`,
            icon: '/icons/android-chrome-192x192.png'
          });
        }
      } else {
        throw new Error(`Server-Fehler: ${response.status}`);
      }
    }
  } catch (error) {
    console.error(`[ServiceWorker] Fehler bei ${syncType} Sync:`, error);
    // Sync war nicht erfolgreich, wird automatisch später wiederholt
    throw error; // Wichtig: Error werfen, damit Browser weiß, dass Sync fehlgeschlagen ist
  }
}

// IndexedDB-Zugriffsfunktionen
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('household-offline-db', 1);
    
    request.onerror = event => {
      console.error('[ServiceWorker] IndexedDB Fehler:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    // Falls die Datenbank noch nicht existiert oder aktualisiert werden muss
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Stores für verschiedene Datentypen erstellen
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('shopping')) {
        db.createObjectStore('shopping', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
    };
  });
}

async function getPendingItems(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = event => {
      // Filtere nach ungesendeten Items (syncStatus: 'pending')
      const items = event.target.result.filter(item => item.syncStatus === 'pending');
      resolve(items);
    };
    
    request.onerror = event => {
      reject(event.target.error);
    };
  });
}

async function markItemsAsSynced(db, storeName, itemIds) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    let remaining = itemIds.length;
    let success = true;
    
    // Für jedes Item Status aktualisieren
    itemIds.forEach(id => {
      const getRequest = store.get(id);
      
      getRequest.onsuccess = event => {
        const item = event.target.result;
        if (item) {
          item.syncStatus = 'synced';
          item.lastSyncedAt = Date.now();
          
          const updateRequest = store.put(item);
          
          updateRequest.onsuccess = () => {
            remaining--;
            if (remaining === 0) resolve(success);
          };
          
          updateRequest.onerror = event => {
            console.error('[ServiceWorker] Fehler beim Markieren als synchronisiert:', event.target.error);
            success = false;
            remaining--;
            if (remaining === 0) resolve(success);
          };
        } else {
          remaining--;
          if (remaining === 0) resolve(success);
        }
      };
      
      getRequest.onerror = event => {
        console.error('[ServiceWorker] Fehler beim Abrufen des Items:', event.target.error);
        success = false;
        remaining--;
        if (remaining === 0) resolve(success);
      };
    });
    
    // Falls keine Items übergeben wurden
    if (itemIds.length === 0) {
      resolve(true);
    }
  });
}
