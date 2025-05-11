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
    
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? ORDER BY category, name',
      [id]
    );
    
    const list = {
      ...lists[0],
      items
    };
    
    res.json(list);
  } catch (error) {
    console.error('Fehler beim Abrufen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Eine Einkaufsliste archivieren oder wiederherstellen
router.put('/apartment/:apartmentId/list/:id/archive', verifyToken, async (req, res) => {
  try {
    const { apartmentId, id } = req.params;
    const { archived } = req.body;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    await pool.query(
      'UPDATE shopping_lists SET archived = ? WHERE id = ? AND apartment_id = ?',
      [archived ? 1 : 0, id, apartmentId]
    );
    
    res.json({ message: archived ? 'Liste wurde archiviert' : 'Liste wurde wiederhergestellt' });
  } catch (error) {
    console.error('Fehler beim Archivieren/Wiederherstellen der Einkaufsliste:', error);
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

// Neue Einkaufsliste für ein Apartment erstellen
router.post('/apartment/:apartmentId/list', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { apartmentId } = req.params;
    const { name, date, items } = req.body;
    
    // Logging zum Debugging
    console.log('Erstelle neue Einkaufsliste:', { apartmentId, name, date, itemCount: items?.length || 0 });
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    // Sicherstellen, dass das Datum valide ist oder null verwenden
    let safeDate;
    try {
      // Wenn date ein String ist, versuchen wir es zu parsen
      if (date && typeof date === 'string') {
        safeDate = new Date(date);
        // Überprüfen ob das Datum gültig ist
        if (isNaN(safeDate.getTime())) {
          safeDate = new Date(); // Fallback auf aktuelles Datum
          console.log('Ungültiges Datum wurde korrigiert:', date);
        }
      } else if (date instanceof Date) {
        safeDate = date;
      } else {
        safeDate = new Date();
      }
    } catch (dateError) {
      console.error('Fehler beim Datums-Parsing:', dateError);
      safeDate = new Date(); // Fallback auf aktuelles Datum
    }
    
    // Als MySQL-Datum-String formatieren (YYYY-MM-DD)
    const formattedDate = safeDate.toISOString().split('T')[0];
    
    console.log('Erstelle Einkaufsliste mit Datum:', formattedDate);
    
    // Liste erstellen
    const [result] = await connection.query(
      'INSERT INTO shopping_lists (name, date, apartment_id) VALUES (?, ?, ?)',
      [name || 'Neue Einkaufsliste', formattedDate, apartmentId]
    );
    
    const listId = result.insertId;
    
    // Artikel hinzufügen, falls vorhanden
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          // Sicherstellen, dass keine null-Werte übergeben werden
          const itemName = item.name || 'Neuer Artikel';
          const itemQuantity = (item.quantity !== undefined && item.quantity !== null) ? String(item.quantity) : '';
          const itemCategory = item.category || 'sonstiges';
          const itemChecked = item.checked === true ? 1 : 0; // Explizit auf 0/1 für MySQL umwandeln

          console.log('Füge Artikel hinzu:', { name: itemName, quantity: itemQuantity, category: itemCategory, checked: itemChecked });
          
          await connection.query(
            'INSERT INTO shopping_items (name, quantity, category, checked, list_id) VALUES (?, ?, ?, ?, ?)',
            [itemName, itemQuantity, itemCategory, itemChecked, listId]
          );
        } catch (itemError) {
          console.error('Fehler beim Hinzufügen eines Artikels:', itemError, 'Element:', item);
          // Wir werfen den Fehler nicht, um trotzdem die anderen Artikel hinzufügen zu können
        }
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
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Fehler beim Rollback der Transaktion:', rollbackError);
    }
    
    // Detaillierte Fehlerinformationen loggen
    console.error('Fehler beim Erstellen der Einkaufsliste:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      sqlState: error.sqlState,
      sqlCode: error.code,
      sqlErrno: error.errno,
      params: { apartmentId, itemCount: items?.length || 0 }
    });
    
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
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          await connection.query(
            'INSERT INTO shopping_items (name, category, checked, list_id) VALUES (?, ?, ?, ?)',
            [item.name || 'Neuer Artikel', item.category || 'sonstiges', item.checked ? 1 : 0, listId]
          );
        } catch (itemError) {
          console.error('Fehler beim Hinzufügen eines Artikels:', itemError);
        }
      }
    }
    
    await connection.commit();
    
    // Die neu erstellte Liste abrufen
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ?',
      [listId]
    );
    
    const [itemsData] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ?',
      [listId]
    );
    
    res.status(201).json({
      ...lists[0],
      items: itemsData
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Fehler beim Rollback:', rollbackError);
    }
    console.error('Fehler beim Erstellen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler' });
  } finally {
    connection.release();
  }
});

