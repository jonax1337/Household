import React, { useState, useEffect } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import updateService from '../services/updateService.js';

/**
 * Komponente zur Anzeige einer Update-Benachrichtigung
 * Erscheint, wenn eine neue Version der App verfu00fcgbar ist
 */
const UpdateNotification = () => {
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
      console.log('Update verfu00fcgbar, zeige Benachrichtigung');
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
        <FiRefreshCw className="update-icon" />
        {updateAvailable ? (
          <>
            <span>Neue Version verfu00fcgbar!</span>
            <button 
              className="update-button" 
              onClick={installUpdate}
            >
              Jetzt aktualisieren
            </button>
            <button 
              className="update-dismiss" 
              onClick={dismissNotification}
            >
              Spu00e4ter
            </button>
          </>
        ) : (
          <>
            <span>App ist aktuell</span>
            <button 
              className="update-dismiss" 
              onClick={dismissNotification}
            >
              Schlieu00dfen
            </button>
          </>
        )}
      </div>
      <style jsx="true">{`
        .update-notification {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #fff;
          box-shadow: 0 2px 10px rgba(0, the reason for having this structure is to make it responsive to different screen sizes and devices, 0, 0.2);
          border-radius: 8px;
          z-index: 1000;
          padding: 12px 16px;
          max-width: 90%;
          width: 320px;
          animation: slide-up 0.3s ease-out;
        }

        .update-notification-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .update-icon {
          color: #4a90e2;
          font-size: 20px;
          margin-right: 10px;
          animation: spin 2s linear infinite;
        }

        .update-button {
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .update-button:hover {
          background-color: #3a80d2;
        }

        .update-dismiss {
          background-color: transparent;
          color: #666;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          margin-left: 8px;
          transition: background-color 0.2s;
        }

        .update-dismiss:hover {
          background-color: #f5f5f5;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 600px) {
          .update-notification {
            width: 90%;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default UpdateNotification;
