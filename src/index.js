import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './components/styles/layout.css';
import { registerServiceWorker } from './serviceWorkerRegistration';

// Dynamischer Import des notificationService fu00fcr automatisches Subscribe
const loadNotificationService = async () => {
  try {
    const notificationServiceModule = await import('./services/notificationService');
    const notificationService = notificationServiceModule.default;
    return notificationService;
  } catch (error) {
    console.error('Fehler beim Laden des notificationService:', error);
    return null;
  }
};

// Funktion für automatisches Abonnieren von Push-Benachrichtigungen - vereinfacht
const tryAutoSubscribe = async () => {
  // Nur fortfahren, wenn Benachrichtigungen bereits erlaubt sind
  if ('Notification' in window && Notification.permission === 'granted') {
    // Prüfen, ob der Benutzer sich bewusst abgemeldet hat (Opt-Out)
    const hasOptedOut = localStorage.getItem('notificationsOptOut') === 'true';
    if (hasOptedOut) {
      console.log('Benutzer hat sich bewusst von Push-Benachrichtigungen abgemeldet (Opt-Out)');
      return;
    }

    try {
      // NotificationService laden
      const notificationService = await loadNotificationService();
      if (!notificationService || !notificationService.isPushSupported()) {
        console.warn('Push-Benachrichtigungen werden nicht unterstützt');
        return;
      }

      // IDENTISCHER PROZESS wie in der NotificationPrompt-Komponente
      console.log('Führe automatisches Subscribe durch...');
      
      // Apartment-ID aus localStorage holen
      let apartmentId = null;
      try {
        const selectedApartment = JSON.parse(localStorage.getItem('selectedApartment'));
        if (selectedApartment && selectedApartment.id) {
          apartmentId = selectedApartment.id;
        }
      } catch (error) {
        console.warn('Konnte Apartment-ID nicht laden, verwende Server-Fallback:', error);
      }

      // Die gleiche Methode aufrufen, die auch in der UI verwendet wird
      await notificationService.subscribeToPush(apartmentId);
      console.log('Automatische Push-Subscription ERFOLGREICH!');
      
      // Keine Benachrichtigung anzeigen, um den Benutzer nicht zu stören
    } catch (error) {
      console.error('Fehler beim automatischen Abonnieren (ignoriert):', error.message);
    }
  } else {
    console.log('Benachrichtigungen nicht erlaubt oder nicht verfügbar');
  }
};

// ServiceWorker registrieren und dann automatisches Abonnieren versuchen
registerServiceWorker()
  .then(registration => {
    if (registration) {
      console.log('ServiceWorker erfolgreich registriert');
      // Nach erfolgreicher Registrierung versuchen, automatisch zu abonnieren
      setTimeout(tryAutoSubscribe, 2000); // Kurze Verzögerung, um sicherzustellen, dass der Service Worker aktiviert ist
    }
  })
  .catch(error => {
    console.error('ServiceWorker-Registrierung fehlgeschlagen:', error);
  });

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
