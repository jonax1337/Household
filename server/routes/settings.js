const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'household-app-secret-key';

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
    res.status(401).json({ message: 'Token ist ungu00fcltig' });
  }
};

// Benutzereinstellungen abrufen
router.get('/', verifyToken, async (req, res) => {
  try {
    const [settings] = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );
    
    if (settings.length === 0) {
      // Falls keine Einstellungen gefunden wurden, erstelle Standardeinstellungen
      await pool.query(
        'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
        [req.user.id, 'system']
      );
      
      return res.json({ theme: 'system' });
    }
    
    res.json(settings[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzereinstellungen:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Benutzereinstellungen aktualisieren
router.put('/', verifyToken, async (req, res) => {
  try {
    const { theme } = req.body;
    
    // Pru00fcfen, ob gu00fcltiges Theme
    if (!['light', 'dark', 'cute', 'system'].includes(theme)) {
      return res.status(400).json({ message: 'Ungu00fcltiges Theme' });
    }
    
    // Pru00fcfen, ob Einstellungen existieren
    const [settings] = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );
    
    if (settings.length === 0) {
      // Einstellungen erstellen, falls nicht vorhanden
      await pool.query(
        'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
        [req.user.id, theme]
      );
    } else {
      // Einstellungen aktualisieren
      await pool.query(
        'UPDATE user_settings SET theme = ? WHERE user_id = ?',
        [theme, req.user.id]
      );
    }
    
    res.json({ 
      message: 'Einstellungen erfolgreich aktualisiert',
      theme
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Benutzereinstellungen:', error);
    res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Benutzereinstellungen' });
  }
});

module.exports = router;
