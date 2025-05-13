const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'household-app-secret-key';

// Hilfsfunktion zum Prüfen, ob eine Tabellenspalte existiert
const checkColumnExists = async (tableName, columnName) => {
  const [columns] = await pool.query(
    `SHOW COLUMNS FROM ${tableName} LIKE ?`,
    [columnName]
  );
  return columns.length > 0;
};

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

// Benutzerprofileinstellungen abrufen
router.get('/profile', verifyToken, async (req, res) => {
  try {
    // Zuerst prüfen, ob die neuen Spalten in der users-Tabelle existieren
    const initialsColumnExists = await checkColumnExists('users', 'initials');
    const profileColorColumnExists = await checkColumnExists('users', 'profile_color');

    // Wenn die Spalten nicht existieren, gib eine Fehlermeldung zurück
    if (!initialsColumnExists || !profileColorColumnExists) {
      console.error('Erforderliche DB-Spalten fehlen:', {
        initialsColumnExists, 
        profileColorColumnExists
      });
      return res.status(500).json({ 
        message: 'Die erforderlichen Datenbankstrukturen sind nicht vollständig eingerichtet.',
        details: `Fehlende Spalten: ${!initialsColumnExists ? 'initials, ' : ''}${!profileColorColumnExists ? 'profile_color' : ''}`
      });
    }

    // User-Daten aus der Datenbank abrufen
    const [users] = await pool.query(
      'SELECT initials, profile_color FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    // Benutzerprofileinstellungen zurückgeben
    res.json({
      initials: users[0].initials || null,
      profile_color: users[0].profile_color || '#4a90e2' // Standardfarbe, falls nicht gesetzt
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerprofileinstellungen:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Benutzerprofileinstellungen aktualisieren
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { initials, profile_color } = req.body;
    
    // Validierung
    if (initials && (typeof initials !== 'string' || initials.length > 2)) {
      return res.status(400).json({ message: 'Initialien dürfen maximal 2 Zeichen lang sein' });
    }
    
    if (profile_color && (typeof profile_color !== 'string' || !profile_color.match(/^#[0-9A-Fa-f]{6}$/))) {
      return res.status(400).json({ message: 'Ungültiges Farbformat. Verwende das Format #RRGGBB' });
    }
    
    // Update-Felder vorbereiten
    const updateFields = [];
    const values = [];
    
    if (initials !== undefined) {
      updateFields.push('initials = ?');
      values.push(initials);
    }
    
    if (profile_color !== undefined) {
      updateFields.push('profile_color = ?');
      values.push(profile_color);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'Keine Änderungen spezifiziert' });
    }
    
    // User-ID hinzufügen
    values.push(req.user.id);
    
    // Update durchführen
    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    // Aktualisierte Daten zurückgeben
    const [updatedUser] = await pool.query(
      'SELECT initials, profile_color FROM users WHERE id = ?',
      [req.user.id]
    );
    
    res.json({
      message: 'Benutzerprofileinstellungen erfolgreich aktualisiert',
      initials: updatedUser[0].initials,
      profile_color: updatedUser[0].profile_color
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Benutzerprofileinstellungen:', error);
    res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Benutzerprofileinstellungen' });
  }
});

module.exports = router;
