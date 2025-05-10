import axios from 'axios';

// API-Basis-URL - verwende dynamische Werte basierend auf der aktuellen Umgebung
// Automatische Anpassung an das aktuelle Protokoll (http/https) und Host
const getBaseUrl = () => {
  // Zuerst prüfen, ob eine spezifische API-URL in den Umgebungsvariablen definiert ist
  // Dies wird für Render.com verwendet, wo Frontend und Backend separate Services sind
  if (process.env.REACT_APP_API_URL) {
    console.log('%c[API] Verwende konfigurierte API-URL aus Umgebungsvariablen', 'color: #0066cc;');
    return process.env.REACT_APP_API_URL;
  }
  
  // Verwende das gleiche Protokoll wie die Seite selbst (http oder https)
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Im Development-Modus (erkannt durch Port 3000) verwenden wir immer Port 5000 für Backend
  // Das funktioniert mit localhost, 127.0.0.1 und auch lokalen IP-Adressen im Netzwerk
  if (window.location.port === '3000') {
    return `${protocol}//${hostname}:5000`;
  }
  
  // In Produktion, wenn Frontend und Backend auf dem gleichen Server sind,
  // nutzen wir relative URLs ohne Port, der Server übernimmt das Routing
  return `${protocol}//${hostname}`;
};

const BASE_URL = getBaseUrl();
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : BASE_URL + '/api';

console.log('%c[API] Verwende API-URL:', 'color: #0066cc;', API_URL);

// Flag, um Mock-Daten zu aktivieren, wenn Backend nicht erreichbar ist
let useMockData = false;  // Standardmäßig echte API-Aufrufe verwenden

// Erweiterte API-Diagnose-Funktion mit detaillierten Console-Outputs
const checkBackendAvailability = async () => {
  console.log('%c[API-DIAGNOSE] Starte API-Verfügbarkeitsprüfung...', 'color: #0066cc; font-weight: bold;');
  console.log(`%c[API-DIAGNOSE] Ziel-API-URL: ${API_URL}`, 'color: #333; font-style: italic;');
  
  try {
    console.log('%c[API-DIAGNOSE] Sende Health-Check-Anfrage...', 'color: #666;');
    const startTime = performance.now();
    const response = await fetch(BASE_URL + '/api/health');  // Verwende direkt BASE_URL für korrekte Pfadangabe
    const endTime = performance.now();
    const responseTimeMs = (endTime - startTime).toFixed(2);
    
    if (response.ok) {
      console.log(`%c[API-DIAGNOSE] ✅ Backend erreichbar (${responseTimeMs}ms)`, 'color: green; font-weight: bold;');
      console.log('%c[API-DIAGNOSE] Verwende echte API-Aufrufe', 'color: green;');
      useMockData = false;
      
      // Zusatzinformationen aus der Antwort extrahieren
      try {
        const data = await response.clone().json();
        console.log('%c[API-DIAGNOSE] Server-Status-Details:', 'color: #333;', data);
      } catch (parseError) {
        console.log('%c[API-DIAGNOSE] Konnte Server-Antwort nicht als JSON parsen', 'color: #666;');
      }
    } else {
      console.log(`%c[API-DIAGNOSE] ❌ Backend antwortet mit Status ${response.status} (${responseTimeMs}ms)`, 'color: orange; font-weight: bold;');
      console.log('%c[API-DIAGNOSE] Verwende Mock-Daten als Fallback', 'color: orange;');
      useMockData = true;
    }
  } catch (error) {
    console.log('%c[API-DIAGNOSE] ❌ Fehler bei der Backend-Verbindung:', 'color: red; font-weight: bold;');
    console.error('[API-DIAGNOSE] Fehlermeldung:', error);
    console.log('%c[API-DIAGNOSE] Verwende Mock-Daten als Fallback', 'color: orange;');
    useMockData = true;
    
    // Netzwerkstatus prüfen
    if (navigator.onLine) {
      console.log('%c[API-DIAGNOSE] Browser meldet: Online, aber Backend nicht erreichbar', 'color: #666;');
    } else {
      console.log('%c[API-DIAGNOSE] Browser meldet: Offline', 'color: #666;');
    }
  }
  
  // API-Endpoints-Übersicht anzeigen
  console.log('%c[API-DIAGNOSE] Verfügbare API-Endpoints:', 'color: #0066cc; font-weight: bold;');
  console.log('%c[API-DIAGNOSE] - /api/auth/login - Benutzeranmeldung', 'color: #666;');
  console.log('%c[API-DIAGNOSE] - /api/auth/register - Benutzerregistrierung', 'color: #666;');
  console.log('%c[API-DIAGNOSE] - /api/apartments - Wohnungen verwalten', 'color: #666;');
  console.log('%c[API-DIAGNOSE] - /api/roommates - Mitbewohner verwalten', 'color: #666;');
  console.log('%c[API-DIAGNOSE] - /api/finances - Finanzen verwalten', 'color: #666;');
  console.log('%c[API-DIAGNOSE] - /api/shopping - Einkaufslisten verwalten', 'color: #666;');
  console.log('%c[API-DIAGNOSE] - /api/settings - Einstellungen verwalten', 'color: #666;');
};

// Führe den erweiterten Health-Check beim Laden aus
console.log('%c[API-DIAGNOSE] Household-App gestartet - Starte API-Diagnose', 'color: #0066cc; font-weight: bold;');
checkBackendAvailability();

