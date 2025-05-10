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
    res.status(401).json({ message: 'Token ist ungu00fcltig' });
  }
};

// Alle Wohnungen eines Benutzers abrufen (eigene und beigetretene)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log(`Abfrage der Wohnungen für Benutzer ID ${req.user.id}`);
    
    // Alle Wohnungen abrufen, bei denen der Benutzer Eigentümer oder Mitglied ist
    const [allApartments] = await pool.query(
      `SELECT DISTINCT a.* FROM apartments a 
       LEFT JOIN user_apartments ua ON a.id = ua.apartment_id 
       WHERE a.user_id = ? OR ua.user_id = ? 
       ORDER BY a.created_at DESC`,
      [req.user.id, req.user.id]
    );
    
    console.log(`Gefundene Wohnungen: ${allApartments.length}`);
    
    // Für jede Wohnung die Mitbewohner abrufen (jetzt aus user_apartments und users)
    const apartmentsWithRoommates = await Promise.all(allApartments.map(async (apartment) => {
      // User-IDs der Mitbewohner abrufen
      const [userApartments] = await pool.query(
        'SELECT user_id, is_owner FROM user_apartments WHERE apartment_id = ?',
        [apartment.id]
      );
      
      // Details der Benutzer/Mitbewohner abrufen
      const roommates = await Promise.all(userApartments.map(async (ua) => {
        const [users] = await pool.query(
          'SELECT id, name FROM users WHERE id = ?',
          [ua.user_id]
        );
        return users.length > 0 ? { ...users[0], isOwner: ua.is_owner === 1 } : null;
      })).then(results => results.filter(Boolean)); // Null-Werte filtern
      
      // Eigentümer Status prüfen
      const isOwner = userApartments.some(ua => ua.user_id === req.user.id && ua.is_owner === 1);
      
      return {
        ...apartment,
        roommates,
        isOwner
      };
    }));
    
    res.json(apartmentsWithRoommates);
  } catch (error) {
    console.error('Fehler beim Abrufen der Wohnungen:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Eine Wohnung nach ID abrufen
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // Wohnung abrufen und pru00fcfen, ob sie dem Benutzer gehu00f6rt
    const [apartments] = await pool.query(
      'SELECT * FROM apartments WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(404).json({ message: 'Wohnung nicht gefunden' });
    }
    
    const apartment = apartments[0];
    
    // Mitbewohner abrufen
    const [roommates] = await pool.query(
      'SELECT id, name FROM roommates WHERE apartment_id = ?',
      [apartment.id]
    );
    
    res.json({
      ...apartment,
      roommates
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Wohnung:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Neue Wohnung erstellen
router.post('/', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { name, address, size, rent, move_in_date, roommates } = req.body;
    
    // Wohnung erstellen
    const [result] = await connection.query(
      'INSERT INTO apartments (name, address, size, rent, move_in_date, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address, size, rent, move_in_date, req.user.id]
    );
    
    const apartmentId = result.insertId;
    
    // Wichtig: Den Benutzer mit der Wohnung verknu00fcpfen (als Eigentümer)
    await connection.query(
      'INSERT INTO user_apartments (user_id, apartment_id, is_owner) VALUES (?, ?, 1)',
      [req.user.id, apartmentId]
    );
    console.log(`Benutzer ${req.user.id} mit Wohnung ${apartmentId} verknüpft`);
    
    // Initialen Einladungscode generieren
    const inviteCode = await generateInviteCode(connection, apartmentId, req.user.id);
    console.log(`Einladungscode für Wohnung ${apartmentId} generiert: ${inviteCode}`);
    
    // Hinweis: Die roommates-Tabelle existiert nicht mehr.
    // Der Code zum Hinzufügen von Mitbewohnern wurde entfernt,
    // da Benutzer jetzt über den Einladungscode beitreten.
    
    await connection.commit();
    
    res.status(201).json({
      message: 'Wohnung erfolgreich erstellt',
      id: apartmentId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Erstellen der Wohnung:', error);
    res.status(500).json({ message: 'Serverfehler beim Erstellen der Wohnung' });
  } finally {
    connection.release();
  }
});

// Wohnung aktualisieren
router.put('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Pru00fcfen, ob Wohnung existiert und dem Benutzer gehu00f6rt
    const [apartments] = await connection.query(
      'SELECT * FROM apartments WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (apartments.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Wohnung nicht gefunden oder keine Berechtigung' });
    }
    
    const { name, address, size, rent, move_in_date, roommates } = req.body;
    
    // Wohnung aktualisieren
    await connection.query(
      'UPDATE apartments SET name = ?, address = ?, size = ?, rent = ?, move_in_date = ? WHERE id = ?',
      [name, address, size, rent, move_in_date, req.params.id]
    );
    
    // Vorhandene Mitbewohner lu00f6schen
    await connection.query('DELETE FROM roommates WHERE apartment_id = ?', [req.params.id]);
    
    // Neue Mitbewohner hinzufu00fcgen
    if (roommates && roommates.length > 0) {
      for (const roommate of roommates) {
        await connection.query(
          'INSERT INTO roommates (name, apartment_id) VALUES (?, ?)',
          [roommate, req.params.id]
        );
      }
    }
    
    await connection.commit();
    
    res.json({ message: 'Wohnung erfolgreich aktualisiert' });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Aktualisieren der Wohnung:', error);
    res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Wohnung' });
  } finally {
    connection.release();
  }
});

