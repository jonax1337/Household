const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// JWT Secret aus Umgebungsvariablen oder Fallback
const JWT_SECRET = process.env.JWT_SECRET || 'household-app-secret-key';

// Registrierung
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Prüfen, ob Benutzer bereits existiert
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }
    
    // Passwort hashen
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Benutzer in Datenbank speichern
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
    
    // Standard-Theme-Einstellung erstellen
    await pool.query(
      'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
      [result.insertId, 'system']
    );
    
    // JWT erstellen
    const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: '1d' });
    
    res.status(201).json({
      message: 'Benutzer erfolgreich registriert',
      token,
      user: {
        id: result.insertId,
        name,
        email
      }
    });
  } catch (error) {
    console.error('Registrierungsfehler:', error);
    res.status(500).json({ message: 'Serverfehler bei der Registrierung' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Benutzer finden
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'Ungültige E-Mail oder Passwort' });
    }
    
    const user = users[0];
    
    // Passwort überprüfen
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(400).json({ message: 'Ungültige E-Mail oder Passwort' });
    }
    
    // JWT erstellen
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      message: 'Login erfolgreich',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login-Fehler:', error);
    res.status(500).json({ message: 'Serverfehler beim Login' });
  }
});

// Authentifizierungs-Middleware
const verifyToken = (req, res, next) => {
  const token = req.header('x-auth-token');
  
  if (!token) {
    return res.status(401).json({ message: 'Kein Token, Authentifizierung verweigert' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token ist ungültig' });
  }
};

// Benutzerinformationen abrufen (geschützte Route)
router.get('/user', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

module.exports = router;