// Beispieldaten für Mock-Mode
const mockData = {
  apartments: [
    {
      id: 1,
      name: 'Meine Wohnung',
      address: 'Musterstraße 1, 12345 Berlin',
      owner: 'ich@beispiel.de',
      inviteCode: 'ABC123'
    }
  ],
  shopItems: [
    { id: 1, name: 'Milch', category: 'Milchprodukte', createdBy: 'Max' },
    { id: 2, name: 'Brot', category: 'Backwaren', createdBy: 'Lisa' },
    { id: 3, name: 'Tomaten', category: 'Gemüse', createdBy: 'Anna' }
  ]
};

// Axios-Instanz mit korrigierter Basis-URL erstellen
const api = axios.create({
  baseURL: BASE_URL + '/api',  // Verwende BASE_URL statt API_URL, um Dopplung zu vermeiden
  headers: {
    'Content-Type': 'application/json'
  }
});

// Logging für API-Anfragen einrichten, um Diagnose zu erleichtern
api.interceptors.request.use(
  (config) => {
    console.log(`%c[API-REQUEST] ${config.method.toUpperCase()} ${config.url}`, 'color: #0066aa;');
    return config;
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`%c[API-RESPONSE] ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`, 'color: #00aa66;');
    return response;
  },
  (error) => {
    if (error.response) {
      console.log(`%c[API-ERROR] ${error.response.status} ${error.config.method.toUpperCase()} ${error.config.url}`, 'color: #aa0000;', error.response.data);
    } else {
      console.log(`%c[API-ERROR] Netzwerkfehler oder keine Antwort`, 'color: #aa0000;', error);
    }
    return Promise.reject(error);
  }
);

// Interceptor für das Hinzufügen des Authentication-Tokens zu Anfragen
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API-Services mit Fallback-Logik
// OAuth-Provider importieren
import { oauthLogin } from './oauthProviders';

