/**
 * SyncManager.js - Verwaltet Background Sync und Periodic Sync für die Household-App
 * 
 * Stellt Funktionen bereit, um:
 * 1. Daten offline zu speichern
 * 2. Background-Sync für ausstehende Operationen zu registrieren
 * 3. Periodic-Sync für regelmäßige Daten-Updates zu verwalten
 */

class SyncManager {
  constructor() {
    this.dbName = 'household-offline-db';
    this.dbVersion = 1;
    this._db = null;
    this.isPeriodicSyncSupported = false;
    this.checkBackgroundSyncSupport();
  }

  /**
   * Prüft, ob der Browser Background Sync und Periodic Sync unterstützt
   */
  async checkBackgroundSyncSupport() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Background Sync Support prüfen
      if ('sync' in registration) {
        console.log('Background Sync wird unterstützt');
      } else {
        console.warn('Background Sync wird von diesem Browser nicht unterstützt');
      }
      
      // Periodic Sync Support prüfen
      if ('periodicSync' in registration) {
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync',
        });
        
        this.isPeriodicSyncSupported = status.state === 'granted';
        console.log('Periodic Sync wird unterstützt:', this.isPeriodicSyncSupported);
      } else {
        console.warn('Periodic Sync wird von diesem Browser nicht unterstützt');
      }
    }
  }

  /**
   * IndexedDB initialisieren
   */
  async initDatabase() {
    if (this._db) return this._db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = (event) => {
        console.error('IndexedDB konnte nicht geöffnet werden:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Stores für verschiedene Datentypen erstellen, falls nicht vorhanden
        const storeNames = ['tasks', 'shopping', 'transactions', 'messages'];
        
        storeNames.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            store.createIndex('syncStatus', 'syncStatus', { unique: false });
            console.log(`Store '${storeName}' erstellt`);
          }
        });
      };
    });
  }

  /**
   * Speichert ein Item in IndexedDB und markiert es für die Synchronisation
   * @param {string} type - Datentyp (tasks, shopping, transactions, messages)
   * @param {Object} data - Zu speichernde Daten
   */
  async saveItemForSync(type, data) {
    try {
      const db = await this.initDatabase();
      
      // Stelle sicher, dass die Daten eine ID haben und als 'pending' markiert sind
      const itemToSave = {
        ...data,
        id: data.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        syncStatus: 'pending',
        updatedAt: Date.now(),
        offlineCreated: !data.id // Flag um zu kennzeichnen, ob es offline erstellt wurde
      };
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(type, 'readwrite');
        const store = transaction.objectStore(type);
        
        const request = store.put(itemToSave);
        
        request.onsuccess = () => {
          console.log(`Item in '${type}' gespeichert:`, itemToSave);
          // Versuche Background Sync zu registrieren
          this.registerBackgroundSync(type);
          resolve(itemToSave);
        };
        
        request.onerror = (event) => {
          console.error(`Fehler beim Speichern in '${type}':`, event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Fehler bei saveItemForSync:', error);
      throw error;
    }
  }

  /**
   * Registriert Background Sync für einen Datentyp
   * @param {string} type - Datentyp (tasks, shopping, transactions, messages)
   */
  async registerBackgroundSync(type) {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(`sync-${type}`);
        console.log(`Background Sync für '${type}' registriert`);
        return true;
      } catch (error) {
        console.error(`Fehler bei der Background Sync Registrierung für '${type}':`, error);
        return false;
      }
    } else {
      console.warn('Background Sync wird nicht unterstützt');
      return false;
    }
  }

  /**
   * Prüft den Status der Periodic Sync Registrierung
   */
  async getPeriodicSyncStatus() {
    if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
      const registration = await navigator.serviceWorker.ready;
      const tags = await registration.periodicSync.getTags();
      return {
        supported: true,
        registered: tags,
      };
    }
    return { supported: false, registered: [] };
  }

  /**
   * Holt alle ausstehenden Elemente eines bestimmten Typs
   * @param {string} type - Datentyp (tasks, shopping, transactions, messages)
   */
  async getPendingItems(type) {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(type, 'readonly');
      const store = transaction.objectStore(type);
      const index = store.index('syncStatus');
      
      const request = index.getAll('pending');
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Holt alle gespeicherten Elemente eines bestimmten Typs (für Offline-Anzeige)
   * @param {string} type - Datentyp (tasks, shopping, transactions, messages)
   */
  async getAllItems(type) {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(type, 'readonly');
      const store = transaction.objectStore(type);
      
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Löscht ein Element aus der lokalen Datenbank nachdem es synchronisiert wurde
   * @param {string} type - Datentyp (tasks, shopping, transactions, messages)
   * @param {string} id - ID des zu löschenden Elements
   */
  async deleteLocalItem(type, id) {
    const db = await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(type, 'readwrite');
      const store = transaction.objectStore(type);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log(`Item '${id}' aus '${type}' gelöscht`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error(`Fehler beim Löschen von '${id}' aus '${type}':`, event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Event-Listener für Synchronisations-Nachrichten vom Service Worker hinzufügen
   * @param {Function} callback - Callback-Funktion, die aufgerufen wird, wenn Sync abgeschlossen ist
   */
  addSyncCompletedListener(callback) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETED') {
          console.log('Sync abgeschlossen:', event.data);
          callback(event.data);
        }
      });
    }
  }
}

// Singleton-Instanz exportieren
const syncManager = new SyncManager();
export default syncManager;
