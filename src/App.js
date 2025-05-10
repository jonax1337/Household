import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { authService, apartmentService } from './services/api';
import { ThemeProvider } from './context/ThemeContext';

// Importiere modulare Komponenten
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import CleaningSchedule from './components/CleaningSchedule';
import ShoppingList from './components/ShoppingList';
import Finances from './components/Finances';
import Roommates from './components/Roommates';
import Settings from './components/Settings';
import Chat from './components/Chat';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';

// Importiere Stile
import './styles.css';
import './components/styles.css';

function App() {
  // Router-Navigation
  const navigate = useNavigate();
  
  // Hauptzustände der Anwendung - werden nun als Context durchgereicht
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Prüfen, ob der Benutzer bereits angemeldet ist (Token im localStorage)
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Überprüfe, ob das Token noch gültig ist
          const isValid = await authService.validateToken(token);
          if (isValid) {
            setIsLoggedIn(true);
            loadUserApartments(); // Lade Wohnungen, wenn der Benutzer angemeldet ist
            
            // HIER NEU: Lade Benutzerdaten aus dem localStorage
            try {
              const userDataString = localStorage.getItem('currentUser');
              if (userDataString) {
                const userData = JSON.parse(userDataString);
                console.log('%c[APP] Benutzerdaten aus localStorage geladen:', 'color: #00aa66;', userData);
                setCurrentUser(userData);
              } else {
                // Wenn keine Benutzerdaten im localStorage sind, versuche sie vom Server zu laden
                const fetchedUser = await authService.getCurrentUser();
                if (fetchedUser) {
                  setCurrentUser(fetchedUser);
                  localStorage.setItem('currentUser', JSON.stringify(fetchedUser));
                }
              }
            } catch (userError) {
              console.error('Fehler beim Laden der Benutzerdaten:', userError);
            }
          } else {
            // Token ist ungültig oder abgelaufen
            localStorage.removeItem('token');
            setIsLoggedIn(false);
          }
        } catch (error) {
          console.error('Fehler bei der Token-Validierung:', error);
          // Bei Fehler im Offline-Modus trotzdem anmelden lassen
          setIsLoggedIn(true);
          // Versuche lokale Apartments zu laden
          const localApartments = JSON.parse(localStorage.getItem('apartments') || '[]');
          setApartments(localApartments);
          
          // Auch hier Benutzerdaten laden
          try {
            const userDataString = localStorage.getItem('currentUser');
            if (userDataString) {
              setCurrentUser(JSON.parse(userDataString));
            }
          } catch (e) {
            console.error('Fehler beim Laden der Offline-Benutzerdaten:', e);
          }
        }
      }
    };

    checkAuth();
    
    // Glasmorphismus Hintergrund-Animation
    const shapes = document.querySelectorAll('.bg-shape');
    
    const moveShapes = (e) => {
      if (!shapes.length) return;
      
      const mouseX = e ? e.clientX : window.innerWidth / 2;
      const mouseY = e ? e.clientY : window.innerHeight / 2;
      
      shapes.forEach(shape => {
        const speed = parseFloat(shape.getAttribute('data-speed')) || 0.05;
        const x = (window.innerWidth / 2 - mouseX) * speed;
        const y = (window.innerHeight / 2 - mouseY) * speed;
        
        shape.style.transform = `translate(${x}px, ${y}px)`;
      });
    };
    
    window.addEventListener('mousemove', moveShapes);
    // Initial positionieren
    moveShapes();
    
    return () => {
      window.removeEventListener('mousemove', moveShapes);
    };
  }, []);

  // Wohnungen laden
  const loadUserApartments = async () => {
    try {
      const userApartments = await apartmentService.getAll();
      setApartments(userApartments);
      
      // Speichere auch lokal für Offline-Modus
      localStorage.setItem('apartments', JSON.stringify(userApartments));
    } catch (error) {
      console.error('Fehler beim Laden der Wohnungen:', error);
      // Im Offline-Modus: Verwende lokale Daten falls vorhanden
      const localApartments = JSON.parse(localStorage.getItem('apartments') || '[]');
      setApartments(localApartments);
    }
  };

  // Neue Wohnung hinzufügen - gibt ein Promise zurück für besseres UI-Feedback
  // WICHTIG: Nur eine Wohnung pro Konto ist erlaubt - alte Wohnungen werden entfernt!
  const handleAddApartment = async (name, address) => {
    console.log('handleAddApartment aufgerufen mit:', name, address);
    
    if (!name || !address) {
      throw new Error('Bitte gib einen Namen und eine Adresse für die Wohnung ein!');
    }
    
    try {
      // Erstelle die Wohnungsdaten
      const apartmentData = { name: name.trim(), address: address.trim() };
      console.log('Versuche, Wohnung zu erstellen mit:', apartmentData);
      
      // API-Aufruf zur Erstellung
      const newApartment = await apartmentService.create(apartmentData);
      console.log('Neue Wohnung erstellt:', newApartment);
      
      // WICHTIG: Nur eine Wohnung erlauben - alte Wohnungen entfernen
      // Aktualisiere den lokalen State - ersetze alle bisherigen Wohnungen
      setApartments([newApartment]);
      
      // Wähle die neue Wohnung aus
      setSelectedApartment(newApartment);
      
      // Speichere auch lokal für Offline-Modus - nur die neue Wohnung
      localStorage.setItem('apartments', JSON.stringify([newApartment]));
      
      // Gib die neue Wohnung zurück
      return newApartment;
    } catch (error) {
      console.error('Fehler beim Erstellen der Wohnung:', error);
      
      // Fallback für Offline-Modus: Erstelle lokal
      const mockApartment = { 
        id: Date.now(), 
        name, 
        address, 
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: new Date().toISOString()
      };
      
      // Ersetze alle bisherigen Wohnungen durch die neue
      setApartments([mockApartment]);
      
      // Speichere auch lokal - nur die neue Wohnung
      localStorage.setItem('apartments', JSON.stringify([mockApartment]));
      
      // Wähle die neue Wohnung aus
      setSelectedApartment(mockApartment);
      
      // Gib die lokal erstellte Wohnung zurück
      return mockApartment;
    }
  };

  // Wohnung mit Code beitreten
  const handleJoinApartment = async (code) => {
    if (!code) {
      throw new Error('Kein Einladungscode angegeben');
    }
    
    try {
      // Beitreten zur Wohnung über den API-Service
      const joinedApartment = await apartmentService.joinByCode(code);
      
      if (joinedApartment) {
        console.log('Erfolgreich beigetreten zur Wohnung:', joinedApartment);
        
        // Wohnungen neu laden, um sicherzustellen, dass alles aktuell ist
        await loadUserApartments();
        
        // Wenn die Apartment-Liste leer ist, die neu beigetretene Wohnung direkt hinzufügen
        if (apartments.length === 0) {
          setApartments([joinedApartment]);
        }
        
        // Optional: Direkt zur neu beigetretenen Wohnung wechseln
        setSelectedApartment(joinedApartment);
        
        return joinedApartment;
      } else {
        throw new Error('Beitreten fehlgeschlagen: Keine Wohnung gefunden');
      }
    } catch (error) {
      console.error('Fehler beim Beitreten der Wohnung:', error);
      throw new Error(error.message || 'Ungültiger Einladungscode');
    }
  };

  // Logout-Handler
  const handleLogout = async () => {
    try {
      await authService.logout();
      localStorage.removeItem('token');
      setIsLoggedIn(false);
      setSelectedApartment(null);
    } catch (error) {
      console.error('Logout fehlgeschlagen:', error);
      // Bei Fehlern im Offline-Modus trotzdem abmelden
      localStorage.removeItem('token');
      setIsLoggedIn(false);
      setSelectedApartment(null);
    }
  };

  // Wechsel zwischen Login und Register - nun mit Router-Navigation
  const switchToRegister = () => {
    navigate('/register');
  };

  const switchToLogin = () => {
    navigate('/login');
  };

  // Login-Erfolg-Handler
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    loadUserApartments();
  };
  
  // Register-Erfolg-Handler
  const handleRegisterSuccess = () => {
    setIsLoggedIn(true);
    // Bei neuer Registrierung starten wir mit leerer Wohnungsliste
    setApartments([]);
  };

  // Aktueller Benutzer laden
  useEffect(() => {
    if (isLoggedIn) {
      authService.getCurrentUser()
        .then(user => {
          setCurrentUser(user);
        })
        .catch(error => {
          console.error('Fehler beim Laden des Benutzers:', error);
          // Fallback auf Mock-Daten wenn keine Verbindung
          setCurrentUser({ id: 1, name: 'Test User', email: 'test@example.com' });
        });
    } else {
      setCurrentUser(null);
    }
  }, [isLoggedIn]);

  // Navigiere zum Login, wenn der Benutzer nicht angemeldet ist
  useEffect(() => {
    if (!isLoggedIn && !['/login', '/register'].includes(window.location.pathname)) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  // Zentralisierter State, der an die Komponenten weitergegeben wird
  const appState = {
    apartments,
    setApartments,
    selectedApartment,
    setSelectedApartment,
    loadUserApartments,
    handleAddApartment,
    handleJoinApartment,
    inviteCode,
    setInviteCode,
    currentUser,
    handleLogout
  };

  return (
    <ThemeProvider>
      <div className="app">
        {/* Hintergrund-Shapes für Glasmorphismus-Effekt */}
        <div className="bg-shape bg-shape-1" data-speed="0.03"></div>
        <div className="bg-shape bg-shape-2" data-speed="0.05"></div>
        <div className="bg-shape bg-shape-3" data-speed="0.02"></div>
        
        <Routes>
          {/* Öffentliche Routen */}
          <Route
            path="/"
            element={isLoggedIn ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
          />
          
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to="/dashboard" />
              ) : (
                <Login
                  onSwitchToRegister={switchToRegister}
                  onLoginSuccess={handleLoginSuccess}
                />
              )
            }
          />
          
          <Route
            path="/register"
            element={
              isLoggedIn ? (
                <Navigate to="/dashboard" />
              ) : (
                <Register
                  onSwitchToLogin={switchToLogin}
                  onRegisterSuccess={handleRegisterSuccess}
                />
              )
            }
          />

          {/* Geschützte Routen */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Dashboard {...appState} />
              </ProtectedRoute>
            }
          />

          {/* CleaningSchedule Route */}
          <Route
            path="/cleaning"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <CleaningSchedule
                  selectedApartment={selectedApartment}
                  loadUserApartments={loadUserApartments}
                />
              </ProtectedRoute>
            }
          />

          {/* ShoppingList Route */}
          <Route
            path="/shopping"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <ShoppingList
                  selectedApartment={selectedApartment}
                  loadUserApartments={loadUserApartments}
                />
              </ProtectedRoute>
            }
          />

          {/* Chat Route */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Chat
                  apartmentId={selectedApartment?.id}
                />
              </ProtectedRoute>
            }
          />

          {/* Finances Route */}
          <Route
            path="/finances"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Finances
                  selectedApartment={selectedApartment}
                  loadUserApartments={loadUserApartments}
                />
              </ProtectedRoute>
            }
          />

          {/* Roommates Route */}
          <Route
            path="/roommates"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Roommates
                  selectedApartment={selectedApartment}
                  loadUserApartments={loadUserApartments}
                  currentUser={currentUser}
                />
              </ProtectedRoute>
            }
          />
          
          {/* Settings Route - neu hinzugefügt */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute isLoggedIn={isLoggedIn}>
                <Settings
                  handleLogout={handleLogout}
                  currentUser={currentUser}
                  selectedApartment={selectedApartment}
                  setSelectedApartment={setSelectedApartment}
                  apartments={apartments}
                  setApartments={setApartments}
                />
              </ProtectedRoute>
            }
          />
          
          {/* Login-Route */}
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to="/dashboard" />
              ) : (
                <Login 
                  switchToRegister={switchToRegister}
                  onLoginSuccess={handleLoginSuccess}
                />
              )
            }
          />
          
          {/* Fallback-Route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        
        {/* Bottom Navigation - immer anzeigen, direkte Einbindung ohne Container */}
        <Navigation onTabChange={(path) => navigate(path)} />
      </div>
    </ThemeProvider>
  );
}

export default App;
