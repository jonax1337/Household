const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
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

// Alle Mitbewohner einer Wohnung abrufen - alte Route
router.get('/:apartmentId/roommates', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Alle Mitbewohner der Wohnung abrufen
    const [roommates] = await pool.query(
      `SELECT u.id, u.name, u.email, ua.is_owner, ua.joined_at 
       FROM users u 
       JOIN user_apartments ua ON u.id = ua.user_id 
       WHERE ua.apartment_id = ? 
       ORDER BY ua.is_owner DESC, ua.joined_at ASC`,
      [apartmentId]
    );
    
    res.json(roommates);
  } catch (error) {
    console.error('Fehler beim Abrufen der Mitbewohner:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Punkte aller Benutzer in einer Wohnung abrufen (für die Rangliste im Dashboard)
router.get('/user_apartments/:apartmentId/points', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Alle Benutzer der Wohnung mit ihren Punkten abrufen
    const [users] = await pool.query(
      `SELECT ua.user_id, u.name as user_name, ua.points 
       FROM user_apartments ua
       JOIN users u ON ua.user_id = u.id
       WHERE ua.apartment_id = ?
       ORDER BY ua.points DESC`,
      [apartmentId]
    );
    
    res.json(users);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerpunkte:', error);
    res.status(500).json({ message: 'Server-Fehler' });
  }
});

// Aktuellen Einladungscode abrufen
router.get('/:apartmentId/invite-code', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Aktiven Einladungscode abrufen
    const [inviteCode] = await pool.query(
      'SELECT code FROM invite_codes WHERE apartment_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
      [apartmentId]
    );
    
    if (inviteCode.length === 0) {
      // Wenn kein Code existiert, neuen Code generieren
      const newCode = await generateInviteCode(apartmentId, req.user.id);
      return res.json({ inviteCode: newCode });
    }
    
    res.json({ inviteCode: inviteCode[0].code });
  } catch (error) {
    console.error('Fehler beim Abrufen des Einladungscodes:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Neuen Einladungscode generieren
router.post('/:apartmentId/invite-code', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ? AND is_owner = 1',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Nur der Besitzer kann Einladungscodes generieren' });
    }
    
    // Bestehende Codes deaktivieren
    await pool.query(
      'UPDATE invite_codes SET is_active = 0 WHERE apartment_id = ? AND is_active = 1',
      [apartmentId]
    );
    
    // Neuen Code generieren und speichern
    const newCode = await generateInviteCode(apartmentId, req.user.id);
    
    res.json({ inviteCode: newCode });
  } catch (error) {
    console.error('Fehler beim Generieren des Einladungscodes:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Mitbewohner entfernen
router.delete('/:apartmentId/roommates/:userId', verifyToken, async (req, res) => {
  try {
    const { apartmentId, userId } = req.params;
    
    // Prüfen, ob der Benutzer der Besitzer der Wohnung ist
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ? AND is_owner = 1',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Nur der Besitzer kann Mitbewohner entfernen' });
    }
    
    // Prüfen, dass man nicht sich selbst entfernt
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ message: 'Du kannst dich nicht selbst entfernen' });
    }
    
    // Mitbewohner entfernen
    await pool.query(
      'DELETE FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    res.json({ message: 'Mitbewohner erfolgreich entfernt' });
  } catch (error) {
    console.error('Fehler beim Entfernen des Mitbewohners:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Wohnung verlassen
router.delete('/leave/:apartmentId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { apartmentId } = req.params;
    const userId = req.user.id;
    
    console.log(`Benutzer ${userId} versucht, Wohnung ${apartmentId} zu verlassen`);
    
    // Prüfen, ob der Benutzer Mitglied dieser Wohnung ist
    const [userApartment] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    if (userApartment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Du bist kein Mitglied dieser Wohnung' });
    }
    
    const isOwner = userApartment[0].is_owner === 1;
    
    if (isOwner) {
      // Zähle die Anzahl der Mitbewohner in dieser Wohnung
      const [memberCount] = await connection.query(
        'SELECT COUNT(*) as count FROM user_apartments WHERE apartment_id = ?',
        [apartmentId]
      );
      
      const count = memberCount[0].count;
      
      // Als Owner kann man die Wohnung nicht direkt verlassen
      await connection.rollback();
      return res.status(403).json({ 
        message: 'Als Besitzer kannst du die Wohnung nicht verlassen. Bitte übertrage zuerst das Eigentum an einen anderen Mitbewohner oder löse die Wohnung, falls du der Letzte bist.',
        requireOwnershipTransfer: true,
        isLastMember: count === 1
      });
    }
    
    // Benutzer aus der Wohnung entfernen
    await connection.query(
      'DELETE FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    console.log(`Benutzer ${userId} hat die Wohnung ${apartmentId} verlassen`);
    
    await connection.commit();
    
    res.json({ 
      message: 'Wohnung erfolgreich verlassen',
      wasOwner: isOwner
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Verlassen der Wohnung:', error);
    res.status(500).json({ message: 'Serverfehler beim Verlassen der Wohnung' });
  } finally {
    connection.release();
  }
});

// Einladungscode neu generieren
router.post('/code/:apartmentId', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    console.log(`Benutzer ${req.user.id} versucht, einen neuen Einladungscode für Wohnung ${apartmentId} zu generieren`);
    
    // Prüfen, ob der Benutzer der Eigentümer der Wohnung ist
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ? AND is_owner = 1',
      [apartmentId, req.user.id]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Nur der Besitzer kann Einladungscodes regenerieren' });
    }
    
    // Bestehende Codes deaktivieren
    await pool.query(
      'UPDATE invite_codes SET is_active = 0 WHERE apartment_id = ? AND is_active = 1',
      [apartmentId]
    );
    
    // Neuen Code generieren und speichern
    const newCode = await generateInviteCode(apartmentId, req.user.id);
    
    console.log(`Neuer Einladungscode für Wohnung ${apartmentId} generiert: ${newCode}`);
    
    res.json({ code: newCode });
  } catch (error) {
    console.error('Fehler beim Regenerieren des Einladungscodes:', error);
    res.status(500).json({ message: 'Serverfehler beim Regenerieren des Einladungscodes' });
  }
});

