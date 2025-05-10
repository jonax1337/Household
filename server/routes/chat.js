const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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

// Einfache Verschlüsselungsfunktion für Nachrichten
// Wir verwenden einen konstanten Schlüssel für die Verschlüsselung
// Dies ist NICHT für sensible Daten geeignet, aber ausreichend für unseren Chat
const ENCRYPTION_KEY = 'household-chat-secret-key-123456789';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Nachrichten senden
router.post('/:apartmentId', verifyToken, async (req, res) => {
  const { apartmentId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  try {
    // Prüfen, ob der Benutzer zur Wohnung gehört
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Sie haben keinen Zugriff auf diese Wohnung.' });
    }

    // Nachricht verschlüsseln
    const encryptedContent = encrypt(content);

    // Nachricht in DB speichern
    const [result] = await pool.query(
      'INSERT INTO messages (apartment_id, user_id, content) VALUES (?, ?, ?)',
      [apartmentId, userId, encryptedContent]
    );

    // Benutzerinformationen für die Antwort abrufen
    const [userData] = await pool.query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );

    const messageData = {
      id: result.insertId,
      apartment_id: parseInt(apartmentId),
      user_id: userId,
      user: userData[0],
      content: content, // Unverschlüsselte Version zurückgeben
      created_at: new Date().toISOString()
    };

    return res.status(201).json(messageData);
  } catch (error) {
    console.error('Fehler beim Senden der Nachricht:', error);
    return res.status(500).json({ message: 'Server-Fehler beim Senden der Nachricht.' });
  }
});

// Nachrichten abrufen
router.get('/:apartmentId', verifyToken, async (req, res) => {
  try {
    const apartmentId = req.params.apartmentId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const offset = (page - 1) * pageSize;
    
    // Überprüfen, ob der Benutzer Zugriff auf diese Wohnung hat
    const [userApartment] = await pool.query(
      `SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Nachrichten mit Paginierung abrufen
    const [messages] = await pool.query(
      `SELECT m.id, m.apartment_id, m.user_id, m.content, m.created_at, m.encrypted,
              u.name as user_name, u.email as user_email
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.apartment_id = ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [apartmentId, pageSize, offset]
    );
    
    // Nachrichten formatieren und Benutzerdaten hinzufügen
    const formattedMessages = messages.map(message => ({
      id: message.id,
      apartment_id: message.apartment_id,
      user_id: message.user_id,
      content: message.content,
      created_at: message.created_at,
      encrypted: message.encrypted === 1,
      user: {
        id: message.user_id,
        name: message.user_name,
        email: message.user_email
      }
    }));
    
    // In aufsteigender Reihenfolge zurückgeben (neueste zuerst abgefragt, aber älteste zuerst angezeigt)
    res.json(formattedMessages.reverse());
  } catch (error) {
    console.error('Fehler beim Abrufen der Nachrichten:', error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Nachrichten' });
  }
});

module.exports = router;
