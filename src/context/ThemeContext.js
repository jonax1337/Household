import React, { createContext, useContext, useState, useEffect } from 'react';
import styled, { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { settingsService } from '../services/api';
import './ThemeContext.css'; // Importiere die Theme-CSS-Datei

// Themen-Definitionen
const themes = {
  light: {
    name: 'light',
    primary: '#007AFF',        // iOS Blau
    secondary: '#FF9500',      // iOS Orange
    background: '#F2F2F7',     // iOS Hintergrund hell
    cardBackground: '#FFFFFF', // Kartenhintergrund
    text: '#000000',           // Textfarbe
    textSecondary: '#8E8E93',  // Sekundäre Textfarbe
    border: '#C7C7CC',         // Rahmenfarbe
    success: '#34C759',        // iOS Grün
    warning: '#FF9500',        // iOS Orange
    error: '#FF3B30',          // iOS Rot
    buttonRadius: '8px',       // Standard iOS Button-Radius
    cardRadius: '12px',        // Standard iOS Card-Radius
    shadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  dark: {
    name: 'dark',
    primary: '#0A84FF',        // iOS Blau (Dunkel)
    secondary: '#FF9F0A',      // iOS Orange (Dunkel)
    background: '#1C1C1E',     // iOS Hintergrund dunkel
    cardBackground: '#2C2C2E', // Kartenhintergrund
    text: '#FFFFFF',           // Textfarbe
    textSecondary: '#8E8E93',  // Sekundäre Textfarbe
    border: '#38383A',         // Rahmenfarbe
    success: '#30D158',        // iOS Grün (Dunkel)
    warning: '#FF9F0A',        // iOS Orange (Dunkel)
    error: '#FF453A',          // iOS Rot (Dunkel)
    buttonRadius: '8px',       // Standard iOS Button-Radius
    cardRadius: '12px',        // Standard iOS Card-Radius
    shadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  cute: {
    name: 'cute',
    primary: '#FF6AC1',        // Rosa
    secondary: '#85D3FF',      // Helles Blau
    background: '#FFF6FA',     // Sehr helles Rosa
    cardBackground: '#FFFFFF', // Kartenhintergrund
    text: '#6A4670',           // Dunkles Violett für Text
    textSecondary: '#A78BAB',  // Helles Violett
    border: '#FFDCEF',         // Helles Rosa
    success: '#9AE78B',        // Pastellgrün
    warning: '#FFD26A',        // Pastellgelb
    error: '#FF8FAD',          // Pastellrot
    buttonRadius: '20px',      // Abgerundete Buttons
    cardRadius: '24px',        // Stark abgerundete Karten
    shadow: '0 4px 12px rgba(255, 106, 193, 0.15)',
  },
};

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

// Funktion zum Erkennen des System-Themes
const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    // Prüfe, ob das System dunkles Theme verwendet
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light'; // Fallback, wenn matchMedia nicht verfügbar ist
};

export const ThemeProvider = ({ children }) => {
  // Gespeichertes Thema aus dem lokalen Speicher abrufen oder Standardwert verwenden
  const storedThemePreference = localStorage.getItem('themePreference') || 'system';
  const [themePreference, setThemePreference] = useState(storedThemePreference);
  const [currentTheme, setCurrentTheme] = useState('light'); // Wird basierend auf der Präferenz gesetzt
  const [isLoading, setIsLoading] = useState(false);

  // Thema-Präferenz ändern (system, light, dark, cute)
  const changeThemePreference = async (preference) => {
    setThemePreference(preference);
    localStorage.setItem('themePreference', preference);
    
    // Wenn ein Benutzer angemeldet ist, synchronisiere die Einstellung mit dem Backend
    if (localStorage.getItem('isAuthenticated') === 'true') {
      try {
        setIsLoading(true);
        await settingsService.updateSettings({ theme: preference });
      } catch (error) {
        console.error('Fehler beim Speichern der Theme-Einstellung:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Lade Benutzereinstellungen vom Server, wenn ein Benutzer angemeldet ist
  useEffect(() => {
    const loadUserSettings = async () => {
      if (localStorage.getItem('isAuthenticated') === 'true') {
        try {
          setIsLoading(true);
          const settings = await settingsService.getSettings();
          if (settings && settings.theme) {
            setThemePreference(settings.theme);
            localStorage.setItem('themePreference', settings.theme);
          }
        } catch (error) {
          console.error('Fehler beim Laden der Benutzereinstellungen:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadUserSettings();
  }, []);

  // Aktualisiere das Theme basierend auf der Präferenz und dem Systemtheme
  useEffect(() => {
    const updateTheme = () => {
      if (themePreference === 'system') {
        // System-Theme verwenden
        const systemTheme = getSystemTheme();
        setCurrentTheme(systemTheme);
        
        // Entferne alle Theme-Klassen vom body
        document.body.classList.remove('light-theme', 'dark-theme', 'cute-theme');
        // Füge die entsprechende Theme-Klasse hinzu
        document.body.classList.add(`${systemTheme}-theme`);
      } else {
        // Benutzerdefiniertes Theme verwenden
        setCurrentTheme(themePreference);
        
        // Entferne alle Theme-Klassen vom body
        document.body.classList.remove('light-theme', 'dark-theme', 'cute-theme');
        // Füge die entsprechende Theme-Klasse hinzu
        document.body.classList.add(`${themePreference}-theme`);
      }
    };

    updateTheme();

    // Event-Listener für Änderungen des System-Themes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themePreference === 'system') {
        setCurrentTheme(getSystemTheme());
      }
    };

    // Abhängig vom Browser die richtige Methode verwenden
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      // Alte API für ältere Browser
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [themePreference]);

  // Das aktuelle Theme-Objekt aus unserer Themes-Sammlung
  const activeTheme = themes[currentTheme];

  return (
    <ThemeContext.Provider value={{ 
      theme: activeTheme, 
      currentTheme, 
      themePreference,
      changeThemePreference,
      themes,
      isSystemTheme: themePreference === 'system'
    }}>
      <StyledThemeProvider theme={activeTheme}>
        {children}
      </StyledThemeProvider>
    </ThemeContext.Provider>
  );
};