// Wohnung lu00f6schen
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Pru00fcfen, ob Wohnung existiert und dem Benutzer gehu00f6rt
    const [apartments] = await pool.query(
      'SELECT * FROM apartments WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(404).json({ message: 'Wohnung nicht gefunden oder keine Berechtigung' });
    }
    
    // Lu00f6schen der Wohnung (Mitbewohner werden durch ON DELETE CASCADE automatisch gelu00f6scht)
    await pool.query('DELETE FROM apartments WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Wohnung erfolgreich gelu00f6scht' });
  } catch (error) {
    console.error('Fehler beim Lu00f6schen der Wohnung:', error);
    res.status(500).json({ message: 'Serverfehler beim Lu00f6schen der Wohnung' });
  }
});

// Shopping-Listen-Endpunkte

// Alle Einkaufslisten einer Wohnung abrufen
router.get('/:apartmentId/shopping/lists', verifyToken, async (req, res) => {
  console.log(`[SHOPPING-API] GET Anfrage empfangen für Einkaufslisten der Wohnung ${req.params.apartmentId}`);
  try {
    const { apartmentId } = req.params;
    
    console.log(`[SHOPPING-API] Verarbeite GET Anfrage für Einkaufslisten der Wohnung ${apartmentId} von Benutzer ${req.user.id}`);
    
    // Überprüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userAccess] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_apartments 
       WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    // Auch prüfen, ob der Benutzer der Eigentümer ist
    const [ownerCheck] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM apartments 
       WHERE id = ? AND user_id = ?`,
      [apartmentId, req.user.id]
    );
    
    const hasAccess = userAccess[0].count > 0 || ownerCheck[0].count > 0;
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Alle Einkaufslisten der Wohnung abrufen
    console.log(`[SHOPPING-API] Suche Einkaufslisten für Wohnung ${apartmentId}`);
    
    // Die bereits existierende shopping_lists Tabelle hat user_id anstelle von apartment_id
    // Wir müssen alle Benutzer der Wohnung finden und dann alle Listen dieser Benutzer abrufen
    console.log('[SHOPPING-API] Verwende bestehende Tabellenstruktur (user_id statt apartment_id)');
    
    // Zuerst alle Benutzer-IDs der Wohnung ermitteln (Eigentümer + Mitbewohner)
    const [apartmentUsers] = await pool.query(
      `SELECT DISTINCT user_id FROM user_apartments WHERE apartment_id = ? 
       UNION 
       SELECT user_id FROM apartments WHERE id = ?`,
      [apartmentId, apartmentId]
    );
    
    if (apartmentUsers.length === 0) {
      console.log(`[SHOPPING-API] Keine Benutzer für Wohnung ${apartmentId} gefunden`);
      return res.json([]);
    }
    
    const userIds = apartmentUsers.map(user => user.user_id);
    console.log(`[SHOPPING-API] Gefundene Benutzer für Wohnung ${apartmentId}:`, userIds);
    
    // Alle Listen dieser Benutzer abrufen
    const [lists] = await pool.query(
      `SELECT * FROM shopping_lists WHERE user_id IN (?)`,
      [userIds]
    );
    
    console.log(`[SHOPPING-API] ${lists.length} Einkaufslisten gefunden`);
    console.log('[SHOPPING-API] Listen:', lists);
    
    res.json(lists);
  } catch (error) {
    console.error('[SHOPPING-API] Fehler beim Abrufen der Einkaufslisten:', error);
    console.error('[SHOPPING-API] Fehlerdetails:', error.message);
    if (error.stack) {
      console.error('[SHOPPING-API] Stack-Trace:', error.stack);
    }
    res.status(500).json({ message: 'Serverfehler', error: error.message });
  }
});

// Neue Einkaufsliste erstellen
router.post('/:apartmentId/shopping/lists', verifyToken, async (req, res) => {
  console.log(`[SHOPPING-API] POST Anfrage empfangen für neue Einkaufsliste in Wohnung ${req.params.apartmentId}`);
  try {
    const { apartmentId } = req.params;
    const { name } = req.body;
    
    console.log(`[SHOPPING-API] Verarbeite POST Anfrage zum Erstellen einer neuen Einkaufsliste in Wohnung ${apartmentId}`);
    console.log('[SHOPPING-API] Listendaten:', { name });
    
    // Überprüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userAccess] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_apartments 
       WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    // Auch prüfen, ob der Benutzer der Eigentümer ist
    const [ownerCheck] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM apartments 
       WHERE id = ? AND user_id = ?`,
      [apartmentId, req.user.id]
    );
    
    const hasAccess = userAccess[0].count > 0 || ownerCheck[0].count > 0;
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Prüfen, ob die shopping_lists Tabelle existiert
    const [tables] = await pool.query(
      `SHOW TABLES LIKE 'shopping_lists'`
    );
    
    if (tables.length === 0) {
      console.log('[SHOPPING-API] Tabelle shopping_lists existiert nicht, erstelle sie');
      await pool.query(
        `CREATE TABLE IF NOT EXISTS shopping_lists (
          id INT AUTO_INCREMENT PRIMARY KEY,
          apartment_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
        )`
      );
      console.log('[SHOPPING-API] Tabelle shopping_lists erstellt');
    }
    
    // Neue Einkaufsliste erstellen (mit user_id anstelle von apartment_id)
    const [result] = await pool.query(
      'INSERT INTO shopping_lists (name, user_id) VALUES (?, ?)',
      [name, req.user.id]
    );
    
    console.log(`[SHOPPING-API] Liste erstellt mit ID ${result.insertId}`);
    
    
    const newList = {
      id: result.insertId,
      name,
      user_id: req.user.id,
      date: new Date().toISOString().slice(0, 10) // Heutiges Datum im Format YYYY-MM-DD
    };
    
    res.status(201).json(newList);
  } catch (error) {
    console.error('[SHOPPING-API] Fehler beim Erstellen der Einkaufsliste:', error);
    console.error('[SHOPPING-API] Fehlerdetails:', error.message);
    if (error.stack) {
      console.error('[SHOPPING-API] Stack-Trace:', error.stack);
    }
    res.status(500).json({ message: 'Serverfehler', error: error.message });
  }
});

