const jwt = require('jsonwebtoken');

// JWT Secret aus Umgebungsvariablen oder Fallback
const JWT_SECRET = process.env.JWT_SECRET || 'household-app-secret-key';

/**
 * Middleware zum Verifizieren des JWT-Tokens
 * Wird für geschützte Routen verwendet
 */
module.exports = (req, res, next) => {
  // Token aus Header holen
  const token = req.header('x-auth-token');
  
  // Wenn kein Token vorhanden ist, Zugriff verweigern
  if (!token) {
    return res.status(401).json({ message: 'Kein Token, Authentifizierung verweigert' });
  }
  
  try {
    // Token verifizieren
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Benutzer-ID an Request-Objekt anhängen
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token Verifizierungsfehler:', error.message);
    res.status(401).json({ message: 'Token ist ungültig oder abgelaufen' });
  }
};
