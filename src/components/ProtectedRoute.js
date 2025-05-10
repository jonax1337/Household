import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Geschützte Route, die nur für authentifizierte Benutzer zugänglich ist
 * @param {Object} props - Komponenten-Props
 * @param {boolean} props.isLoggedIn - Gibt an, ob der Benutzer angemeldet ist
 * @param {React.ReactNode} props.children - Die zu rendernden Kind-Komponenten
 */
const ProtectedRoute = ({ isLoggedIn, children }) => {
  // Wenn nicht angemeldet, zur Login-Seite umleiten
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  
  // Wenn authentifiziert, die geschützten Komponenten anzeigen
  return children;
};

export default ProtectedRoute;
