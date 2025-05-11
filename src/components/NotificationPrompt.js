import React, { useState, useEffect } from 'react';
import { FiBell, FiBellOff, FiCheckCircle, FiAlertTriangle, FiSmartphone } from 'react-icons/fi';
import notificationService from '../services/notificationService';
import { isIOS, isInstalledPWA, isPushSupported, getPushSupportMessage } from '../services/deviceDetection';

const NotificationPrompt = ({ embedded = false }) => {
  const [permission, setPermission] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success', 'error', null
  const [statusMessage, setStatusMessage] = useState('');
  const [apartmentId, setApartmentId] = useState(null);

  // Prüfen des aktuellen Benachrichtigungsstatus und Apartment-ID beim Laden
  useEffect(() => {
    // Notification API prüfen
    if ('Notification' in window) {
      setPermission(Notification.permission);
      
      // Apartment-ID aus localStorage holen
      try {
        const selectedApartment = JSON.parse(localStorage.getItem('selectedApartment'));
        if (selectedApartment && selectedApartment.id) {
          setApartmentId(selectedApartment.id);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Apartment-ID:', error);
      }
      
      // Automatisches Opt-In, wenn Benachrichtigungen bereits erlaubt sind
      if (Notification.permission === 'granted') {
        // Prüfe, ob bereits eine Push-Subscription besteht, falls nicht, abonniere automatisch
        checkExistingSubscriptionAndSubscribe();
      } else if (Notification.permission === 'default') {
        // Sofort Berechtigung anfragen, wenn sie noch nicht erteilt oder verweigert wurde
        // und nicht bereits abgelehnt wurde
        if (!localStorage.getItem('notificationPromptDismissed')) {
          // Kurze Verzögerung, damit die Seite zuerst geladen werden kann
          setTimeout(() => {
            requestPermission();
          }, 2000); // 2 Sekunden Verzögerung für bessere UX
          
          setShowPrompt(true);
        }
      }
    }
  }, []);

  // Prüfen, ob Push-API unterstützt wird und Services verfügbar sind (nutze den neuen Service)
  const pushSupported = isPushSupported();
  const [showIOSHelp, setShowIOSHelp] = useState(isIOS() && !isInstalledPWA());

  // Prüft, ob bereits eine Push-Subscription existiert und abonniert automatisch
  const checkExistingSubscriptionAndSubscribe = async () => {
    if (!pushSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      // Wenn keine Subscription existiert und Berechtigung erteilt ist,
      // automatisch abonnieren (Opt-Out-Modell)
      if (!subscription && Notification.permission === 'granted') {
        // Opt-Out-Präferenz prüfen
        const hasOptedOut = localStorage.getItem('notificationsOptOut') === 'true';
        
        if (!hasOptedOut) {
          // Wenn der Benutzer sich nicht abgemeldet hat, automatisch abonnieren
          console.log('Automatisches Abonnieren von Push-Benachrichtigungen...');
          try {
            await notificationService.subscribeToPush(apartmentId);
            setStatus('success');
            setStatusMessage('Benachrichtigungen wurden automatisch aktiviert!');
          } catch (subError) {
            console.error('Fehler beim automatischen Abonnieren:', subError);
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Prüfen der bestehenden Subscription:', error);
    }
  };
  
  // Alte Funktion beibehalten für Kompatibilität
  const checkExistingSubscription = checkExistingSubscriptionAndSubscribe;

  // Registriere für Push-Benachrichtigungen
  const requestPermission = async () => {
    if (!pushSupported) {
      setStatus('error');
      setStatusMessage(getPushSupportMessage());
      return;
    }
    
    // Spezielle Anweisung für iOS-Benutzer, wenn App nicht installiert ist
    if (isIOS() && !isInstalledPWA()) {
      setStatus('warning');
      setStatusMessage('Füge diese App zum Homescreen hinzu, um Push-Benachrichtigungen zu erhalten.');
      setShowIOSHelp(true);
      return;
    }

    // Die apartmentId ist jetzt optional, da der Server automatisch die erste findet
    // Wir geben daher keine Fehlermeldung mehr aus, wenn keine apartmentId gesetzt ist

    setLoading(true);
    try {
      // Berechtigung anfordern, falls noch nicht geschehen
      if (Notification.permission !== 'granted') {
        const permission = await notificationService.requestPermission();
        setPermission(permission);
        
        if (permission !== 'granted') {
          setLoading(false);
          setStatus('error');
          setStatusMessage('Benachrichtigungen wurden nicht erlaubt');
          return;
        }
      }

      // Bei Push-Service registrieren
      await notificationService.subscribeToPush(apartmentId);
      
      // Opt-Out-Flag entfernen, wenn Benutzer sich explizit wieder anmeldet
      localStorage.removeItem('notificationsOptOut');
      
      // Erfolgsstatus setzen
      setStatus('success');
      setStatusMessage('Benachrichtigungen wurden aktiviert!');
      
      // Test-Benachrichtigung nach kurzer Verzögerung senden
      setTimeout(() => {
        notificationService.showLocalNotification('Benachrichtigungen aktiv', {
          body: 'Du erhältst jetzt Infos über erledigte Aufgaben und andere Ereignisse.',
          icon: '/icons/android-chrome-192x192.png'
        }).catch(err => console.error('Fehler bei Test-Benachrichtigung:', err));
      }, 2000);
    } catch (error) {
      console.error('Fehler beim Aktivieren der Push-Benachrichtigungen:', error);
      setStatus('error');
      setStatusMessage(error.message || 'Fehler beim Aktivieren der Benachrichtigungen');
    } finally {
      setLoading(false);
    }
  };

  // Benachrichtigungen deaktivieren (Opt-Out)
  const unsubscribe = async () => {
    setLoading(true);
    try {
      // Erst vom Push-Service abmelden
      await notificationService.unsubscribeFromPush();
      
      // Dann Opt-Out-Flag setzen, damit keine automatische Anmeldung mehr erfolgt
      localStorage.setItem('notificationsOptOut', 'true');
      
      setStatus('success');
      setStatusMessage('Benachrichtigungen deaktiviert');
    } catch (error) {
      console.error('Fehler beim Deaktivieren der Push-Benachrichtigungen:', error);
      setStatus('error');
      setStatusMessage('Fehler beim Deaktivieren der Benachrichtigungen');
    } finally {
      setLoading(false);
    }
  };

  // Prompt ausblenden und nicht mehr anzeigen
  const dismissPrompt = () => {
    setShowPrompt(false);
    // Speichern, dass der Benutzer nicht mehr gefragt werden möchte
    localStorage.setItem('notificationPromptDismissed', 'true');
  };

  // Wenn Benachrichtigungen nicht unterstützt werden oder nicht angezeigt werden sollen
  // Im embedded-Modus immer etwas anzeigen, sonst nur wenn showPrompt true ist oder iOS-Hilfe angezeigt werden soll
  if (!pushSupported && !showIOSHelp) {
    if (!embedded) {
      return null;
    }
    // Anzeigen einer Hilfestellung, wenn eingebettet und Push nicht unterstützt wird
    return (
      <div className="notification-prompt embedded">
        <div className="content">
          <div className="icon-container warning">
            <FiAlertTriangle />
          </div>
          <div className="text-container">
            <h3>Benachrichtigungen nicht verfügbar</h3>
            <p>{getPushSupportMessage()}</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!embedded && !showPrompt && status === null && !showIOSHelp) {
    return null;
  }

  // Styling für Status-Anzeige basierend auf dem Status
  const getStatusColor = () => {
    switch(status) {
      case 'success': return 'var(--success)';
      case 'error': return 'var(--error)';
      default: return 'var(--primary)';
    }
  };

  // Funktion zum Zurücksetzen der Push-Subscription
  const resetSubscription = async () => {
    try {
      setLoading(true);
      setStatus('loading');
      setStatusMessage('Subscription wird zurückgesetzt...');
      
      // Service Worker abrufen
      const registration = await navigator.serviceWorker.ready;
      
      // Aktuelle Subscription abrufen
      const subscription = await registration.pushManager.getSubscription();
      
      // Wenn eine Subscription existiert, diese löschen
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Alte Push-Subscription erfolgreich gelöscht');
        setStatusMessage('Alte Subscription entfernt. Bitte aktiviere Benachrichtigungen neu.');
        setPermission('default');
        setStatus('success');
        setShowPrompt(true);
      } else {
        setStatusMessage('Keine aktive Subscription gefunden.');
        setStatus('info');
      }
    } catch (error) {
      console.error('Fehler beim Zurücksetzen der Subscription:', error);
      setStatusMessage(`Fehler: ${error.message}`);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Unterschiedliche Stile für embedded und floating
  const containerStyle = embedded ? {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%'
  } : {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: 'var(--card-background)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 3px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    maxWidth: '320px',
    zIndex: 1000,
    animation: 'slideIn 0.3s ease-out',
    border: '1px solid var(--border-color)'
  }
  
  return (
    <div style={containerStyle}
    >
      {/* Header mit Icon */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', width: '100%' }}>
        <div style={{ marginRight: '10px', color: getStatusColor() }}>
          {status === 'success' ? (
            <FiCheckCircle size={22} />
          ) : status === 'error' ? (
            <FiAlertTriangle size={22} />
          ) : (
            <FiBell size={22} />
          )}
        </div>
        <div style={{ flex: 1, fontWeight: '600', fontSize: '15px' }}>
          {status === 'success' ? 'Erfolgreich' : 
           status === 'error' ? 'Fehler' : 
           'Benachrichtigungen'}
        </div>
      </div>
      
      {/* Haupt-Inhalt */}
      <div style={{ width: '100%', marginBottom: '14px' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.4', color: 'var(--text)' }}>
          {status === null ? 
            'Erhalte Benachrichtigungen, wenn deine Mitbewohner Aufgaben erledigen oder andere wichtige Ereignisse stattfinden.' :
            statusMessage}
        </p>
      </div>
      
      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: embedded ? 'column' : 'row', gap: '10px', width: '100%' }}>
        {/* Reset-Button für die Behebung von Subscriptions-Problemen */}
        {embedded && (
          <button
            onClick={resetSubscription}
            style={{
              backgroundColor: 'var(--warning)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '14px',
              cursor: loading ? 'default' : 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              width: '100%',
              opacity: loading ? 0.7 : 1,
              fontWeight: '500',
              marginBottom: '10px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
            disabled={loading}
          >
            Subscription zurücksetzen
          </button>
        )}
        
        {status === null ? (
          <>
            <button
              onClick={requestPermission}
              disabled={loading}
              style={{
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '14px',
                cursor: loading ? 'default' : 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                flex: '1',
                opacity: loading ? 0.7 : 1,
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              {loading ? 'Wird aktiviert...' : 'Aktivieren'}
            </button>
            <button
              onClick={dismissPrompt}
              disabled={loading}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--hover-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Später
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowPrompt(false)}
            style={{
              backgroundColor: status === 'error' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: status === 'error' ? 'white' : 'var(--text)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'transform 0.2s, opacity 0.2s',
              width: '100%',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {status === 'error' ? 'Nochmal versuchen' : 'Schließen'}
          </button>
        )}
      </div>
      
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NotificationPrompt;