// Eine Einkaufsliste aktualisieren
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
    
    const { name, date, archived } = req.body;
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) updateData.date = date;
    if (archived !== undefined) updateData.archived = archived ? 1 : 0;
    
    // Nur aktualisieren, wenn es tatsächlich Änderungen gibt
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Keine Daten zum Aktualisieren angegeben' });
    }
    
    // Setze-Klauseln dynamisch generieren
    const setClause = Object.entries(updateData)
      .map(([key, _]) => `${key} = ?`)
      .join(', ');
    
    // Werte für die SQL-Abfrage
    const values = [...Object.values(updateData), req.params.id];
    
    await pool.query(
      `UPDATE shopping_lists SET ${setClause} WHERE id = ?`,
      values
    );
    
    // Aktualisierte Liste abrufen
    const [updatedList] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ?',
      [req.params.id]
    );
    
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ?',
      [req.params.id]
    );
    
    res.json({
      ...updatedList[0],
      items
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Eine Einkaufsliste löschen
router.delete('/apartment/:apartmentId/list/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { apartmentId, id } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await connection.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      await connection.rollback();
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    // Prüfen, ob die Liste existiert und zum angegebenen Apartment gehört
    const [lists] = await connection.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [id, apartmentId]
    );
    
    if (lists.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Alle Elemente der Liste löschen
    await connection.query(
      'DELETE FROM shopping_items WHERE list_id = ?',
      [id]
    );
    
    // Die Liste selbst löschen
    await connection.query(
      'DELETE FROM shopping_lists WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.json({ message: 'Einkaufsliste erfolgreich gelöscht' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('Fehler beim Rollback:', rollbackError);
    }
    console.error('Fehler beim Löschen der Einkaufsliste:', error);
    res.status(500).json({ message: 'Serverfehler' });
  } finally {
    connection.release();
  }
});

