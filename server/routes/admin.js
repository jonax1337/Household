const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');

// JWT Secret aus Umgebungsvariablen oder Fallback
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
    res.status(401).json({ message: 'Token ist ungültig' });
  }
};

// Hilfsfunktion zum Überprüfen des Admin-Status
// Für dieses Beispiel erlauben wir jedem authentifizierten Benutzer Zugriff
const isAdmin = (req, res, next) => {
  next();
};

// Endpunkt, um dem aktuell angemeldeten Benutzer Zugriff auf alle Apartments zu geben
router.post('/assign-all-apartments', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Alle Apartments abrufen
    const [apartments] = await pool.query('SELECT id FROM apartments');
    
    if (apartments.length === 0) {
      return res.status(404).json({ message: 'Keine Apartments gefunden' });
    }
    
    // Für jedes Apartment einen Eintrag in user_apartments erstellen
    for (const apartment of apartments) {
      // Prüfen, ob der Eintrag bereits existiert
      const [existingEntries] = await pool.query(
        'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
        [userId, apartment.id]
      );
      
      if (existingEntries.length === 0) {
        // Eintrag erstellen, wenn er noch nicht existiert
        await pool.query(
          'INSERT INTO user_apartments (user_id, apartment_id, is_owner) VALUES (?, ?, ?)',
          [userId, apartment.id, true] // Hier setzen wir den Benutzer als Owner
        );
      }
    }
    
    res.json({ 
      success: true, 
      message: `Benutzer (ID: ${userId}) hat jetzt Zugriff auf ${apartments.length} Apartments.`,
      apartments: apartments.map(apt => apt.id)
    });
  } catch (error) {
    console.error('Fehler beim Zuweisen von Apartments:', error);
    res.status(500).json({ message: 'Serverfehler beim Zuweisen von Apartments' });
  }
});

// Endpunkt zum Erstellen von Test-Apartments
router.post('/create-test-apartments', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = req.body.count || 3; // Standardmäßig 3 Test-Apartments erstellen
    
    const createdApartments = [];
    
    // Test-Apartments erstellen
    for (let i = 1; i <= count; i++) {
      const [result] = await pool.query(
        'INSERT INTO apartments (name, address, size, rent, user_id) VALUES (?, ?, ?, ?, ?)',
        [`Test-Apartment ${i}`, `Teststraße ${i}`, 75.0 + i * 10, 800.0 + i * 100, userId]
      );
      
      const apartmentId = result.insertId;
      createdApartments.push(apartmentId);
      
      // Benutzer als Owner des Apartments hinzufügen
      await pool.query(
        'INSERT INTO user_apartments (user_id, apartment_id, is_owner) VALUES (?, ?, ?)',
        [userId, apartmentId, true]
      );
    }
    
    res.json({ 
      success: true, 
      message: `${count} Test-Apartments erstellt`,
      apartments: createdApartments
    });
  } catch (error) {
    console.error('Fehler beim Erstellen von Test-Apartments:', error);
    res.status(500).json({ message: 'Serverfehler beim Erstellen von Test-Apartments' });
  }
});

// Status der Datenbankverbindung prüfen
router.get('/db-status', verifyToken, isAdmin, async (req, res) => {
  try {
    // Prüfen, ob die Verbindung funktioniert
    const [result] = await pool.query('SELECT 1 as connected');
    
    // Tabellen zählen
    const [tables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${process.env.DB_NAME || 'household_db'}'
    `);
    
    // Benutzer zählen
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    
    // Apartments zählen
    const [apartmentCount] = await pool.query('SELECT COUNT(*) as count FROM apartments');
    
    // Benutzer-Apartment-Verknüpfungen zählen
    const [userApartmentCount] = await pool.query('SELECT COUNT(*) as count FROM user_apartments');
    
    res.json({
      connected: result[0].connected === 1,
      tables: tables.map(t => t.table_name),
      counts: {
        users: userCount[0].count,
        apartments: apartmentCount[0].count,
        userApartments: userApartmentCount[0].count
      }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Datenbankstatus:', error);
    res.status(500).json({ 
      connected: false,
      error: error.message 
    });
  }
});

module.exports = router;