// Eigentum übertragen
router.post('/:apartmentId/transfer-ownership/:newOwnerId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { apartmentId, newOwnerId } = req.params;
    const currentUserId = req.user.id;
    
    console.log(`Benutzer ${currentUserId} versucht, Eigentum der Wohnung ${apartmentId} an Benutzer ${newOwnerId} zu übertragen`);
    
    // Prüfen, ob der aktuelle Benutzer der Eigentümer ist
    const [currentOwner] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ? AND is_owner = 1',
      [apartmentId, currentUserId]
    );
    
    if (currentOwner.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: 'Nur der Besitzer kann das Eigentum übertragen' });
    }
    
    // Prüfen, ob der neue Eigentümer bereits Mitglied ist
    const [newOwner] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, newOwnerId]
    );
    
    if (newOwner.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Der ausgewählte Benutzer ist kein Mitglied dieser Wohnung' });
    }
    
    // Aktuellen Eigentümer zum normalen Mitglied machen
    await connection.query(
      'UPDATE user_apartments SET is_owner = 0 WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, currentUserId]
    );
    
    // Neuen Eigentümer setzen
    await connection.query(
      'UPDATE user_apartments SET is_owner = 1 WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, newOwnerId]
    );
    
    // Auch in der apartments-Tabelle den user_id (Besitzer) aktualisieren
    await connection.query(
      'UPDATE apartments SET user_id = ? WHERE id = ?',
      [newOwnerId, apartmentId]
    );
    
    await connection.commit();
    
    console.log(`Eigentum der Wohnung ${apartmentId} erfolgreich an Benutzer ${newOwnerId} übertragen`);
    
    res.json({ message: 'Eigentum erfolgreich übertragen' });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Übertragen des Eigentums:', error);
    res.status(500).json({ message: 'Serverfehler beim Übertragen des Eigentums' });
  } finally {
    connection.release();
  }
});

// Mitbewohner aus Wohnung entfernen (kicken)
router.delete('/:apartmentId/kick/:userId', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { apartmentId, userId } = req.params;
    const currentUserId = req.user.id;
    
    console.log(`Benutzer ${currentUserId} versucht, Benutzer ${userId} aus Wohnung ${apartmentId} zu entfernen`);
    
    // Prüfen, ob der aktuelle Benutzer der Eigentümer ist
    const [currentOwner] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ? AND is_owner = 1',
      [apartmentId, currentUserId]
    );
    
    if (currentOwner.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: 'Nur der Besitzer kann Mitbewohner entfernen' });
    }
    
    // Prüfen, ob der zu entfernende Benutzer Mitglied ist
    const [targetUser] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    if (targetUser.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Der Benutzer ist kein Mitglied dieser Wohnung' });
    }
    
    // Man kann sich nicht selbst kicken
    if (userId === currentUserId) {
      await connection.rollback();
      return res.status(400).json({ message: 'Du kannst dich nicht selbst aus der Wohnung entfernen' });
    }
    
    // Prüfen, ob der Ziel-Benutzer der Eigentümer ist
    if (targetUser[0].is_owner === 1) {
      await connection.rollback();
      return res.status(403).json({ message: 'Der Besitzer kann nicht entfernt werden. Übertrage zuerst das Eigentum.' });
    }
    
    // Benutzer aus der Wohnung entfernen
    await connection.query(
      'DELETE FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    await connection.commit();
    
    console.log(`Benutzer ${userId} wurde erfolgreich aus Wohnung ${apartmentId} entfernt`);
    
    res.json({ message: 'Mitbewohner erfolgreich entfernt' });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Entfernen des Mitbewohners:', error);
    res.status(500).json({ message: 'Serverfehler beim Entfernen des Mitbewohners' });
  } finally {
    connection.release();
  }
});

