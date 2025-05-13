// OAuth-Provider-Konfigurationen und Hilfsfunktionen

// Hilfsfunktion, um dynamische Callback-URLs zu erstellen
const getRedirectUri = (path = '/auth/callback') => {
  return `${window.location.origin}${path}`;
};

// Apple Sign-In Konfiguration
const appleConfig = {
  // Diese Werte werden von deinem Apple Developer Account kommen
  clientId: 'com.yourdomain.household', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'name email'
};

// Google Sign-In Konfiguration
const googleConfig = {
  clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '977146652564-vng4b46i585k4ntbsjj0q7r1kp85pqn5.apps.googleusercontent.com',
  redirectUri: getRedirectUri('/auth/google/callback'),
  scope: 'profile email'
};

// Microsoft Sign-In Konfiguration
const microsoftConfig = {
  clientId: 'YOUR_MICROSOFT_CLIENT_ID', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'User.Read'
};

// Discord Sign-In Konfiguration (neu hinzugefügt)
const discordConfig = {
  clientId: 'YOUR_DISCORD_CLIENT_ID', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'identify email'
};

// Helper-Funktion zur Anpassung der Benutzerinfos an unser System
const normalizeUserData = (provider, userData) => {
  switch (provider) {
    case 'apple':
      return {
        providerId: userData.user?.id || '',
        email: userData.user?.email || '',
        name: userData.user?.name?.firstName ? 
              `${userData.user.name.firstName} ${userData.user.name.lastName || ''}`.trim() : 
              'Apple Nutzer',
        provider: 'apple'
      };
    case 'google':
      return {
        providerId: userData.sub || '',
        email: userData.email || '',
        name: userData.name || 'Google Nutzer',
        provider: 'google'
      };
    // Weitere Provider hier hinzufu00fcgen
    default:
      return {
        providerId: '',
        email: '',
        name: '',
        provider
      };
  }
};

// Google Sign-In Funktion
const startGoogleSignIn = () => {
  return new Promise((resolve, reject) => {
    // Google OAuth Parametergenerierung
    const params = new URLSearchParams({
      client_id: googleConfig.clientId,
      redirect_uri: googleConfig.redirectUri,
      response_type: 'code',
      scope: googleConfig.scope,
      access_type: 'offline',
      prompt: 'consent'
    });

    // Google Auth URL mit Parametern
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    // Fenster-Größe und -Position für das Auth-Popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // Popup-Fenster öffnen
    const popup = window.open(
      authUrl,
      'Google Sign In',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Intervallfunktion zum Überwachen des Popup-Status und der URL-Änderungen
    const intervalId = setInterval(() => {
      try {
        // Prüfen, ob das Popup geschlossen wurde
        if (popup.closed) {
          clearInterval(intervalId);
          reject(new Error('Login-Fenster wurde geschlossen'));
          return;
        }
        
        // Aktuelle URL des Popups prüfen
        const currentUrl = popup.location.href;
        
        // Prüfen, ob die Callback-URL erreicht wurde
        if (currentUrl.startsWith(googleConfig.redirectUri)) {
          clearInterval(intervalId);
          popup.close();
          
          // Auth-Code aus der URL extrahieren
          const urlObj = new URL(currentUrl);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');
          
          if (error) {
            reject(new Error(`Google-Authentifizierung fehlgeschlagen: ${error}`));
          } else if (code) {
            resolve({ code, redirectUri: googleConfig.redirectUri });
          } else {
            reject(new Error('Kein Auth-Code in der Antwort'));
          }
        }
      } catch (e) {
        // Zugriffsfehler ignorieren, die auftreten, wenn die Origin sich ändert
        // Das ist normal während des Authentifizierungsflusses
      }
    }, 100);
  });
};

// OAuth-Login-Funktion (wird vom authService aufgerufen)
export const oauthLogin = async (provider) => {
  try {
    let authResult;
    
    switch (provider) {
      case 'apple':
        authResult = await startAppleSignIn();
        break;
      case 'google':
        authResult = await startGoogleSignIn();
        break;
      // Weitere Provider hier hinzufu00fcgen
      default:
        throw new Error(`OAuth-Provider ${provider} nicht unterstu00fctzt`);
    }
    
    if (!authResult) {
      throw new Error(`Anmeldung mit ${provider} fehlgeschlagen`);
    }
    
    // API-Aufruf an den Server, um das Token zu validieren und einen JWT zu erhalten
    const apiUrl = `${process.env.REACT_APP_API_URL || ''}/api/auth/${provider}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(authResult)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Server-Fehler bei ${provider}-Authentifizierung`);
    }
    
    const data = await response.json();
    
    return {
      token: data.token,
      user: data.user
    };
  } catch (error) {
    console.error(`Fehler bei der Anmeldung mit ${provider}:`, error);
    throw error;
  }
};