// Item zu einer Liste hinzufügen (neues Format mit Apartment-ID)
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
    
    // Prüfen, ob die Liste zum angegebenen Apartment gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    const { name, quantity, category, checked } = req.body;
    
    console.log('Füge Item zur Liste hinzu:', { listId, name, category, quantity, checked });
    
    // Prüfe, ob der Artikel bereits existiert (gleicher Name und Kategorie)
    const [existingItems] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? AND name = ? AND category = ?',
      [listId, name, category || 'sonstiges']
    );
    
    if (existingItems.length > 0) {
      // Ein Artikel mit diesem Namen und dieser Kategorie existiert bereits,
      // also aktualisieren wir ihn stattdessen
      await pool.query(
        'UPDATE shopping_items SET quantity = ?, checked = ? WHERE id = ?',
        [quantity || '', checked ? 1 : 0, existingItems[0].id]
      );
      
      const [updatedItem] = await pool.query(
        'SELECT * FROM shopping_items WHERE id = ?',
        [existingItems[0].id]
      );
      
      return res.json(updatedItem[0]);
    }
    
    // Ansonsten neuen Artikel hinzufügen
    const [result] = await pool.query(
      'INSERT INTO shopping_items (name, quantity, category, checked, list_id) VALUES (?, ?, ?, ?, ?)',
      [name, quantity || '', category || 'sonstiges', checked ? 1 : 0, listId]
    );
    
    const [newItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newItem[0]);
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Item zu einer Liste hinzufügen (Legacy - zur Abwärtskompatibilität)
router.post('/:id/items', verifyToken, async (req, res) => {
  try {
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
    
    // Prüfen, ob die Liste zu einem der Apartments des Benutzers gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (?)',
      [req.params.id, apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    const { name, quantity, category, checked } = req.body;
    
    // Prüfe, ob der Artikel bereits existiert (gleicher Name und Kategorie)
    const [existingItems] = await pool.query(
      'SELECT * FROM shopping_items WHERE list_id = ? AND name = ? AND category = ?',
      [req.params.id, name, category || 'sonstiges']
    );
    
    if (existingItems.length > 0) {
      // Ein Artikel mit diesem Namen und dieser Kategorie existiert bereits,
      // also aktualisieren wir ihn stattdessen
      await pool.query(
        'UPDATE shopping_items SET quantity = ?, checked = ? WHERE id = ?',
        [quantity || '', checked ? 1 : 0, existingItems[0].id]
      );
      
      const [updatedItem] = await pool.query(
        'SELECT * FROM shopping_items WHERE id = ?',
        [existingItems[0].id]
      );
      
      return res.json(updatedItem[0]);
    }
    
    // Ansonsten neuen Artikel hinzufügen
    const [result] = await pool.query(
      'INSERT INTO shopping_items (name, quantity, category, checked, list_id) VALUES (?, ?, ?, ?, ?)',
      [name, quantity || '', category || 'sonstiges', checked ? 1 : 0, req.params.id]
    );
    
    const [newItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newItem[0]);
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Item einer Liste aktualisieren
router.put('/:listId/items/:itemId', verifyToken, async (req, res) => {
  try {
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
    
    // Prüfen, ob die Liste zu einem der Apartments des Benutzers gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (?)',
      [req.params.listId, apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    // Prüfen, ob das Item zur Liste gehört
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ? AND list_id = ?',
      [req.params.itemId, req.params.listId]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Artikel nicht gefunden' });
    }
    
    const { name, quantity, category, checked } = req.body;
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (category !== undefined) updateData.category = category;
    if (checked !== undefined) updateData.checked = checked ? 1 : 0;
    
    // Nur aktualisieren, wenn es tatsächlich Änderungen gibt
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Keine Daten zum Aktualisieren angegeben' });
    }
    
    // Setze-Klauseln dynamisch generieren
    const setClause = Object.entries(updateData)
      .map(([key, _]) => `${key} = ?`)
      .join(', ');
    
    // Werte für die SQL-Abfrage
    const values = [...Object.values(updateData), req.params.itemId];
    
    await pool.query(
      `UPDATE shopping_items SET ${setClause} WHERE id = ?`,
      values
    );
    
    // Aktualisiertes Item abrufen
    const [updatedItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [req.params.itemId]
    );
    
    res.json(updatedItem[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Item aus einer Liste löschen
router.delete('/:listId/items/:itemId', verifyToken, async (req, res) => {
  try {
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
    
    // Prüfen, ob die Liste zu einem der Apartments des Benutzers gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (?)',
      [req.params.listId, apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    // Prüfen, ob das Item zur Liste gehört
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ? AND list_id = ?',
      [req.params.itemId, req.params.listId]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Artikel nicht gefunden' });
    }
    
    // Item löschen
    await pool.query(
      'DELETE FROM shopping_items WHERE id = ?',
      [req.params.itemId]
    );
    
    res.json({ message: 'Artikel erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Artikels:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Status eines Shopping-Items umschalten (neues Format mit Apartment-ID)
router.patch('/apartment/:apartmentId/list/:listId/items/:itemId/toggle', verifyToken, async (req, res) => {
  try {
    const { apartmentId, listId, itemId } = req.params;
    
    // Prüfen, ob der Benutzer Zugriff auf das Apartment hat
    const [apartments] = await pool.query(
      'SELECT * FROM user_apartments WHERE apartment_id = ? AND user_id = ?',
      [apartmentId, req.user.id]
    );
    
    if (apartments.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung für dieses Apartment' });
    }
    
    // Prüfen, ob die Liste zum angegebenen Apartment gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id = ?',
      [listId, apartmentId]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden' });
    }
    
    // Prüfen, ob das Item zur Liste gehört
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ? AND list_id = ?',
      [itemId, listId]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Artikel nicht gefunden' });
    }
    
    const item = items[0];
    const newCheckedStatus = item.checked === 1 ? 0 : 1;
    
    console.log(`Toggle Item ${itemId} Status von ${item.checked} zu ${newCheckedStatus}`);
    
    // Status umschalten
    await pool.query(
      'UPDATE shopping_items SET checked = ? WHERE id = ?',
      [newCheckedStatus, itemId]
    );
    
    // Aktualisiertes Item abrufen
    const [updatedItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [itemId]
    );
    
    res.json(updatedItem[0]);
  } catch (error) {
    console.error('Fehler beim Umschalten des Item-Status:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Status eines Shopping-Items umschalten (Legacy - zur Abwärtskompatibilität)
router.patch('/:listId/items/:itemId/toggle', verifyToken, async (req, res) => {
  try {
    const { listId, itemId } = req.params;
    
    // Benutzer-Apartments abrufen
    const [userApartments] = await pool.query(
      'SELECT apartment_id FROM user_apartments WHERE user_id = ?',
      [req.user.id]
    );
    
    const apartmentIds = userApartments.map(ua => ua.apartment_id);
    
    if (apartmentIds.length === 0) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
    
    // Prüfen, ob die Liste zu einem der Apartments des Benutzers gehört
    const [lists] = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = ? AND apartment_id IN (?)',
      [listId, apartmentIds]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ message: 'Einkaufsliste nicht gefunden oder keine Berechtigung' });
    }
    
    // Prüfen, ob das Item zur Liste gehört
    const [items] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ? AND list_id = ?',
      [itemId, listId]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Artikel nicht gefunden' });
    }
    
    const item = items[0];
    const newCheckedStatus = item.checked === 1 ? 0 : 1;
    
    console.log(`Toggle Item ${itemId} Status von ${item.checked} zu ${newCheckedStatus}`);
    
    // Status umschalten
    await pool.query(
      'UPDATE shopping_items SET checked = ? WHERE id = ?',
      [newCheckedStatus, itemId]
    );
    
    // Aktualisiertes Item abrufen
    const [updatedItem] = await pool.query(
      'SELECT * FROM shopping_items WHERE id = ?',
      [itemId]
    );
    
    res.json(updatedItem[0]);
  } catch (error) {
    console.error('Fehler beim Umschalten des Item-Status:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

module.exports = router;