// Einladungscode einer Wohnung abrufen
router.get('/:apartmentId/invite-code', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    const userId = req.user.id;
    
    console.log(`Benutzer ${userId} ruft Einladungscode für Wohnung ${apartmentId} ab`);
    
    // Prüfen, ob der Benutzer Mitglied dieser Wohnung ist
    const [userApartment] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, userId]
    );
    
    if (userApartment.length === 0) {
      return res.status(403).json({ message: 'Du bist kein Mitglied dieser Wohnung' });
    }
    
    // Aktiven Einladungscode abrufen
    const [inviteCode] = await pool.query(
      'SELECT code FROM invite_codes WHERE apartment_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
      [apartmentId]
    );
    
    if (inviteCode.length === 0) {
      // Wenn kein aktiver Code existiert, erstellen wir einen neuen
      // (Nur wenn der Anfragende der Besitzer ist)
      if (userApartment[0].is_owner === 1) {
        const newCode = await generateInviteCode(apartmentId, userId);
        console.log(`Neuer Einladungscode für Wohnung ${apartmentId} generiert: ${newCode}`);
        return res.json({ code: newCode });
      } else {
        return res.status(404).json({ message: 'Kein aktiver Einladungscode gefunden' });
      }
    }
    
    console.log(`Einladungscode für Wohnung ${apartmentId} gefunden: ${inviteCode[0].code}`);
    res.json({ code: inviteCode[0].code });
  } catch (error) {
    console.error('Fehler beim Abrufen des Einladungscodes:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen des Einladungscodes' });
  }
});

// Mit Code einer Wohnung beitreten
router.post('/join', verifyToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    
    if (!inviteCode) {
      return res.status(400).json({ message: 'Einladungscode ist erforderlich' });
    }
    
    // Prüfen, ob der Einladungscode gültig ist
    const [code] = await pool.query(
      'SELECT * FROM invite_codes WHERE code = ? AND is_active = 1',
      [inviteCode]
    );
    
    if (code.length === 0) {
      return res.status(404).json({ message: 'Ungültiger Einladungscode' });
    }
    
    const apartmentId = code[0].apartment_id;
    
    // Prüfen, ob der Benutzer bereits Mitbewohner ist
    const [existingMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (existingMember.length > 0) {
      return res.status(400).json({ message: 'Du bist bereits Mitbewohner in dieser Wohnung' });
    }
    
    // Benutzer als Mitbewohner hinzufügen
    await pool.query(
      'INSERT INTO user_apartments (user_id, apartment_id, is_owner) VALUES (?, ?, ?)',
      [req.user.id, apartmentId, 0] // Nicht als Besitzer
    );
    
    // Wohnungsinformationen abrufen
    const [apartment] = await pool.query(
      'SELECT * FROM apartments WHERE id = ?',
      [apartmentId]
    );
    
    res.json({
      message: 'Erfolgreich der Wohnung beigetreten',
      apartment: apartment[0]
    });
  } catch (error) {
    console.error('Fehler beim Beitreten der Wohnung:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Hilfsfunktion zum Generieren eines Einladungscodes
async function generateInviteCode(apartmentId, userId) {
  // Zufälligen Code generieren (6 Zeichen, Zahlen und Großbuchstaben)
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Prüfen, ob der Code bereits existiert
    const [existingCode] = await pool.query(
      'SELECT * FROM invite_codes WHERE code = ?',
      [code]
    );
    
    if (existingCode.length === 0) {
      isUnique = true;
    }
  }
  
  // Code in Datenbank speichern
  await pool.query(
    'INSERT INTO invite_codes (apartment_id, code, created_by, is_active) VALUES (?, ?, ?, ?)',
    [apartmentId, code, userId, 1]
  );
  
  return code;
}

// Alle Mitbewohner einer Wohnung abrufen - neue Route fu00fcr Frontend-Kompatibilität
router.get('/:apartmentId/members', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userApartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [req.user.id, apartmentId]
    );
    
    if (userApartments.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Alle Benutzer abrufen, die mit der Wohnung verknüpft sind
    const [roommates] = await pool.query(
      `SELECT u.id, u.name, u.email, ua.is_owner 
       FROM users u
       JOIN user_apartments ua ON u.id = ua.user_id
       WHERE ua.apartment_id = ?`,
      [apartmentId]
    );
    
    res.json(roommates);
  } catch (error) {
    console.error('Fehler beim Abrufen der Mitbewohner:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen der Mitbewohner' });
  }
});

module.exports = router;