export const authService = {
  // Benutzerregistrierung
  register: async (userData) => {
    try {
      // Versuche die echte API zu verwenden
      const response = await api.post('/auth/register', userData);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('isAuthenticated', 'true');
      }
      return response.data;
    } catch (error) {
      // Bei Fehler: Fallback auf Mock-Daten wenn Backend nicht erreichbar
      console.warn('Backend nicht erreichbar, verwende Mock-Daten für die Registrierung', error);
      useMockData = true;
      
      // Simuliere erfolgreiche Registrierung
      const mockToken = 'mock-token-' + Math.random().toString(36).substring(2);
      
      // Erstelle ein einheitliches Benutzerobjekt
      const user = {
        id: Date.now(),
        name: userData.name,
        email: userData.email
      };
      
      // Speichere Token und Benutzerinformationen im localStorage
      localStorage.setItem('token', mockToken);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      console.log('%c[AUTH] Registrierter Benutzer:', 'color: #00aa66;', user);
      
      return {
        token: mockToken,
        user: user
      };
    }
  },
  
  // Liste gültiger Test-Benutzer für Offline-Modus
  _validTestUsers: [
    { email: 'test@example.com', password: 'password', id: 1, name: 'Test Benutzer', isOwner: true },
    { email: 'admin@example.com', password: 'admin123', id: 2, name: 'Administrator', isOwner: true },
    { email: 'demo@example.com', password: 'demo123', id: 3, name: 'Demo Benutzer', isOwner: false }
  ],
  
  // OAuth-Login mit externen Anbietern wie Apple, Google, etc.
  oauthLogin: async (provider) => {
    try {
      console.log(`%c[AUTH] OAuth-Login mit ${provider}`, 'color: #4CAF50; font-weight: bold;');
      
      // Rufe die OAuth-Login-Funktion auf
      const result = await oauthLogin(provider);
      
      if (result && result.token) {
        // Alte Daten löschen
        localStorage.clear();
        
        // Token speichern
        localStorage.setItem('token', result.token);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Benutzerdaten speichern
        if (result.user) {
          localStorage.setItem('currentUser', JSON.stringify(result.user));
        }
        
        console.log(`%c[AUTH] OAuth-Login mit ${provider} erfolgreich`, 'color: #00aa66;', result);
        return result;
      } else {
        throw new Error(`OAuth-Login mit ${provider} fehlgeschlagen: Keine gültige Antwort`);
      }
    } catch (error) {
      console.error(`OAuth-Login mit ${provider} fehlgeschlagen:`, error);
      throw error;
    }
  },
  
  // Benutzeranmeldung
  login: async (credentials) => {
    try {
      // Für Debug-Zwecke - wird später entfernt
      console.log('%c[AUTH] Login-Versuch mit:', 'color: #0066aa;', credentials.email);

      try {
        // Echte API-Anfrage versuchen
        const response = await api.post('/auth/login', credentials);
        console.log('%c[AUTH] Login-Antwort:', 'color: #00aa66;', response.data);
        
        if (response.data && response.data.token) {
          // Vor dem Setzen neuer Daten: Alte Daten löschen
          localStorage.clear(); // Alle Daten entfernen für einen sauberen Start
          
          // Token im localStorage speichern
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('isAuthenticated', 'true');
          
          // Benutzerinformationen speichern
          if (response.data.user) {
            console.log('%c[AUTH] Benutzer angemeldet:', 'color: #00aa66;', response.data.user);
            const userData = {
              id: response.data.user.id,
              name: response.data.user.name,
              email: response.data.user.email
            };
            localStorage.setItem('currentUser', JSON.stringify(userData));
          }

          return response.data;
        } else {
          throw new Error('Ungültiges Antwortformat vom Server');
        }
      } catch (apiError) {
        // Wenn es ein Antwort-Fehler ist (ungültige Anmeldedaten)
        if (apiError.response) {
          if (apiError.response.status === 401 || apiError.response.status === 400) {
            throw new Error('Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.');
          } else {
            throw new Error(`Server-Fehler: ${apiError.response.data?.message || 'Unbekannter Fehler'}`);
          }
        }

        // Bei Netzwerkfehlern oder keiner API-Verfügbarkeit: Testbenutzer verwenden
        console.warn('Backend nicht erreichbar, verwende Test-Benutzer', apiError);
        useMockData = true;

        // Fixe Test-Benutzer
        const testUsers = [
          { email: 'test@example.com', password: 'password', id: 1, name: 'Test Benutzer', isOwner: true },
          { email: 'admin@example.com', password: 'admin123', id: 2, name: 'Administrator', isOwner: true },
          { email: 'demo@example.com', password: 'demo123', id: 3, name: 'Demo Benutzer', isOwner: false },
          { email: 'peter@pan.de', password: 'password', id: 4, name: 'Peter Pan', isOwner: true }
        ];
        
        // Prüfe, ob die Anmeldedaten gültig sind
        const validUser = testUsers.find(
          user => user.email.toLowerCase() === credentials.email.toLowerCase() && 
                 user.password === credentials.password
        );
        
        if (!validUser) {
          console.error('Ungültige Test-Anmeldedaten:', credentials.email);
          throw new Error('Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.');
        }
        
        // Erfolgreiche Test-Anmeldung
        console.log('%c[AUTH] Erfolgreiche Test-Anmeldung:', 'color: #00aa66;', validUser);
        
        // Vor dem Setzen neuer Daten: Alle alten Daten löschen für einen sauberen Start
        localStorage.clear();
        
        // Einheitliches Token-Format
        const mockToken = `test-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        
        // Einheitliche Benutzerdaten
        const userData = {
          id: validUser.id,
          name: validUser.name,
          email: validUser.email,
          isOwner: validUser.isOwner
        };
        
        // Daten im localStorage speichern
        localStorage.setItem('token', mockToken);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        return {
          token: mockToken,
          user: userData
        };
      }
    } catch (error) {
      console.error('Kritischer Fehler beim Login:', error);
      throw error;
    }
  },
  
  // Abmeldung - Client-seitig ohne API-Aufruf
  logout: async () => {
    try {
      // Da der /auth/logout Endpunkt nicht existiert, müssen wir keine API-Anfrage senden
      // Stattdessen führen wir ein sauberes lokales Logout durch
      
      console.log('%c[AUTH] Führe Abmeldung durch...', 'color: #00aa66;');
      
      // Alle relevanten Daten aus dem localStorage entfernen
      localStorage.clear();  // Alle Daten entfernen für einen sauberen Neustart
      
      console.log('%c[AUTH] Benutzer erfolgreich abgemeldet', 'color: #00aa66;');
      return { success: true };
    } catch (error) {
      console.error('Fehler beim Abmelden:', error);
      // Im Fehlerfall trotzdem alle Daten löschen
      localStorage.clear();
      return { success: true };
    }
  },
  
  // Token-Validierung
  validateToken: async (token) => {
    console.log('%c[AUTH] Überprüfe Token-Gültigkeit', 'color: #0066aa;');
    
    try {
      // Wir verwenden den auth/user-Endpunkt zur Validierung
      // Wenn der Request erfolgreich ist, ist das Token gültig
      const response = await api.get('/auth/user');
      
      console.log('%c[AUTH] Token ist gültig, Benutzer authentifiziert', 'color: #00aa66;');
      
      // Wenn der Server erfolgreich antwortet, aktualisieren wir die lokalen Daten
      if (response.data && response.data.user) {
        localStorage.setItem('currentUser', JSON.stringify({
          id: response.data.user.id,
          name: response.data.user.name,
          email: response.data.user.email
        }));
        localStorage.setItem('isAuthenticated', 'true');
      }
      
      return true; // Token ist gültig
    } catch (error) {
      // 401/403 Fehler bedeuten ungültiges Token
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return false;
      }
      
      // Bei anderen Fehlern (z.B. Network Error): Fallback auf lokale Validierung mit Dekodierung
      console.warn('Backend nicht erreichbar, validiere Token lokal', error);
      
      // Prüfe, ob Authentifizierung im localStorage als true markiert ist
      const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
      
      if (isAuthenticated && token) {
        try {
          // Versuche das Token zu dekodieren, falls es ein Mock-Token ist
          if (token.startsWith('mock-jwt.')) {
            const parts = token.split('.');
            if (parts.length === 3) {
              // Das mittlere Segment enthält die Nutzerdaten
              const userDataBase64 = parts[1];
              // Decodiere Base64 zu String und parse als JSON
              const userData = JSON.parse(atob(userDataBase64));
              
              // Aktualisiere den localStorage mit den dekodierten Daten
              localStorage.setItem('currentUser', JSON.stringify({
                id: userData.id,
                name: userData.name,
                email: userData.email,
                isOwner: userData.isOwner
              }));
            }
          }
        } catch (e) {
          console.warn('Fehler beim Dekodieren des Mock-Tokens:', e);
        }
      }
      
      return isAuthenticated;
    }
  },
  
  // Benutzerinformationen direkt aus der Datenbank abrufen
  getCurrentUser: async () => {
    try {
      // Direkt vom Server laden, kein lokaler Cache mehr
      console.log('%c[AUTH] Lade Benutzerinformationen vom Server', 'color: #0066aa;');
      const response = await api.get('/auth/user');
      console.log('%c[AUTH] Benutzerinformationen geladen:', 'color: #00aa66;', response.data.user);
      
      return response.data.user;
    } catch (error) {
      console.error('[AUTH] Fehler beim Laden der Benutzerinformationen:', error);
      // Fallback nur bei Netzwerkfehlern oder wenn Mock-Daten explizit aktiviert sind
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('[AUTH] Verwende Mock-Daten für Benutzer');
        useMockData = true;
        // Keine Verwendung von localStorage mehr für Benutzerdaten
        const email = 'test@example.com';
        const name = 'Test-Benutzer';
        
        return {
          id: 1,
          name: name,
          email: email
        };
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen des Benutzers');
    }
  }
};

export const apartmentService = {
  // Alle Wohnungen abrufen
  getAll: async () => {
    try {
      const response = await api.get('/apartments');
      return response.data;
    } catch (error) {
      // Fallback auf Mock-Daten
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Wohnungen', error);
        useMockData = true;
        return mockData.apartments;
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Wohnungen');
    }
  },
  
  // Eine Wohnung nach ID abrufen
  getById: async (id) => {
    try {
      const response = await api.get(`/apartments/${id}`);
      return response.data;
    } catch (error) {
      // Fallback auf Mock-Daten
      if (useMockData || error.message.includes('Network Error')) {
        useMockData = true;
        return mockData.apartments.find(apt => apt.id === id) || null;
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Wohnung');
    }
  },
  
  // Neue Wohnung erstellen
  create: async (apartmentData) => {
    try {
      console.log('[API] Erstelle neue Wohnung:', apartmentData.name);
      
      // Kurze Verzögerung für bessere UX hinzufügen
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // API-Anfrage durchführen und auf Antwort warten
      const response = await api.post('/apartments', apartmentData);
      console.log('[API] Wohnung erfolgreich erstellt:', response.data);
      
      // Tatsächliches Apartment-Objekt mit der echten ID vom Server erstellen
      const newApartment = {
        id: response.data.id,
        name: apartmentData.name,
        address: apartmentData.address || '',
        isOwner: true // Als Ersteller ist man immer Owner
      };
      
      return newApartment;
    } catch (error) {
      // Fallback auf Mock-Daten
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, erstelle Mock-Wohnung', error);
        useMockData = true;
        
        const newApartment = {
          id: 'apt-' + Date.now(),
          name: apartmentData.name,
          address: apartmentData.address,
          owner: localStorage.getItem('mockUserEmail') || 'test@example.com',
          inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase()
        };
        
        mockData.apartments.push(newApartment);
        return newApartment;
      }
      throw error.response ? error.response.data : new Error('Fehler beim Erstellen der Wohnung');
    }
  },
  
  // Wohnung aktualisieren
  update: async (id, apartmentData) => {
    try {
      const response = await api.put(`/apartments/${id}`, apartmentData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Aktualisieren der Wohnung');
    }
  },
  
  // Wohnung löschen
  delete: async (id) => {
    try {
      const response = await api.delete(`/apartments/${id}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Löschen der Wohnung');
    }
  },
  
  // Einer Wohnung mit Einladungscode beitreten
  joinByCode: async (code) => {
    try {
      console.log(`[API] Versuche, mit Code beizutreten: ${code}`);
      
      // API-Anfrage durchführen und auf Ergebnis warten
      const response = await api.post('/roommates/join', { inviteCode: code });
      console.log('[API] Erfolgreich beigetreten:', response.data);
      
      // Kurze Verzögerung für bessere UX hinzufügen
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Tatsächliches Apartment-Objekt aus der API-Antwort erstellen
      const apartment = response.data.apartment || {
        id: response.data.apartmentId || 'apt-' + Date.now(),
        name: response.data.apartmentName || 'Beigetretene Wohnung',
        inviteCode: code
      };
      
      return apartment;
    } catch (error) {
      // Fallback auf Mock-Daten
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, simuliere Beitreten zu einer Wohnung', error);
        useMockData = true;
        
        // Suche nach einer Wohnung mit dem Code oder erstelle eine neue
        let apartment = mockData.apartments.find(apt => apt.inviteCode === code);
        
        if (!apartment) {
          // Erstelle eine neue Mock-Wohnung, wenn der Code nicht gefunden wurde
          apartment = {
            id: 'apt-join-' + Date.now(),
            name: 'Beigetretene Wohnung',
            address: 'Beispielstraße 42, 12345 Berlin',
            owner: 'einladender@beispiel.de',
            inviteCode: code
          };
          mockData.apartments.push(apartment);
        }
        
        return apartment;
      }
      throw error.response ? error.response.data : new Error('Fehler beim Beitreten der Wohnung');
    }
  }
};
// Einkaufsservice
export const shoppingService = {
  // Alle Einkaufslisten eines Apartments abrufen
  getAllLists: async (apartmentId) => {
    try {
      // Verwende den neuen apartment-spezifischen Endpunkt
      console.log(`[API] Rufe Einkaufslisten für Apartment ${apartmentId} ab`);
      const response = await api.get(`/shopping/apartment/${apartmentId}`);
      
      return response.data.map(list => ({
        id: list.id,
        name: list.name,
        date: list.date || new Date().toISOString()
      }));
    } catch (error) {
      console.error('[API] Fehler beim Abrufen der Einkaufslisten:', error);
      
      // Fallback für Entwicklung/Tests, falls der Endpunkt noch nicht verfügbar ist
      if (error.response && error.response.status === 404) {
        console.warn('[API] Fallback auf Legacy-Endpunkt /shopping');
        const legacyResponse = await api.get('/shopping');
        return legacyResponse.data.map(list => ({
          id: list.id,
          name: list.name,
          date: list.date || new Date().toISOString()
        }));
      }
      
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Einkaufslisten');
    }
  },
  
  // Items einer Einkaufsliste abrufen
  getListItems: async (apartmentId, listId) => {
    try {
      console.log(`[API] Rufe Items der Liste ${listId} für Apartment ${apartmentId} ab`);
      const response = await api.get(`/shopping/apartment/${apartmentId}/list/${listId}`);
      
      // Die Antwort enthält die Liste mit ihren Items
      const items = response.data.items || [];
      
      // Mapping für korrekte Kategorie- und Quantity-Unterstützung
      return items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity || '',
        category: item.category || 'sonstiges',
        completed: item.checked === 1 || item.checked === true
      }));
    } catch (error) {
      console.error(`[API] Fehler beim Abrufen der Items für Liste ${listId}:`, error);
      
      // Fallback auf Legacy-Endpunkt
      if (error.response && error.response.status === 404) {
        console.warn('[API] Fallback auf Legacy-Endpunkt');
        const legacyResponse = await api.get(`/shopping/${listId}`);
        const legacyItems = legacyResponse.data.items || [];
        
        return legacyItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity || '',
          category: item.category || 'sonstiges',
          completed: item.checked === 1 || item.checked === true
        }));
      }
      
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Einkaufsitems');
    }
  },
  
  // Neue Einkaufsliste erstellen
  createList: async (apartmentId, listData) => {
    try {
      console.log(`[API] Erstelle neue Einkaufsliste für Apartment ${apartmentId}`);
      
      const apiListData = {
        name: listData.name,
        date: new Date().toISOString()
      };
      
      // Neuen apartment-spezifischen Endpunkt verwenden
      const response = await api.post(`/shopping/apartment/${apartmentId}/list`, apiListData);
      
      // Benachrichtigung senden, wenn erfolgreich
      try {
        // Benutzerinfo aus dem localStorage holen
        const userRaw = localStorage.getItem('currentUser');
        const userData = userRaw ? JSON.parse(userRaw) : null;
        const userId = userData?.id;
        const userName = userData?.name || 'Jemand';  // Namen direkt verwenden
        
        // Integration verwenden und Namen direkt u00fcbergeben
        import('./notificationIntegration').then(async module => {
          const notifyService = module.default;
          notifyService.shopping.onListCreated(
            listData.name,
            apartmentId,
            userId,
            userName  // Wichtig: Direkter Name-Parameter
          );
        }).catch(err => console.warn('Fehler beim Laden des notificationService:', err));
      } catch (notifyError) {
        console.warn('Benachrichtigung konnte nicht gesendet werden:', notifyError);
      }
      
      // Kurze Verzögerung für bessere UX hinzufügen
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return {
        id: response.data.id,
        name: response.data.name,
        date: response.data.date || new Date().toISOString()
      };
    } catch (error) {
      console.error('[API] Fehler beim Erstellen einer Einkaufsliste:', error);
      
      // Fallback auf Legacy-Endpunkt
      if (error.response && error.response.status === 404) {
        console.warn('[API] Fallback auf Legacy-Endpunkt');
        const legacyResponse = await api.post('/shopping', {
          name: listData.name,
          date: new Date().toISOString().split('T')[0]
        });
        
        return {
          id: legacyResponse.data.id,
          name: listData.name,
          date: new Date().toISOString()
        };
      }
      
      throw error.response ? error.response.data : new Error('Fehler beim Erstellen der Einkaufsliste');
    }
  },
  
  // Einkaufsitem hinzufügen
  addItem: async (apartmentId, listId, itemData) => {
    try {
      console.log(`[API] Füge Item zur Liste ${listId} hinzu`);
      
      // API-Daten aufbereiten
      const apiItemData = {
        name: itemData.name,
        quantity: itemData.quantity || '',
        category: itemData.category || 'sonstiges',
        completed: itemData.completed || false
      };
      
      // Tatsächliche API-Anfrage durchführen und auf Ergebnis warten
      const response = await api.post(`/shopping/apartment/${apartmentId}/list/${listId}/items`, apiItemData);
      console.log(`[API] Item erfolgreich zur Liste ${listId} hinzugefügt`);
      
      // Direkte Benachrichtigung senden - genau wie in taskService
      try {
        // Zuerst die aktuelle Liste holen, um ihren Namen zu erhalten
        const listResponse = await api.get(`/shopping/apartment/${apartmentId}/list/${listId}`);
        const listName = listResponse.data.name || 'Einkaufsliste';
        
        // Benutzerinfo aus dem localStorage holen
        const userRaw = localStorage.getItem('currentUser');
        const userData = userRaw ? JSON.parse(userRaw) : null;
        const userId = userData?.id;
        const userName = userData?.name || 'Jemand';  // Namen direkt verwenden
        
        // Integration verwenden und Namen direkt u00fcbergeben
        import('./notificationIntegration').then(module => {
          const notifyService = module.default;
          notifyService.shopping.onItemAdded(
            itemData.name,
            listName,
            apartmentId,
            userId,
            userName  // Wichtig: Direkter Name-Parameter
          );
        }).catch(err => console.warn('Fehler beim Laden des notificationService:', err));
      } catch (notifyError) {
        console.warn('Benachrichtigung konnte nicht gesendet werden:', notifyError);
      }
      
      // Das echte Serverobjekt mit korrekter ID zurückgeben
      return response.data;
    } catch (error) {
      console.error(`[API] Fehler beim Hinzufügen eines Items zur Liste ${listId}:`, error);
      throw error.response ? error.response.data : new Error('Fehler beim Hinzufügen des Einkaufsitems');
    }
  },
  
  // Einkaufsitem aktualisieren (korrigierter Endpunkt: /shopping/:listId/items/:itemId/toggle)
  updateItem: async (apartmentId, listId, itemId, itemData) => {
    try {
      // Prüfe, ob es sich um eine temporäre ID handelt (temp_timestamp Format)
      if (String(itemId).startsWith('temp_')) {
        console.error(`[API] Kann temporäres Item ${itemId} nicht aktualisieren - warte bis das Item vollständig erstellt wurde`);
        throw new Error('Temporäre Items können nicht aktualisiert werden. Versuche es später erneut.');
      }
      
      console.log(`[API] Aktualisiere Item ${itemId} in Liste ${listId}`);
      
      // Wenn nur der completed-Status geändert wird, verwenden wir den toggle-Endpunkt
      if (itemData.completed !== undefined && Object.keys(itemData).length === 1) {
        console.log(`[API] Toggle Item-Status mit PATCH-Endpunkt /shopping/${listId}/items/${itemId}/toggle`);
        const response = await api.patch(`/shopping/${listId}/items/${itemId}/toggle`);
        
        try {
          console.log(`[API] Hole vollständige Liste, um Item-Daten zu erhalten`);
          // Alle List-Items abrufen
          const fullListResponse = await api.get(`/shopping/apartment/${apartmentId}/list/${listId}`);
          const itemData = fullListResponse.data.items.find(item => item.id === parseInt(itemId));
          
          if (itemData) {
            console.log(`[API] Item ${itemId} in der Liste gefunden, aktualisiere Status`);
            
            // Benachrichtigung senden, wenn Item abgehakt wurde
            if (response.data.checked) {
              // Benutzerinfo aus dem localStorage abrufen
              const userRaw = localStorage.getItem('currentUser');
              const userData = userRaw ? JSON.parse(userRaw) : null;
              const userId = userData?.id;
              const userName = userData?.name || 'Jemand';  // Namen direkt verwenden
              
              // Notifikations-Integration verwenden
              import('./notificationIntegration').then(module => {
                const notifyService = module.default;
                
                // Benachrichtigung für abgehaktes Item senden
                notifyService.shopping.onItemChecked(
                  itemData.name,
                  fullListResponse.data.name,
                  apartmentId,
                  userId,
                  userName  // Wichtig: Direkter Name-Parameter
                );
                
                // Wenn alle Items der Liste abgehakt sind, eine weitere Benachrichtigung senden
                const allItems = fullListResponse.data.items || [];
                const allChecked = allItems.every(item => 
                  (item.id === parseInt(itemId) ? true : (item.checked === 1 || item.checked === true))
                );
                
                if (allChecked && allItems.length > 0) {
                  notifyService.shopping.onListCompleted(
                    fullListResponse.data.name,
                    apartmentId,
                    userId,
                    userName  // Wichtig: Direkter Name-Parameter
                  );
                }
              }).catch(err => console.warn('Fehler beim Laden des notificationService:', err));
            }
            
            return {
              ...itemData,
              completed: response.data.checked
            };
          }
        } catch (err) {
          console.warn(`[API] Fehler beim Abrufen der Liste für Item-Daten:`, err);
        }
        
        // Fallback, wenn nichts klappt
        return {
          id: parseInt(itemId),
          completed: response.data.checked === true || response.data.checked === 1,
          name: 'Unbekanntes Produkt'  // Notfall-Fallback
        };
      } else {
        // Für andere Updates fehlt ein passender Endpunkt im Backend
        // Wir könnten hier entweder einen neuen Endpunkt im Backend erstellen oder
        // die betroffene Funktionalität im Frontend deaktivieren
        console.warn(`[API] Update von Name/Kategorie nicht unterstützt - Backend hat keinen passenden Endpunkt`);
        throw new Error('Update von Name/Kategorie wird nicht unterstützt');
      }
    } catch (error) {
      console.error(`[API] Fehler beim Aktualisieren des Items ${itemId}:`, error);
      throw error.response ? error.response.data : new Error('Fehler beim Aktualisieren des Einkaufsitems');
    }
  },
  
  // Alias für updateItem (für Kompatibilität mit ShoppingList.js)
  updateItemStatus: async (apartmentId, listId, itemId, completed) => {
    return await shoppingService.updateItem(apartmentId, listId, itemId, { completed });
  },
  
  // Einkaufsitem löschen (korrigierter Endpunkt: /shopping/:listId/items/:id)
  deleteItem: async (apartmentId, listId, itemId) => {
    try {
      console.log(`[API] Lösche Item ${itemId} aus Liste ${listId} über korrekten Endpunkt`);
      await api.delete(`/shopping/${listId}/items/${itemId}`);
      return true;
    } catch (error) {
      console.error(`[API] Fehler beim Löschen des Items ${itemId}:`, error);
      throw error.response ? error.response.data : new Error('Fehler beim Löschen des Einkaufsitems');
    }
  },
  
  // Einkaufsliste löschen
  deleteList: async (apartmentId, listId) => {
    try {
      console.log(`[API] Lösche Einkaufsliste ${listId} für Apartment ${apartmentId}`);
      await api.delete(`/shopping/apartment/${apartmentId}/list/${listId}`);
      return true;
    } catch (error) {
      console.error(`[API] Fehler beim Löschen der Einkaufsliste ${listId}:`, error);
      throw error.response ? error.response.data : new Error('Fehler beim Löschen der Einkaufsliste');
    }
  },
  
  // Einkaufslistenname aktualisieren
  updateListName: async (apartmentId, listId, newName) => {
    try {
      console.log(`[API] Aktualisiere Namen der Einkaufsliste ${listId} für Apartment ${apartmentId}`);
      
      // Verwende den speziellen Endpunkt zum Aktualisieren des Listennamens
      const response = await api.patch(`/shopping/apartment/${apartmentId}/list/${listId}/name`, { 
        name: newName
      });
      
      console.log('[API] Listenname erfolgreich aktualisiert:', response.data);
      
      // Gib die vom Server aktualisierte Liste zurück
      return {
        id: parseInt(listId),
        name: newName,
        date: response.data.date || new Date().toISOString()
      };
    } catch (error) {
      console.error(`[API] Fehler beim Aktualisieren des Listennamens ${listId}:`, error);
      
      // Bei einem Fehler versuchen wir den Fallback auf die Legacy-Route
      try {
        console.log('[API] Versuche Legacy-Endpunkt für Listenaktualisierung');
        
        const fallbackResponse = await api.put(`/shopping/${listId}`, { 
          name: newName,
          apartment_id: apartmentId
        });
        
        return {
          id: parseInt(listId),
          name: newName,
          date: fallbackResponse.data.date || new Date().toISOString()
        };
      } catch (fallbackError) {
        console.error('[API] Fehler auch bei Legacy-Endpunkt:', fallbackError);
        throw error.response ? error.response.data : new Error('Fehler beim Aktualisieren des Listennamens');
      }
    }
  }
};

