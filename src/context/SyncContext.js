import React, { createContext, useContext, useEffect, useState } from 'react';
import syncManager from '../services/SyncManager';

// Erstelle einen Kontext fu00fcr die Sync-Funktionalitu00e4t
const SyncContext = createContext(null);

/**
 * SyncProvider - Stellt Sync-Funktionalitu00e4t fu00fcr die gesamte Anwendung bereit
 * Ermöglicht das Offline-Speichern und automatische Synchronisieren von Daten
 */
export const SyncProvider = ({ children }) => {
  // Status fu00fcr Offline-Modus und Sync-Status
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState({});
  const [syncSupport, setSyncSupport] = useState({
    backgroundSync: false,
    periodicSync: false
  });

  // Initialisierung
  useEffect(() => {
    // IndexedDB initialisieren
    syncManager.initDatabase();
    
    // Sync-Unterstützung prüfen
    checkSyncSupport();
    
    // Online/Offline-Status überwachen
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Anzahl ausstehender Synchronisationen abrufen
    updatePendingSyncs();
    
    // Sync-Completed-Events vom Service Worker empfangen
    syncManager.addSyncCompletedListener(handleSyncCompleted);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Online/Offline-Status aktualisieren
  const handleOnlineStatus = () => {
    const online = navigator.onLine;
    setIsOffline(!online);
    
    // Wenn wir wieder online sind, versuche alle ausstehenden Daten zu synchronisieren
    if (online) {
      triggerSyncForAllTypes();
    }
  };

  // Verfügbare Sync-Features prüfen
  const checkSyncSupport = async () => {
    const periodicStatus = await syncManager.getPeriodicSyncStatus();
    
    setSyncSupport({
      backgroundSync: 'serviceWorker' in navigator && 'SyncManager' in window,
      periodicSync: periodicStatus.supported
    });
  };

  // Anzahl ausstehender Synchronisationen für alle Datentypen aktualisieren
  const updatePendingSyncs = async () => {
    const types = ['tasks', 'shopping', 'transactions', 'messages'];
    const pending = {};
    
    for (const type of types) {
      const items = await syncManager.getPendingItems(type);
      pending[type] = items.length;
    }
    
    setPendingSyncs(pending);
  };

  // Wenn ein Sync abgeschlossen ist (vom Service Worker)
  const handleSyncCompleted = (data) => {
    console.log('Sync abgeschlossen für:', data.syncType);
    // Anzahl ausstehender Synchronisationen aktualisieren
    updatePendingSyncs();
  };

  // Synchronisation für alle Datentypen auslösen
  const triggerSyncForAllTypes = async () => {
    const types = ['tasks', 'shopping', 'transactions', 'messages'];
    
    for (const type of types) {
      await syncManager.registerBackgroundSync(type);
    }
  };

  // Daten für die Offline-Nutzung speichern und zur Synchronisation vormerken
  const saveForSync = async (type, data) => {
    try {
      const savedItem = await syncManager.saveItemForSync(type, data);
      updatePendingSyncs();
      return savedItem;
    } catch (error) {
      console.error(`Fehler beim Speichern für Sync (${type}):`, error);
      throw error;
    }
  };

  // Geteilte Werte und Funktionen im Kontext
  const contextValue = {
    isOffline,
    pendingSyncs,
    syncSupport,
    saveForSync,
    getAllItems: syncManager.getAllItems.bind(syncManager),
    getPendingItems: syncManager.getPendingItems.bind(syncManager),
    triggerSync: syncManager.registerBackgroundSync.bind(syncManager),
    triggerSyncForAllTypes
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};

// Hook für den einfachen Zugriff auf den Sync-Kontext
export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync muss innerhalb eines SyncProviders verwendet werden');
  }
  return context;
};
