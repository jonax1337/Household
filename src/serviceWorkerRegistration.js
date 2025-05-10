// Service Worker Registration Logic

// This optional code is used to register a service worker.
// By default, Household uses this to improve offline experience
// and handle PWA functionality.

export function registerServiceWorker() {
  return new Promise((resolve, reject) => {
    // ServiceWorker in allen Umgebungen aktivieren (prod und dev)
    if ('serviceWorker' in navigator) {
      const publicUrl = new URL(process.env.PUBLIC_URL || '/', window.location.href);
      
      // Wenn unsere App von einem anderen Origin ausgeliefert wird,
      // möchten wir keinen Service Worker registrieren
      if (publicUrl.origin !== window.location.origin) {
        console.log('Service Worker wird nicht registriert: verschiedene Origins');
        resolve(null);
        return;
      }

      // Pfad zum Service Worker bestimmen - absolute URL verwenden
      // window.location.origin stellt sicher, dass wir die volle URL haben
      const swUrl = `${window.location.origin}/serviceWorker.js`;
      console.log('Service Worker URL:', swUrl);
      
      const swOptions = {
        scope: '/'
      };
      
      // Prüfe zuerst, ob bereits ein Service Worker registriert ist
      navigator.serviceWorker.getRegistrations()
        .then(registrations => {
          const existingRegistration = registrations.find(reg => 
            reg.scope === (window.location.origin + '/') && reg.active && reg.active.state === 'activated'
          );
          
          // Wenn bereits ein Service Worker mit dem gleichen Scope existiert und aktiv ist
          if (existingRegistration) {
            console.log('Bestehender Service Worker gefunden mit Scope:', existingRegistration.scope);
            return existingRegistration;
          }
          
          // Nur deregistrieren, wenn explizit durch localStorage-Flag angefordert
          const shouldReset = localStorage.getItem('resetServiceWorker') === 'true';
          
          if (shouldReset) {
            console.log('Service Worker Reset angefordert, deregistriere alte Worker...');
            localStorage.removeItem('resetServiceWorker');
            
            const unregisterPromises = registrations.map(registration => {
              console.log('Deregistriere Service Worker mit Scope:', registration.scope);
              return registration.unregister();
            });
            
            return Promise.all(unregisterPromises)
              .then(() => {
                console.log('Alle Service Worker deregistriert, registriere neuen Service Worker...');
                return navigator.serviceWorker.register(swUrl, swOptions);
              });
          }
          
          console.log('Registriere oder reaktiviere Service Worker...');
          // Registriere neuen Service Worker falls nicht vorhanden
          return navigator.serviceWorker.register(swUrl, swOptions);
        })
        .then(registration => {
          console.log('ServiceWorker erfolgreich registriert mit Scope:', registration.scope);
          
          // Aktiviere den Service Worker sofort
          if (registration.waiting) {
            console.log('Service Worker wartet auf Aktivierung - aktiviere ihn jetzt');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          
          // Auf Statusänderungen hören
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            
            installingWorker.onstatechange = () => {
              console.log('ServiceWorker Status:', installingWorker.state);
              
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // An diesem Punkt gibt es einen neuen Service Worker
                  console.log('Neue ServiceWorker-Version installiert, bereit für Updates');
                  
                  // Sofort aktivieren ohne Neuladen
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  // Zu diesem Zeitpunkt wurde alles vorcached.
                  console.log('Inhalte wurden zwischengespeichert für die Offline-Nutzung');
                }
              } else if (installingWorker.state === 'activated') {
                console.log('ServiceWorker aktiviert, Push-Benachrichtigungen sollten jetzt funktionieren');
              }
            };
          };
          resolve(registration);
        })
        .catch(error => {
          console.error('Fehler bei der ServiceWorker-Registrierung:', error);
          reject(error);
        });
    } else {
      // Keine ServiceWorker-Unterstützung
      console.log('ServiceWorker wird nicht registriert: Keine Browser-Unterstützung');
      resolve(null);
    }
  });
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}