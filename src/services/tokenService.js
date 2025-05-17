import axios from 'axios';

// API-Basis-URL - eigene Implementation, da die Funktion in api.js nicht exportiert wird
const getBaseUrl = () => {
  // Verwende das gleiche Protokoll wie die Seite selbst (http oder https)
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Im Development-Modus (erkannt durch Port 3000) verwenden wir Port 5000 für Backend
  if (window.location.port === '3000') {
    return `${protocol}//${hostname}:5000`;
  }
  
  // In Produktion verwenden wir relative URLs ohne Port
  return `${protocol}//${hostname}`;
};

const BASE_URL = getBaseUrl();

/**
 * Service für die Verwaltung des Auth-Tokens
 * Bietet Funktionen zum Speichern, Abrufen und Erneuern des JWT-Tokens
 */
const tokenService = {
  /**
   * Gibt den aktuellen Token zurück
   */
  getToken: () => {
    return localStorage.getItem('token');
  },

  /**
   * Speichert einen Token im localStorage
   */
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('tokenLastRefreshed', Date.now().toString());
    }
  },

  /**
   * Entfernt den Token und Authentifizierungs-Flags
   */
  removeToken: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('tokenLastRefreshed');
  },

  /**
   * Prüft, ob der aktuelle Token gültig ist
   */
  isAuthenticated: () => {
    return localStorage.getItem('isAuthenticated') === 'true' && !!localStorage.getItem('token');
  },

  /**
   * Prüft, ob der Token erneuert werden sollte
   * Wir erneuern, wenn der letzte Refresh mehr als eine Woche her ist
   */
  shouldRefreshToken: () => {
    // Wenn kein Token vorhanden ist, müssen wir nicht refreshen
    if (!tokenService.isAuthenticated()) {
      return false;
    }
    
    const lastRefreshed = localStorage.getItem('tokenLastRefreshed');
    
    // Wenn noch nie refreshed, dann jetzt refreshen
    if (!lastRefreshed) {
      return true;
    }
    
    // Refresh, wenn der letzte Refresh mehr als 7 Tage her ist
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000; // 7 Tage in Millisekunden
    const timeSinceLastRefresh = Date.now() - parseInt(lastRefreshed, 10);
    
    return timeSinceLastRefresh > oneWeekInMs;
  },

  /**
   * Aktualisiert den Token durch einen API-Aufruf
   */
  refreshToken: async () => {
    try {
      const currentToken = tokenService.getToken();
      
      if (!currentToken) {
        throw new Error('Kein Token zum Erneuern vorhanden');
      }
      
      // API-Anfrage zum Token-Refresh
      const response = await axios.post(
        `${BASE_URL}/api/auth/refresh-token`,
        {},
        {
          headers: {
            'x-auth-token': currentToken
          }
        }
      );
      
      // Neuen Token speichern
      if (response.data && response.data.token) {
        tokenService.setToken(response.data.token);
        console.log('Token erfolgreich aktualisiert');
        return true;
      } else {
        throw new Error('Ungültiger Response vom Server');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Tokens:', error);
      
      // Bei einem 401 (Unauthorized) Fehler ausloggen
      if (error.response && error.response.status === 401) {
        console.warn('Token ungültig oder abgelaufen, Benutzer wird ausgeloggt');
        tokenService.removeToken();
      }
      
      return false;
    }
  },

  /**
   * Initialisiert die automatische Token-Erneuerung,
   * wenn der Benutzer die App benutzt
   */
  initTokenRefresh: () => {
    // Prüfe bei Seitenladung
    if (tokenService.shouldRefreshToken()) {
      tokenService.refreshToken();
    }
    
    // Prüfe bei Fokus auf das Fenster (Benutzer kehrt zur App zurück)
    window.addEventListener('focus', () => {
      if (tokenService.shouldRefreshToken()) {
        tokenService.refreshToken();
      }
    });
    
    // Prüfe regelmäßig (einmal pro Tag)
    setInterval(() => {
      if (tokenService.shouldRefreshToken()) {
        tokenService.refreshToken();
      }
    }, 24 * 60 * 60 * 1000); // 24 Stunden
  }
};

export default tokenService;
