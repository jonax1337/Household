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

// Alle Finanztransaktionen einer Wohnung abrufen
router.get('/:apartmentId/transactions', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Pru00fcfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Transaktionen abrufen
    const [transactions] = await pool.query(
      `SELECT ft.*, u.name as payer_name 
       FROM financial_transactions ft 
       JOIN users u ON ft.payer_id = u.id 
       WHERE ft.apartment_id = ? 
       ORDER BY ft.date DESC`,
      [apartmentId]
    );
    
    // Fu00fcr jede Transaktion die Teilnehmer abrufen
    const transactionsWithParticipants = await Promise.all(transactions.map(async (transaction) => {
      const [participants] = await pool.query(
        `SELECT u.id, u.name 
         FROM transaction_participants tp 
         JOIN users u ON tp.user_id = u.id 
         WHERE tp.transaction_id = ?`,
        [transaction.id]
      );
      
      return {
        ...transaction,
        participants: participants
      };
    }));
    
    res.json(transactionsWithParticipants);
  } catch (error) {
    console.error('Fehler beim Abrufen der Finanztransaktionen:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Neue Finanztransaktion hinzufu00fcgen
router.post('/:apartmentId/transactions', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    const { description, amount, date, payerId, participantIds } = req.body;
    
    // Validierung
    if (!description || !amount || !date || !payerId || !participantIds) {
      return res.status(400).json({ message: 'Alle Felder mu00fcssen ausgefu00fcllt sein' });
    }
    
    // Pru00fcfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Transaktion in Datenbank speichern
    const [result] = await pool.query(
      'INSERT INTO financial_transactions (apartment_id, description, amount, date, payer_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [apartmentId, description, amount, date, payerId, req.user.id]
    );
    
    const transactionId = result.insertId;
    
    // Teilnehmer hinzufu00fcgen
    for (const userId of participantIds) {
      await pool.query(
        'INSERT INTO transaction_participants (transaction_id, user_id) VALUES (?, ?)',
        [transactionId, userId]
      );
    }
    
    // Neue Transaktion mit Teilnehmern zuru00fcckgeben
    const [transaction] = await pool.query(
      `SELECT ft.*, u.name as payer_name 
       FROM financial_transactions ft 
       JOIN users u ON ft.payer_id = u.id 
       WHERE ft.id = ?`,
      [transactionId]
    );
    
    const [participants] = await pool.query(
      `SELECT u.id, u.name 
       FROM transaction_participants tp 
       JOIN users u ON tp.user_id = u.id 
       WHERE tp.transaction_id = ?`,
      [transactionId]
    );
    
    res.status(201).json({
      ...transaction[0],
      participants
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Finanztransaktion:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Finanztransaktion lu00f6schen
router.delete('/:apartmentId/transactions/:transactionId', verifyToken, async (req, res) => {
  try {
    const { apartmentId, transactionId } = req.params;
    
    // Pru00fcfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Pru00fcfen, ob der Benutzer der Ersteller der Transaktion ist
    const [transaction] = await pool.query(
      'SELECT * FROM financial_transactions WHERE id = ? AND apartment_id = ?',
      [transactionId, apartmentId]
    );
    
    if (transaction.length === 0) {
      return res.status(404).json({ message: 'Transaktion nicht gefunden' });
    }
    
    if (transaction[0].created_by !== req.user.id) {
      return res.status(403).json({ message: 'Nur der Ersteller kann die Transaktion lu00f6schen' });
    }
    
    // Teilnehmer lu00f6schen (wird automatisch durch Foreign Key gelu00f6scht)
    
    // Transaktion lu00f6schen
    await pool.query(
      'DELETE FROM financial_transactions WHERE id = ?',
      [transactionId]
    );
    
    res.json({ message: 'Transaktion erfolgreich gelu00f6scht' });
  } catch (error) {
    console.error('Fehler beim Lu00f6schen der Finanztransaktion:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Mitbewohner einer Wohnung abrufen (Hilfsfunktion fu00fcr die Auswahl von Teilnehmern)
router.get('/:apartmentId/roommates', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Pru00fcfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Alle Mitbewohner der Wohnung abrufen
    const [roommates] = await pool.query(
      `SELECT u.id, u.name, u.email 
       FROM users u 
       JOIN user_apartments ua ON u.id = ua.user_id 
       WHERE ua.apartment_id = ? 
       ORDER BY u.name ASC`,
      [apartmentId]
    );
    
    res.json(roommates);
  } catch (error) {
    console.error('Fehler beim Abrufen der Mitbewohner:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

module.exports = router;
