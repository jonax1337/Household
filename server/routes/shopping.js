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

// Alle Einkaufslisten eines Apartments abrufen
router.get('/apartment/:apartmentId', verifyToken, async (req, res) => {
  try {
    const { apartmentId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE apartment_id = ? ORDER BY created_at DESC',
      [apartmentId]
    );
    
    // Für jede Liste die zugehörigen Artikel abrufen
    const listsWithItems = await Promise.all(lists.map(async (list) => {
      const [items] = await pool.query(
        'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY category, name',
        [list.id]
      );
      
      return {
        ...list,
        items
      };
    }));
    
    res.json(listsWithItems);
  } catch (error) {
    console.error('Fehler beim Abrufen der Einkaufslisten:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Liste aller Einkaufslisten eines Benutzers (Legacy - zur Abwärtskompatibilität)
router.get('/', verifyToken, async (req, res) => {
  try {
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    
    res.json(lists);
  } catch (error) {
    console.error('Fehler beim Abrufen der Einkaufslisten:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Eine Einkaufsliste nach ID und Apartment abrufen
router.get('/apartment/:apartmentId/list/:id', verifyToken, async (req, res) => {
  try {
    const { apartmentId, id } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [id, apartmentId]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    const list = lists[0];
    
    // Artikel abrufen
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY category, name',
      [list.id]
    );
    
    res.json({
      ...list,
      items
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Eine Einkaufsliste nach ID abrufen (Legacy - zur Abwärtskompatibilität)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    const list = lists[0];
    
    // Artikel abrufen
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY category, name',
      [list.id]
    );
    
    res.json({
      ...list,
      items
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Neue Einkaufsliste für ein Apartment erstellen
router.post('/apartment/:apartmentId/list', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { apartmentId } = req.params;
    const { name, date, items } = req.body;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    // Liste erstellen
    const [result] = await connection.query(
      'INSERT INTO shopping_lists (name, date, apartment_id) VALUES (?, ?, ?)',
      [name, date || new Date(), apartmentId]
    );
    
    const listId = result.insertId;
    
    // Artikel hinzufügen, falls vorhanden
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.query(
          'INSERT INTO shopping_items (name, quantity, category, checked, list_id) VALUES (?, ?, ?, ?, ?)',
          [item.name, item.quantity || '', item.category || 'sonstiges', item.checked || false, listId]
        );
      }
    }
    
    await connection.commit();
    
    // Die vollständige Liste mit allen Informationen zurückgeben
    const [listData] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ?',
      [listId]
    );
    
    const [itemsData] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY category, name',
      [listId]
    );
    
    const createdList = {
      ...listData[0],
      items: itemsData
    };
    
    res.status(201).json(createdList);
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Erstellen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler beim Erstellen der Einkaufsliste' });
  } finally {
    connection.release();
  }
});

// Neue Einkaufsliste erstellen (Legacy - zur Abwärtskompatibilität)
router.post('/', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { name, date, items } = req.body;
    
    // Benutzer-Apartments abrufen
    const [userApartments] = await connection.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    
    if (userApartments.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Kein Apartment für diesen Benutzer gefunden' });
    }
    
    // Liste erstellen mit apartment_id statt user_id
    const [result] = await connection.query(
      'INSERT INTO shopping_lists (name, date, apartment_id) VALUES (?, ?, ?)',
      [name, date || new Date(), userApartments[0].apartment_id]
    );
    
    const listId = result.insertId;
    
    // Artikel hinzufügen, falls vorhanden
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.query(
          'INSERT INTO shopping_items (name, category, checked, list_id) VALUES (?, ?, ?, ?)',
          [item.name, item.category, item.checked || false, listId]
        );
      }
    }
    
    await connection.commit();
    
    res.status(201).json({
      message: 'Einkaufsliste erfolgreich erstellt',
      id: listId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Erstellen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler beim Erstellen der Einkaufsliste' });
  } finally {
    connection.release();
  }
});

// Einkaufsliste aktualisieren - Legacy Route (veraltet)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    // Versuche einen besseren Ansatz basierend auf der apartment_id statt user_id
    const [lists] = await pool.query(
      `SELECT sl.* FROM shopping_lists sl 
       JOIN user_apartments ua ON sl.apartment_id = ua.apartment_id 
       WHERE sl.id = ? AND ua.user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    const { name, date } = req.body;
    
    // Aktualisierungslogik verbessert
    await pool.query(
      'UPDATE shopping_lists SET name = ?, date = ? WHERE id = ?',
      [name, date || lists[0].date, req.params.id]
    );
    
    // Holen der aktualisierten Liste
    const [updatedList] = await pool.query('SELECT * FROM shopping_lists WHERE id = ?', [req.params.id]);
    
    res.json({ 
      message: 'Einkaufsliste erfolgreich aktualisiert',
      ...updatedList[0]
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Einkaufsliste' });
  }
});

// Spezieller Endpunkt zum Aktualisieren des Listennamens basierend auf Apartment-Berechtigung
router.patch('/apartment/:apartmentId/list/:listId/name', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Listenname muss angegeben werden' });
    }
    
    // Pru00fcfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung fu00fcr dieses Apartment' });
    }
    
    // Pru00fcfen, ob die Liste existiert und zum angegebenen Apartment gehu00f6rt
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder gehu00f6rt nicht zum angegebenen Apartment' });
    }
    
    // Listenname aktualisieren
    await pool.query(
      'UPDATE shopping_lists SET name = ? WHERE id = ?',
      [name.trim(), listId]
    );
    
    // Aktualisierte Liste zuru00fcckgeben
    const [updatedList] = await pool.query('SELECT * FROM shopping_lists WHERE id = ?', [listId]);
    
    console.log(`Liste ${listId} wurde umbenannt zu '${name.trim()}' von Benutzer ${req.user.id}`);
    
    res.json({
      message: 'Listenname erfolgreich aktualisiert',
      ...updatedList[0]
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Listennamens:', error);
    res.status(500).json({ message: 'Serverfehler beim Aktualisieren des Listennamens' });
  }
});

// Einkaufsliste lu00f6schen
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Pru00fcfen, ob Liste existiert und dem Benutzer gehu00f6rt
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    // Lu00f6schen der Liste (Artikel werden durch ON DELETE CASCADE automatisch gelu00f6scht)
    await pool.query('DELETE FROM shopping_lists WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'Einkaufsliste erfolgreich gelu00f6scht' });
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler beim Hinzufügen des Artikels' });
  }
});

// Neues Element zu einer Einkaufsliste hinzufügen (Legacy - zur Abwärtskompatibilität)
router.post('/:id/items', verifyToken, async (req, res) => {
  try {
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(404).json({ message: 'Kein Apartment für diesen Benutzer gefunden' });
    }
    
    // Prüfen, ob Liste existiert und zu einem Apartment des Benutzers gehört
    const [lists] = await pool.query(
      `SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (${apartmentIds.map(() => '?').join(',')})`,
      [req.params.id, ...apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    const { name, quantity, category, completed } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO shopping_items (name, quantity, category, checked, list_id) VALUES (?, ?, ?, ?, ?)',
      [name, quantity || '', category || 'sonstiges', completed || false, req.params.id]
    );
    
    // Neu erstelltes Item mit vollständigen Daten zurückgeben
    const [newItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newItem[0]);
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler beim Hinzufügen des Artikels' });
  }
});

// Einkaufsliste löschen
router.delete('/apartment/:apartmentId/list/:listId', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    // Prüfen, ob die Liste existiert und zu diesem Apartment gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Erst alle Items der Liste löschen
    await pool.query(
      'DELETE FROM shopping_items WHERE list_id = ?',
      [listId]
    );
    
    // Dann die Liste selbst löschen
    await pool.query(
      'DELETE FROM shopping_lists WHERE id = ?',
      [listId]
    );
    
    res.json({ message: 'Einkaufsliste erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler beim Löschen der Einkaufsliste' });
  }
});

// Artikelstatus ändern (gekauft/nicht gekauft)
router.patch('/:listId/items/:itemId/toggle', verifyToken, async (req, res) => {
  try {
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(404).json({ message: 'Kein Apartment für diesen Benutzer gefunden' });
    }
    
    // Prüfen, ob Liste existiert und zu einem Apartment des Benutzers gehört
    const [lists] = await pool.query(
      `SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (${apartmentIds.map(() => '?').join(',')})`,
      [req.params.listId, ...apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    // Aktuellen Status des Artikels abrufen
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ? AND list_id = ?',
      [req.params.itemId, req.params.listId]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Artikel nicht gefunden' });
    }
    
    const newStatus = !items[0].checked;
    
    await pool.query(
      'UPDATE shopping_items SET checked = ? WHERE id = ?',
      [newStatus, req.params.itemId]
    );
    
    res.json({ 
      message: `Artikel als ${newStatus ? 'gekauft' : 'nicht gekauft'} markiert`,
      checked: newStatus
    });
  } catch (error) {
    console.error('Fehler beim u00c4ndern des Artikelstatus:', error);
    res.status(500).json({ message: 'Serverfehler beim u00c4ndern des Artikelstatus' });
  }
});

// Artikel lu00f6schen
router.delete('/:listId/items/:itemId', verifyToken, async (req, res) => {
  try {
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(404).json({ message: 'Kein Apartment für diesen Benutzer gefunden' });
    }
    
    // Prüfen, ob Liste existiert und zu einem Apartment des Benutzers gehört
    const [lists] = await pool.query(
      `SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (${apartmentIds.map(() => '?').join(',')})`,
      [req.params.listId, ...apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    await pool.query(
      'DELETE FROM shopping_items WHERE id = ? AND list_id = ?',
      [req.params.itemId, req.params.listId]
    );
    
    res.json({ message: 'Artikel erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler beim Löschen des Artikels' });
  }
});

// Neues Element zu einer Apartment-spezifischen Einkaufsliste hinzufügen
router.post('/apartment/:apartmentId/list/:listId/items', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    // Prüfen, ob die Liste existiert und zum Apartment gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder gehört nicht zum angegebenen Apartment' });
    }
    
    const { name, quantity, category, completed } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO shopping_items (name, quantity, category, checked, list_id) VALUES (?, ?, ?, ?, ?)',
      [name, quantity || '', category || 'sonstiges', completed || false, listId]
    );
    
    // Neu erstelltes Item mit vollständigen Daten zurückgeben
    const [newItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newItem[0]);
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler beim Hinzufügen des Artikels' });
  }
});

module.exports = router;
