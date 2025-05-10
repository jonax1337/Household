const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const { initializeDatabase } = require('./config/db');

// Routen importieren
const authRoutes = require('./routes/auth');
const apartmentRoutes = require('./routes/apartments');
const financesRoutes = require('./routes/finances');
const shoppingRoutes = require('./routes/shopping');
const roommatesRoutes = require('./routes/roommates');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const chatRoutes = require('./routes/chat');
const tasksRoutes = require('./routes/tasks');
const notificationsRoutes = require('./routes/notifications');
const activitiesRoutes = require('./routes/activities'); // Neu: Activities-Router

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Erweiterte CORS-Konfiguration für lokales Netzwerk und Produktion
const corsOptions = {
  // Erlaube explizit definierte Origins
  origin: function (origin, callback) {
    // Netzwerk-Debug-Info ausgeben
    console.log('CORS Origin:', origin);
    
    // Null origin bedeutet same-origin Anfrage (z.B. vom Browser direkt)
    if (!origin) return callback(null, true);
    
    // Allowed Origins konfigurieren
    const allowedOrigins = [
      // Lokale Entwicklung
      'http://localhost:3000',
      'https://localhost:3000',
      // Lokale Netzwerk-IPs für Entwicklung
      /^https?:\/\/192\.168\./,  // 192.168.x.x
      /^https?:\/\/10\./,        // 10.x.x.x
      /^https?:\/\/172\.16\./,  // 172.16.x.x
      // Render.com Frontend URL
      'https://household.onrender.com',
      // Falls du eine eigene Domain hast, füge sie hier hinzu
      // 'https://deine-domain.de'
    ];
    
    // Prüfe, ob die anfragende Origin in der Liste der erlaubten Origins ist
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    // Im Production-Mode können wir alle Origins erlauben für einfacheres Testing
    if (process.env.NODE_ENV !== 'production') {
      console.log('Warnung: Nicht-gelistete Origin im Dev-Mode zugelassen:', origin);
      return callback(null, true);
    } else {
      // In Produktion: Strikter mit CORS sein
      console.warn('CORS-Fehler: Unerlaubte Origin:', origin);
      return callback(new Error('Nicht erlaubte Origin'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 Stunden CORS-Cache im Browser
};

app.use(cors(corsOptions));
app.use(express.json());

// Debug-Middleware für API-Anfragen
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Datenbank initialisieren
initializeDatabase();

// API-Routen mit einheitlicher Struktur
app.use('/api/auth', authRoutes);
app.use('/api/apartments', apartmentRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/roommates', roommatesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activities', activitiesRoutes); // Neu: Activities-Router registrieren

// Health-Check-Route für API-Verfügbarkeit
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running' });
});

// Basis-Route
app.get('/', (req, res) => {
  res.send('Household API ist aktiv');
});

// Socket.io Event-Handler einrichten
io.on('connection', (socket) => {
  console.log('Ein Benutzer hat sich verbunden:', socket.id);
  
  // Benutzer tritt einem Apartment-Chat bei
  socket.on('join-apartment', (apartmentId) => {
    socket.join(`apartment_${apartmentId}`);
    console.log(`Benutzer ${socket.id} ist dem Apartment ${apartmentId} beigetreten`);
  });
  
  // 'User tippt...'-Status empfangen und weiterleiten
  socket.on('user-typing', (data) => {
    const { apartmentId, userId, userName } = data;
    // Sende an alle anderen Teilnehmer im selben Apartment
    socket.to(`apartment_${apartmentId}`).emit('user-typing', { userId, userName });
    //console.log(`Benutzer ${userName} (${userId}) tippt in Apartment ${apartmentId}`);
  });
  
  // Nachricht empfangen und an alle im selben Apartment senden
  socket.on('send-message', async (messageData) => {
    try {
      const { apartmentId, userId, content, encrypted = false } = messageData;
      
      // In Datenbank speichern (wir verwenden die bestehende Route/Funktionalität)
      const pool = require('./config/db').pool;
      
      // MySQL unterstützt RETURNING nicht direkt, daher machen wir zwei Abfragen
      const insertQuery = `
        INSERT INTO messages (apartment_id, user_id, content, created_at, encrypted)
        VALUES (?, ?, ?, NOW(), ?)
      `;
      
      // Führe Insert aus und erhalte die ID
      const [insertResult] = await pool.query(insertQuery, [apartmentId, userId, content, encrypted ? 1 : 0]);
      const messageId = insertResult.insertId;
      
      // Hole die eingefügte Nachricht
      const selectQuery = `
        SELECT id, content, created_at, encrypted FROM messages WHERE id = ?
      `;
      const [selectResult] = await pool.query(selectQuery, [messageId]);
      const savedMessage = selectResult[0];
      
      // Konvertiere encrypted von 0/1 zu false/true
      if (savedMessage) {
        savedMessage.encrypted = savedMessage.encrypted === 1;
      }
      
      // Benutzerinformationen abrufen
      const userQuery = `
        SELECT id, name, email FROM users WHERE id = ?
      `;
      const [userResult] = await pool.query(userQuery, [userId]);
      const user = userResult[0];
      
      // Vollständige Nachricht mit Benutzerinformationen erstellen
      const fullMessage = {
        ...savedMessage,
        user_id: userId,
        apartment_id: apartmentId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        // Verschlüsslungsstatus übernehmen (aus der Datenbank oder aus dem Original-Request)
        encrypted: savedMessage.encrypted || encrypted
      };
      
      // Nachricht an alle im selben Apartment senden
      io.to(`apartment_${apartmentId}`).emit('new-message', fullMessage);
    } catch (error) {
      console.error('Fehler beim Speichern/Senden der Nachricht:', error);
      socket.emit('error', { message: 'Nachricht konnte nicht gesendet werden' });
    }
  });
  
  // Nachricht lu00f6schen-Event
  socket.on('delete-message', async (data) => {
    try {
      const { messageId, apartmentId: clientApartmentId, userId: clientUserId } = data;
      
      if (!messageId) {
        throw new Error('Keine Nachrichten-ID angegeben');
      }
      
      console.log(`Versuche Nachricht mit ID ${messageId} zu lu00f6schen. Socket ID: ${socket.id}`);
      
      // Wir verwenden entweder die u00fcbergebene Apartment-ID oder suchen sie in der Datenbank
      let apartmentIdToUse = clientApartmentId;
      let userIdToUse = clientUserId;
      
      if (!apartmentIdToUse) {
        // Falls keine Apartment-ID u00fcbergeben wurde, in der Datenbank nachschlagen
        const pool = require('./config/db').pool;
        
        // Nachricht abrufen
        const selectQuery = `
          SELECT id, apartment_id, user_id FROM messages WHERE id = ?
        `;
        const [selectResult] = await pool.query(selectQuery, [messageId]);
        
        if (selectResult.length === 0) {
          throw new Error('Nachricht nicht gefunden');
        }
        
        const message = selectResult[0];
        apartmentIdToUse = message.apartment_id;
        userIdToUse = message.user_id;
      }
      
      console.log(`Lösche Nachricht ${messageId} in Apartment ${apartmentIdToUse}`);
      
      // Nachricht lu00f6schen
      const pool = require('./config/db').pool;
      const deleteQuery = `
        DELETE FROM messages WHERE id = ?
      `;
      const [deleteResult] = await pool.query(deleteQuery, [messageId]);
      
      // Pru00fcfen, ob die Löschung erfolgreich war
      const wasDeleted = deleteResult.affectedRows > 0;
      
      if (wasDeleted) {
        console.log(`Nachricht ${messageId} erfolgreich gelu00f6scht (${deleteResult.affectedRows} Zeilen). Broadcasting zu Apartment ${apartmentIdToUse}`);
      
        // Wichtig: Stelle sicher, dass alle relevanten Clients im Apartment-Raum sind
        const clientsInRoom = io.sockets.adapter.rooms.get(`apartment_${apartmentIdToUse}`);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        console.log(`Anzahl Clients im Raum apartment_${apartmentIdToUse}: ${numClients}`);
        
        // Zuerst direkt an den anfragenden Socket senden (zur Beshätigung)
        socket.emit('message-deleted', { 
          messageId,
          userId: userIdToUse,
          apartmentId: apartmentIdToUse,
          timestamp: new Date().toISOString(),
          success: true
        });
        
        // Dann an alle anderen Clients im selben Apartment-Raum senden
        socket.to(`apartment_${apartmentIdToUse}`).emit('message-deleted', { 
          messageId,
          userId: userIdToUse,
          apartmentId: apartmentIdToUse,
          timestamp: new Date().toISOString(),
          success: true
        });
      } else {
        console.log(`Nachricht ${messageId} konnte nicht gelu00f6scht werden (0 Zeilen betroffen)`);
        socket.emit('error', { message: 'Nachricht konnte nicht gelu00f6scht werden (nicht gefunden)' });
      }
    } catch (error) {
      console.error('Fehler beim Lu00f6schen der Nachricht:', error);
      socket.emit('error', { message: 'Nachricht konnte nicht gelu00f6scht werden' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Ein Benutzer hat die Verbindung getrennt:', socket.id);
  });
});

// Server starten (mit HTTP-Server, nicht direkt mit Express)
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT} (mit Socket.io)`);
});