// Items einer Einkaufsliste abrufen
router.get('/:apartmentId/shopping/lists/:listId/items', verifyToken, async (req, res) => {
  console.log(`[SHOPPING-API] GET Anfrage empfangen für Items der Liste ${req.params.listId} in Wohnung ${req.params.apartmentId}`);
  try {
    const { apartmentId, listId } = req.params;
    
    console.log(`[SHOPPING-API] Verarbeite GET Anfrage für Items der Liste ${listId} in Wohnung ${apartmentId}`);
    
    
    // Überprüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userAccess] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_apartments 
       WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    // Auch prüfen, ob der Benutzer der Eigentümer ist
    const [ownerCheck] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM apartments 
       WHERE id = ? AND user_id = ?`,
      [apartmentId, req.user.id]
    );
    
    const hasAccess = userAccess[0].count > 0 || ownerCheck[0].count > 0;
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Prüfen, ob die Liste zur angegebenen Wohnung gehört
    const [listCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (listCheck[0].count === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Prüfen, ob die shopping_items Tabelle die erwartete Struktur hat
    console.log('[SHOPPING-API] Verwende bestehende shopping_items Tabelle');
    
    // Alle Items der Einkaufsliste abrufen
    console.log(`[SHOPPING-API] Suche Items für Liste ${listId}`);
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY completed ASC, created_at DESC',
      [listId]
    );
    
    console.log(`[SHOPPING-API] ${items.length} Items gefunden`);
    
    
    res.json(items);
  } catch (error) {
    console.error('[SHOPPING-API] Fehler beim Abrufen der Einkaufsitems:', error);
    console.error('[SHOPPING-API] Fehlerdetails:', error.message);
    if (error.stack) {
      console.error('[SHOPPING-API] Stack-Trace:', error.stack);
    }
    res.status(500).json({ message: 'Serverfehler', error: error.message });
  }
});

// Neues Einkaufsitem hinzufügen
router.post('/:apartmentId/shopping/lists/:listId/items', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId } = req.params;
    const { name, quantity } = req.body;
    
    // Überprüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userAccess] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_apartments 
       WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    // Auch prüfen, ob der Benutzer der Eigentümer ist
    const [ownerCheck] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM apartments 
       WHERE id = ? AND user_id = ?`,
      [apartmentId, req.user.id]
    );
    
    const hasAccess = userAccess[0].count > 0 || ownerCheck[0].count > 0;
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Prüfen, ob die Liste zur angegebenen Wohnung gehört
    const [listCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (listCheck[0].count === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Neues Einkaufsitem erstellen
    const [result] = await pool.query(
      'INSERT INTO shopping_items (list_id, name, quantity, completed, created_by) VALUES (?, ?, ?, ?, ?)',
      [listId, name, quantity, false, req.user.id]
    );
    
    const newItem = {
      id: result.insertId,
      list_id: listId,
      name,
      quantity,
      completed: 0,
      created_by: req.user.id
    };
    
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Einkaufsitems:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Einkaufsitem aktualisieren
router.put('/:apartmentId/shopping/lists/:listId/items/:itemId', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId, itemId } = req.params;
    const updates = req.body;
    
    // Überprüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userAccess] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_apartments 
       WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    // Auch prüfen, ob der Benutzer der Eigentümer ist
    const [ownerCheck] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM apartments 
       WHERE id = ? AND user_id = ?`,
      [apartmentId, req.user.id]
    );
    
    const hasAccess = userAccess[0].count > 0 || ownerCheck[0].count > 0;
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Prüfen, ob die Liste zur angegebenen Wohnung gehört
    const [listCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (listCheck[0].count === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Prüfen, ob das Item existiert
    const [itemCheck] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ? AND list_id = ?',
      [itemId, listId]
    );
    
    if (itemCheck.length === 0) {
      return res.status(404).json({ message: 'Einkaufsitem nicht gefunden' });
    }
    
    // Update-Befehl dynamisch erstellen
    let updateQuery = 'UPDATE shopping_items SET ';
    const updateValues = [];
    
    // Nur erlaubte Felder aktualisieren
    const allowedFields = ['name', 'quantity', 'completed'];
    const fieldsToUpdate = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fieldsToUpdate.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }
    
    // Wenn keine Felder zum Aktualisieren vorhanden sind
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: 'Keine gültigen Felder zum Aktualisieren' });
    }
    
    updateQuery += fieldsToUpdate.join(', ');
    updateQuery += ' WHERE id = ? AND list_id = ?';
    updateValues.push(itemId, listId);
    
    await pool.query(updateQuery, updateValues);
    
    // Aktualisiertes Item zurückgeben
    const [updatedItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [itemId]
    );
    
    res.json(updatedItem[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Einkaufsitems:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Einkaufsitem löschen
router.delete('/:apartmentId/shopping/lists/:listId/items/:itemId', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId, itemId } = req.params;
    
    // Überprüfen, ob der Benutzer Zugriff auf die Wohnung hat
    const [userAccess] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_apartments 
       WHERE user_id = ? AND apartment_id = ?`,
      [req.user.id, apartmentId]
    );
    
    // Auch prüfen, ob der Benutzer der Eigentümer ist
    const [ownerCheck] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM apartments 
       WHERE id = ? AND user_id = ?`,
      [apartmentId, req.user.id]
    );
    
    const hasAccess = userAccess[0].count > 0 || ownerCheck[0].count > 0;
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Kein Zugriff auf diese Wohnung' });
    }
    
    // Prüfen, ob die Liste zur angegebenen Wohnung gehört
    const [listCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (listCheck[0].count === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Prüfen, ob das Item existiert
    const [itemCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM shopping_items WHERE id = ? AND list_id = ?',
      [itemId, listId]
    );
    
    if (itemCheck[0].count === 0) {
      return res.status(404).json({ message: 'Einkaufsitem nicht gefunden' });
    }
    
    // Item löschen
    await pool.query(
      'DELETE FROM shopping_items WHERE id = ?',
      [itemId]
    );
    
    res.json({ message: 'Einkaufsitem erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Einkaufsitems:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Hilfsfunktion zum Generieren eines Einladungscodes
async function generateInviteCode(connection, apartmentId, userId) {
  console.log('generateInviteCode wird aufgerufen mit:', { apartmentId, userId });
  
  try {
    // Zufälligen Code generieren (6 Zeichen, Zahlen und Großbuchstaben)
    let code;
    let isUnique = false;
    
    console.log('Generiere zufälligen Code...');
    
    // Manuell einen zufälligen Code generieren, wenn crypto ein Problem hat
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    console.log('Generierter Code:', code);
    
    // Prüfen, ob der Code bereits existiert
    console.log('Prüfe, ob Code bereits existiert...');
    const [existingCode] = await connection.query(
      'SELECT * FROM invite_codes WHERE code = ?',
      [code]
    );
    
    console.log('Existierende Codes mit diesem Wert:', existingCode.length);
    
    // Code in Datenbank speichern
    console.log('Speichere Code in Datenbank:', { apartmentId, code, userId });
    
    const [result] = await connection.query(
      'INSERT INTO invite_codes (apartment_id, code, created_by, is_active) VALUES (?, ?, ?, ?)',
      [apartmentId, code, userId, 1]
    );
    
    console.log('Code erfolgreich in Datenbank gespeichert, Ergebnis:', result);
    
    return code;
  } catch (error) {
    console.error('FEHLER beim Generieren des Einladungscodes:', error);
    throw error;
  }
}

module.exports = router;
