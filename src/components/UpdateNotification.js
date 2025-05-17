import React, { useState, useEffect } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import updateService from '../services/updateService.js';
import { useTheme } from '../context/ThemeContext';
import './styles.css';

/**
 * Komponente zur Anzeige einer Update-Benachrichtigung
 * Erscheint, wenn eine neue Version der App verfu00fcgbar ist
 */
const UpdateNotification = () => {
  const { theme } = useTheme();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  // Bei Komponenten-Mount Update-Service initialisieren und Update-Events abonnieren
  useEffect(() => {
    // Update-Service initialisieren
    updateService.init({
      checkInterval: 900000, // Alle 15 Minuten pru00fcfen (900.000 ms)
    }).then(() => {
      // Initialer Status
      setUpdateAvailable(updateService.hasUpdate());
      setLastChecked(updateService.getLastCheckedTime());
    });

    // Event-Listener fu00fcr verfu00fcgbare Updates
    const handleUpdateAvailable = () => {
      console.log('Update verfugbar, zeige Benachrichtigung');
      setUpdateAvailable(true);
      setIsVisible(true);
      setLastChecked(updateService.getLastCheckedTime());
    };

    // Event-Listener registrieren
    window.addEventListener('appUpdateAvailable', handleUpdateAvailable);

    // Beim Demontieren bereinigen
    return () => {
      window.removeEventListener('appUpdateAvailable', handleUpdateAvailable);
    };
  }, []);

  // Manuell nach Updates suchen
  const checkForUpdates = async () => {
    console.log('Manueller Update-Check');
    const hasUpdate = await updateService.checkForUpdates();
    setUpdateAvailable(hasUpdate);
    setLastChecked(updateService.getLastCheckedTime());
    
    // Wenn kein Update gefunden wurde, zeige kurze Bestu00e4tigung
    if (!hasUpdate) {
      setIsVisible(true);
      setTimeout(() => {
        if (!updateService.hasUpdate()) {
          setIsVisible(false);
        }
      }, 3000);
    }
  };

  // Update installieren
  const installUpdate = async () => {
    console.log('Installiere Update');
    await updateService.applyUpdate();
    setUpdateAvailable(false);
    setIsVisible(false);
  };

  // Benachrichtigung schlieu00dfen
  const dismissNotification = () => {
    setIsVisible(false);
  };

  // Komponente nicht rendern, wenn keine Benachrichtigung angezeigt werden soll
  if (!isVisible) {
    return null;
  }

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <div className="update-icon-container">
          <FiRefreshCw className="update-icon" />
        </div>
        <div className="update-text-container">
          {updateAvailable ? (
            <>
              <span className="update-title">Neue Version verfügbar!</span>
              <div className="update-actions">
                <button 
                  className="btn primary-btn" 
                  onClick={installUpdate}
                >
                  Jetzt aktualisieren
                </button>
                <button 
                  className="btn secondary-btn" 
                  onClick={dismissNotification}
                >
                  Später
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="update-title">App ist aktuell</span>
              <div className="update-actions">
                <button 
                  className="btn secondary-btn" 
                  onClick={dismissNotification}
                >
                  Schließen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