// Finanzservice (neu hinzugefügt)
export const financeService = {
  // Alle Transaktionen abrufen
  getTransactions: async (apartmentId) => {
    try {
      console.log(`%c[FINANCES] Lade Transaktionen für Apartment ${apartmentId}`, 'color: #0066aa;');
      const response = await api.get(`/finances/${apartmentId}/transactions`);
      console.log('%c[FINANCES] Transaktionen erfolgreich geladen:', 'color: #00aa66;', response.data);
      return response.data;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Transaktionen', error);
        useMockData = true;
        return [
          { id: 1, description: 'Einkauf Aldi', amount: 35.50, payer: 'Max', 
            participants: ['Max', 'Anna', 'Lisa'], date: '2025-04-25' },
          { id: 2, description: 'Putzmittel', amount: 12.75, payer: 'Anna', 
            participants: ['Max', 'Anna'], date: '2025-04-26' },
          { id: 3, description: 'Pizza bestellt', amount: 24.90, payer: 'Lisa', 
            participants: ['Max', 'Lisa'], date: '2025-04-27' }
        ];
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Finanztransaktionen');
    }
  },
  
  // Mitbewohner einer Wohnung abrufen (für Finanzen)
  getRoommates: async (apartmentId) => {
    try {
      console.log(`%c[FINANCES] Lade Mitbewohner für Finanzen (Apartment ${apartmentId})`, 'color: #0066aa;');
      const response = await api.get(`/roommates/${apartmentId}/members`);
      console.log('%c[FINANCES] Mitbewohner für Finanzen erfolgreich geladen:', 'color: #00aa66;', response.data);
      return response.data;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Mitbewohner', error);
        useMockData = true;
        return [
          { id: 1, name: 'Max' },
          { id: 2, name: 'Anna' },
          { id: 3, name: 'Lisa' }
        ];
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Mitbewohner');
    }
  },
  
  // Neue Transaktion hinzufügen
  addTransaction: async (apartmentId, txData) => {
    try {
      console.log(`%c[FINANCES] Füge neue Transaktion für Apartment ${apartmentId} hinzu`, 'color: #0066aa;', txData);
      const response = await api.post(`/finances/${apartmentId}/transactions`, txData);
      console.log('%c[FINANCES] Transaktion erfolgreich hinzugefügt:', 'color: #00aa66;', response.data);
      return response.data;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, erstelle Mock-Transaktion', error);
        useMockData = true;
        return { id: Date.now(), ...txData };
      }
      throw error.response ? error.response.data : new Error('Fehler beim Erstellen der Transaktion');
    }
  },
  
  // Transaktion löschen
  deleteTransaction: async (apartmentId, txId) => {
    try {
      console.log(`%c[FINANCES] Lösche Transaktion ${txId} für Apartment ${apartmentId}`, 'color: #0066aa;');
      await api.delete(`/finances/${apartmentId}/transactions/${txId}`);
      console.log('%c[FINANCES] Transaktion erfolgreich gelöscht', 'color: #00aa66;');
      return true;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, lösche Mock-Transaktion', error);
        useMockData = true;
        return true;
      }
      throw error.response ? error.response.data : new Error('Fehler beim Löschen der Transaktion');
    }
  }
};

