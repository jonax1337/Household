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
    res.status(401).json({ message: 'Token ist ungültig' });
  }
};

// Initialisierungsfunktion für die Activities-Tabelle
async function initActivitiesTable() {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apartment_id INT NOT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(100),
        type VARCHAR(50) NOT NULL,
        content TEXT,
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_apartment_id (apartment_id),
        INDEX idx_created_at (created_at)
      )
    `;
    
    await pool.query(createTableSQL);
    console.log('Activities-Tabelle überprüft/erstellt');
  } catch (error) {
    console.error('Fehler beim Initialisieren der Activities-Tabelle:', error);
  }
}

// Tabelle initialisieren, wenn der Server startet
initActivitiesTable();

// Aktivität hinzufügen
router.post('/', verifyToken, async (req, res) => {
  try {
    const { apartmentId, type, content, data } = req.body;
    const userId = req.user.id;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Benutzernamen abrufen
    const [userResult] = await pool.query(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    
    const userName = userResult.length > 0 ? userResult[0].name : null;
    
    // Aktivität einfügen
    const [result] = await pool.query(
      'INSERT INTO activities (apartment_id, user_id, user_name, type, content, data) VALUES (?, ?, ?, ?, ?, ?)',
      [apartmentId, userId, userName, type, content, JSON.stringify(data || {})]
    );
    
    res.status(201).json({
      id: result.insertId,
      apartmentId,
      userId,
      userName,
      type,
      content,
      data,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Fehler beim Hinzufügen einer Aktivität:', error);
    res.status(500).json({ message: 'Server-Fehler' });
  }
});

// Aktivitäten für eine Wohnung abrufen
router.get('/apartment/:apartmentId', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Aktivitäten abrufen
    const [activities] = await pool.query(
      `SELECT * FROM activities 
       WHERE apartment_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [apartmentId, parseInt(limit), parseInt(offset)]
    );
    
    // Daten für die Anzeige aufbereiten
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      apartmentId: activity.apartment_id,
      userId: activity.user_id,
      userName: activity.user_name,
      content: activity.content,
      data: activity.data ? JSON.parse(activity.data) : {},
      createdAt: activity.created_at
    }));
    
    res.json(formattedActivities);
  } catch (error) {
    console.error('Fehler beim Abrufen der Aktivitäten:', error);
    res.status(500).json({ message: 'Server-Fehler' });
  }
});

module.exports = router;
