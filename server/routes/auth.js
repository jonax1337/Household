const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { pool } = require('../config/db');

// JWT Secret aus Umgebungsvariablen oder Fallback
const JWT_SECRET = process.env.JWT_SECRET || 'household-app-secret-key';

// Google OAuth Konfiguration
const GOOGLE_CLIENT_ID = '977146652564-vng4b46i585k4ntbsjj0q7r1kp85pqn5.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';

// Registrierung
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Prüfen, ob Benutzer bereits existiert
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Ein Benutzer mit dieser E-Mail existiert bereits' });
    }
    
    // Passwort hashen
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Benutzer in Datenbank speichern
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
    
    // Standard-Theme-Einstellung erstellen
    await pool.query(
      'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
      [result.insertId, 'system']
    );
    
    // JWT erstellen
    const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: '1d' });
    
    res.status(201).json({
      message: 'Benutzer erfolgreich registriert',
      token,
      user: {
        id: result.insertId,
        name,
        email
      }
    });
  } catch (error) {
    console.error('Registrierungsfehler:', error);
    res.status(500).json({ message: 'Serverfehler bei der Registrierung' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Benutzer finden
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'Ungültige E-Mail oder Passwort' });
    }
    
    const user = users[0];
    
    // Passwort überprüfen
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(400).json({ message: 'Ungültige E-Mail oder Passwort' });
    }
    
    // JWT erstellen
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      message: 'Login erfolgreich',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login-Fehler:', error);
    res.status(500).json({ message: 'Serverfehler beim Login' });
  }
});

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

// Benutzerinformationen abrufen (geschützte Route)
router.get('/user', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, oauth_provider, created_at FROM users WHERE id = ?', 
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    res.status(500).json({ message: 'Serverfehler' });
  }
});

// Google OAuth Authentifizierung
router.post('/google', async (req, res) => {
  console.log('[SERVER] Google OAuth-Anfrage erhalten:', req.body);
  const { code, redirectUri } = req.body;
  
  if (!code || !redirectUri) {
    console.error('[SERVER] Fehlende Parameter in der Google-Anfrage');
    return res.status(400).json({ message: 'Code und redirectUri sind erforderlich' });
  }
  
  try {
    console.log('[SERVER] Tausche Auth-Code gegen Token bei Google...');
    console.log(`[SERVER] Verwende Client-ID: ${GOOGLE_CLIENT_ID.substring(0, 10)}...`);
    console.log(`[SERVER] Verwende Client-Secret: ${GOOGLE_CLIENT_SECRET.substring(0, 5)}...`);
    console.log(`[SERVER] Verwende Redirect-URI: ${redirectUri}`);
    
    // Token von Google erhalten
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });
    
    console.log('[SERVER] Token-Antwort von Google erhalten:', tokenResponse.status);
    
    // Benutzerinfos von Google abrufen
    const { access_token } = tokenResponse.data;
    if (!access_token) {
      console.error('[SERVER] Kein access_token in der Google-Antwort:', tokenResponse.data);
      return res.status(400).json({ message: 'Ungültige Antwort von Google Auth' });
    }
    
    console.log('[SERVER] Rufe Nutzerinformationen von Google ab...');
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    console.log('[SERVER] Nutzerinformationen erhalten:', userInfoResponse.status);
    
    const { sub: googleId, email, name } = userInfoResponse.data;
    console.log('[SERVER] Nutzerinformationen extrahiert:', { googleId: googleId?.substring(0, 5), email, name });
    
    // Prüfen, ob Benutzer bereits existiert
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ? OR email = ?', 
      ['google', googleId, email]
    );
    
    let userId;
    
    if (existingUsers.length > 0) {
      // Benutzer existiert bereits
      const user = existingUsers[0];
      userId = user.id;
      
      // Der Benutzer existiert bereits - keine Aktion notwendig
    } else {
      // Neuen Benutzer anlegen
      const [result] = await pool.query(
        'INSERT INTO users (name, email, oauth_provider, oauth_id) VALUES (?, ?, ?, ?)',
        [name, email, 'google', googleId]
      );
      
      userId = result.insertId;
      
      // Standard-Theme-Einstellung erstellen
      await pool.query(
        'INSERT INTO user_settings (user_id, theme) VALUES (?, ?)',
        [userId, 'system']
      );
    }
    
    // JWT erstellen
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1d' });
    
    // Benutzerinfos abrufen
    const [users] = await pool.query(
      'SELECT id, name, email, oauth_provider FROM users WHERE id = ?', 
      [userId]
    );
    
    res.json({
      message: 'Login mit Google erfolgreich',
      token,
      user: users[0]
    });
  } catch (error) {
    console.error('[SERVER] Google Auth Fehler:', error.message);
    if (error.response) {
      console.error('[SERVER] Fehlerantwort von Google:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    res.status(500).json({ 
      message: 'Fehler bei der Google-Authentifizierung', 
      error: error.message,
      details: error.response?.data || 'Keine Details verfügbar'
    });
  }
});

module.exports = router;