// Mitbewohnerservice (neu hinzugefügt)
export const roommateService = {
  // Alle Mitbewohner einer Wohnung abrufen
  getAll: async (apartmentId) => {
    try {
      console.log(`%c[ROOMMATES] Lade Mitbewohner für Apartment ${apartmentId}`, 'color: #0066aa;');
      // Detaillierter Request-Log
      console.log(`%c[ROOMMATES] Request-URL: ${API_URL}/roommates/${apartmentId}/members`, 'color: #0066cc;');
      
      const response = await api.get(`/roommates/${apartmentId}/members`);
      console.log('%c[ROOMMATES] Mitbewohner erfolgreich geladen:', 'color: #00aa66;', response.data);
      return response.data;
    } catch (error) {
      // Verbesserte Fehlerbehandlung mit detaillierten Logs
      console.error('%c[ROOMMATES] Fehler beim Laden der Mitbewohner:', 'color: #cc0000; font-weight: bold;');
      console.error(`%c[ROOMMATES] Fehlermeldung: ${error.message}`, 'color: #cc0000;');
      console.error(`%c[ROOMMATES] API-Endpunkt: ${API_URL}/roommates/${apartmentId}/members`, 'color: #cc0000;');
      console.error(`%c[ROOMMATES] HTTP-Status: ${error.response ? error.response.status : 'Keine HTTP-Antwort'}`, 'color: #cc0000;');
      console.error(`%c[ROOMMATES] Fehlerdetails:`, 'color: #cc0000;', error.response ? error.response.data : error);
      
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('%c[ROOMMATES] Backend nicht erreichbar, verwende Mock-Mitbewohner', 'color: #ff9900;', error);
        useMockData = true;
        // Zeitstempel für Beitrittsdaten erstellen
        const now = new Date();
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const twoMonthsAgo = new Date(now);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        
        return [
          { id: 1, name: 'Max Mustermann', email: 'max@example.com', isOwner: true, joinedAt: twoMonthsAgo.toISOString() },
          { id: 2, name: 'Anna Schmidt', email: 'anna@example.com', isOwner: false, joinedAt: oneMonthAgo.toISOString() },
          { id: 3, name: 'Lisa Meyer', email: 'lisa@example.com', isOwner: false, joinedAt: now.toISOString() }
        ];
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Mitbewohner');
    }
  },
  
  // Bestehenden Einladungscode abrufen
  getInviteCode: async (apartmentId) => {
    try {
      console.log(`%c[INVITE] Lade Einladungscode für Apartment ${apartmentId}`, 'color: #0066aa;');
      const response = await api.get(`/roommates/${apartmentId}/invite-code`);
      console.log('%c[INVITE] Einladungscode erfolgreich geladen:', 'color: #00aa66;', response.data);
      return response.data.inviteCode;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Einladungscode', error);
        useMockData = true;
        return 'ABC123';  // Statischer Mock-Code für Konsistenz
      }
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen des Einladungscodes');
    }
  },
  
  // Neuen Einladungscode generieren
  generateInviteCode: async (apartmentId) => {
    try {
      console.log(`%c[INVITE] Generiere neuen Einladungscode für Apartment ${apartmentId}`, 'color: #0066aa;');
      const response = await api.post(`/roommates/${apartmentId}/invite-code`);
      console.log('%c[INVITE] Neuer Einladungscode erfolgreich generiert:', 'color: #00aa66;', response.data);
      return response.data.inviteCode;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, generiere Mock-Einladungscode', error);
        useMockData = true;
        return Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      throw error.response ? error.response.data : new Error('Fehler beim Generieren des Einladungscodes');
    }
  },
  
  // Mitbewohner aus Wohnung entfernen
  removeMember: async (apartmentId, memberId) => {
    try {
      console.log(`%c[ROOMMATES] Entferne Mitbewohner ${memberId} aus Apartment ${apartmentId}`, 'color: #0066aa;');
      await api.delete(`/roommates/${apartmentId}/members/${memberId}`);
      console.log('%c[ROOMMATES] Mitbewohner erfolgreich entfernt', 'color: #00aa66;');
      return true;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, entferne Mock-Mitbewohner', error);
        useMockData = true;
        return true;
      }
      throw error.response ? error.response.data : new Error('Fehler beim Entfernen des Mitbewohners');
    }
  },
  
  // Eigentum einer Wohnung auf einen anderen Mitbewohner übertragen
  transferOwnership: async (apartmentId, newOwnerId) => {
    try {
      console.log(`%c[ROOMMATES] Übertrage Eigentum von Apartment ${apartmentId} an Mitbewohner ${newOwnerId}`, 'color: #0066aa;');
      const response = await api.post(`/roommates/${apartmentId}/transfer-ownership/${newOwnerId}`);
      console.log('%c[ROOMMATES] Eigentum erfolgreich übertragen', 'color: #00aa66;', response.data);
      return response.data;
    } catch (error) {
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, übertrage Eigentum im Mock-Modus', error);
        useMockData = true;
        return { message: 'Eigentum im Mock-Modus übertragen (Backend nicht erreichbar)' };
      }
      throw error.response ? error.response.data : new Error('Fehler bei der Übertragung des Eigentums');
    }
  }
};

export const settingsService = {
  // Benutzereinstellungen abrufen
  getSettings: async () => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Benutzereinstellungen');
    }
  },
  
  // Benutzereinstellungen aktualisieren
  updateSettings: async (settingsData) => {
    try {
      const response = await api.put('/settings', settingsData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Aktualisieren der Benutzereinstellungen');
    }
  },
  
  // Neue Einkaufsliste erstellen
  createList: async (listData) => {
    try {
      const response = await api.post('/shopping', listData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Erstellen der Einkaufsliste');
    }
  },
  
  // Einkaufsliste aktualisieren
  updateList: async (id, listData) => {
    try {
      const response = await api.put(`/shopping/${id}`, listData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Aktualisieren der Einkaufsliste');
    }
  },
  
  // Einkaufsliste löschen
  deleteList: async (id) => {
    try {
      const response = await api.delete(`/shopping/${id}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Löschen der Einkaufsliste');
    }
  },
  
  // Neues Element zu einer Einkaufsliste hinzufügen
  addItem: async (listId, itemData) => {
    try {
      const response = await api.post(`/shopping/${listId}/items`, itemData);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Hinzufügen des Artikels');
    }
  },
  
  // Status eines Einkaufsartikels ändern (gekauft/nicht gekauft)
  toggleItemStatus: async (listId, itemId) => {
    try {
      const response = await api.patch(`/shopping/${listId}/items/${itemId}/toggle`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Ändern des Artikelstatus');
    }
  },
  
  // Einkaufsartikel löschen
  deleteItem: async (listId, itemId) => {
    try {
      const response = await api.delete(`/shopping/${listId}/items/${itemId}`);
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data : new Error('Fehler beim Löschen des Artikels');
    }
  }
};

// Chat Service importieren und re-exportieren
import { chatService } from './chatService';
export { chatService };

export default api;
