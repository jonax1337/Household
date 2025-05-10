import api from './api';
import { io } from 'socket.io-client';
import cryptoService from './cryptoService';

// Chat Service für die Household-App
// Socket-Verbindung initialisieren (lazy loading)
let socket;

const getSocket = () => {
  if (!socket) {
    // Verbindung zum Socket.io-Server herstellen
    // Verwende die aktuelle Basis-URL des Browsers, aber ersetze den Port mit 5000
    // Das funktioniert sowohl lokal als auch im Netzwerk, wenn der Server unter gleicher IP läuft
    let serverUrl = window.location.origin;
    
    // In der Entwicklungsumgebung: Wenn die App nicht auf Port 5000 läuft, passe die URL an
    if (process.env.NODE_ENV !== 'production' && !serverUrl.includes(':5000')) {
      // Ersetze den Port oder füge ihn hinzu, wenn keiner vorhanden ist
      serverUrl = serverUrl.replace(/:\d+$/, '') + ':5000';
    }
      
    socket = io(serverUrl);
    
    // Grundlegende Verbindungs-Events registrieren
    socket.on('connect', () => {
      console.log('Socket.io verbunden:', socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket.io getrennt');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket.io Verbindungsfehler:', error);
    });
  }
  
  return socket;
};

export const chatService = {
  // Socket.io-Instanz abrufen
  getSocket: () => getSocket(),
  
  // Einem Apartment-Chat beitreten
  joinApartmentChat: (apartmentId) => {
    const socket = getSocket();
    socket.emit('join-apartment', apartmentId);
  },
  
  // 'User tippt...' Status senden
  sendTyping: (apartmentId, userId, userName) => {
    const socket = getSocket();
    socket.emit('user-typing', { apartmentId, userId, userName });
  },
  
  // Event-Listener fu00fcr 'User tippt...'
  onUserTyping: (callback) => {
    const socket = getSocket();
    socket.on('user-typing', callback);
    return () => socket.off('user-typing', callback);
  },
  
  // Event-Listener fu00fcr 'User tippt...' entfernen
  offUserTyping: (callback) => {
    const socket = getSocket();
    socket.off('user-typing', callback);
  },
  
  // Nachrichten aus der Datenbank laden und entschlüsseln (initial oder bei Reload)
  // Hole alle Nachrichten (für Abwärtskompatibilität)
  getMessages: async (apartmentId) => {
    return chatService.getMessagesByPage(apartmentId, 1, 100);
  },
  
  // Hole Nachrichten mit Paginierung (für effizientes Laden)
  getMessagesByPage: async (apartmentId, page = 1, pageSize = 20) => {
    try {
      console.log(`%c[CHAT] Lade Nachrichten für Apartment ${apartmentId} (Seite ${page})`, 'color: #0066aa;');
      
      // Nachrichten mit Paginierung vom Server holen
      const response = await api.get(`/chat/${apartmentId}?page=${page}&pageSize=${pageSize}`);
      console.log('%c[CHAT] Nachrichten erfolgreich geladen:', 'color: #00aa66;', response.data);
      
      // Entschlüsseln aller Nachrichten aus der Datenbank
      const decryptedMessages = response.data.map(message => {
        // Prüfen, ob die Nachricht als verschlüsselt markiert ist
        if (message.encrypted) {
          try {
            // Wichtig: Wir müssen die UserID des ABSENDERS zum Entschlüsseln verwenden
            const senderId = message.user_id;
            if (!senderId) {
              console.error('Keine Absender-ID in der Nachricht gefunden, Entschlüsselung nicht möglich');
              throw new Error('Keine Absender-ID');
            }
            
            // Nachricht mit Sender-Daten entschlüsseln
            const decryptedContent = cryptoService.decryptMessage(
              message.content, 
              message.apartment_id, 
              senderId // Hier MUSS die UserID des ABSENDERS verwendet werden
            );
            
            return {
              ...message,
              content: decryptedContent,
              encrypted: false // Markiere als entschlüsselt
            };
          } catch (error) {
            console.error('Fehler beim Entschlüsseln einer Nachricht:', error);
            return {
              ...message,
              content: '[Verschlüsselte Nachricht]',
              encryptionError: true
            };
          }
        }
        
        // Wenn die Nachricht nicht verschlüsselt ist, unverändert zurückgeben
        return message;
      });
      
      return decryptedMessages;
    } catch (error) {
      console.error('Fehler beim Abrufen der Nachrichten:', error);
      throw error.response ? error.response.data : new Error('Fehler beim Abrufen der Nachrichten');
    }
  },
  
  // Nachricht senden und auf Bestätigung warten (Promise-basiert)
  sendMessage: (apartmentId, content) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`%c[CHAT] Sende Nachricht an Apartment ${apartmentId}`, 'color: #0066aa;');
        
        // Aktuellen Benutzer abrufen
        const response = await api.get('/auth/user');
        
        // Fallback, falls response.data.user undefined ist
        let currentUser;
        let userId;
        
        if (response.data && response.data.user) {
          // Standard-Format: response.data.user enthält Benutzerinformationen
          currentUser = response.data.user;
          userId = currentUser.id;
        } else if (response.data && response.data.id) {
          // Alternatives Format: response.data ist direkt der Benutzer
          currentUser = response.data;
          userId = currentUser.id;
        } else {
          // Fallback auf localStorage, falls verfügbar
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              currentUser = JSON.parse(storedUser);
              userId = currentUser.id;
              console.log('%c[CHAT] Verwende Benutzer aus localStorage:', 'color: #0066aa;', currentUser);
            } catch (e) {
              console.error('Fehler beim Parsen des gespeicherten Benutzers:', e);
              reject(new Error('Kein Benutzer gefunden'));
              return;
            }
          } else {
            console.error('Kein Benutzer in der Antwort oder im localStorage gefunden');
            reject(new Error('Kein Benutzer gefunden'));
            return;
          }
        }
        
        console.log('%c[CHAT] Benutzer identifiziert:', 'color: #0066aa;', { id: userId, name: currentUser?.name });
        
        // MessageId generieren für die Nachverfolgung der Antwort
        const messageTrackingId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Nachricht verschlüsseln
        const encryptedContent = cryptoService.encryptMessage(content, apartmentId, userId);
        console.log('%c[CHAT] Nachricht verschlüsselt', 'color: #0066aa;');
        
        // Auf Bestätigung vom Server warten
        const socket = getSocket();
        
        // Einmal-Event-Handler einrichten, der auf neue Nachrichten wartet
        const messageConfirmationHandler = (newMessage) => {
          // Prüfe, ob die empfangene Nachricht unsere gerade gesendete ist
          // (Anhand des Inhalts, Timestamps und Benutzers)
          if (newMessage && 
              newMessage.user_id === userId && 
              Math.abs(new Date(newMessage.created_at) - new Date()) < 10000) { // Innerhalb von 10 Sekunden
            
            console.log('%c[CHAT] Nachricht bestätigt vom Server:', 'color: #00aa66;', newMessage);
            
            // Handler entfernen, um nicht mehrere Nachrichten abzufangen
            socket.off('new-message', messageConfirmationHandler);
            
            // Promise auflösen mit der empfangenen Nachricht
            resolve(newMessage);
          }
        };
        
        // Handler für Timeout
        const timeout = setTimeout(() => {
          // Nach Timeout den Handler entfernen und Promise ablehnen
          socket.off('new-message', messageConfirmationHandler);
          reject(new Error('Timeout beim Warten auf Nachrichtenbestätigung'));
        }, 10000); // 10 Sekunden Timeout
        
        // Event-Handler registrieren
        socket.on('new-message', messageConfirmationHandler);
        
        // Verschlüsselte Nachricht über Socket.io senden
        socket.emit('send-message', { 
          apartmentId, 
          userId, 
          content: encryptedContent, 
          encrypted: true,
          trackingId: messageTrackingId
        });
        
        console.log(`%c[CHAT] Nachricht gesendet, warte auf Bestätigung (Tracking-ID: ${messageTrackingId})`, 'color: #0066aa;');
        
        // Benachrichtigung an andere Apartment-Bewohner senden
        try {
          // Die currentUser-Daten haben wir bereits oben abgerufen
          const userName = currentUser?.name || 'Jemand';
          
          // Benachrichtigung an alle anderen im Apartment senden
          // Verwende das neuere API für localStorage
          const userRaw = localStorage.getItem('currentUser');
          const userData = userRaw ? JSON.parse(userRaw) : currentUser;
          const verifiedUserId = userData?.id || userId;
          const verifiedUserName = userData?.name || userName;
          
          // Benachrichtigung über die Integration senden
          import('./notificationIntegration').then(module => {
            const notifyService = module.default;
            if (notifyService) {
              // Nachricht-Details bereitstellen
              const messageData = {
                id: messageTrackingId,  // Tracking-ID als temporäre Message-ID
                timestamp: new Date().toISOString()
              };
              
              // Benachrichtigung senden
              notifyService.messages.onNewMessage(
                content,  // Unverschlüsselter Inhalt (bevor er verschlüsselt wurde)
                apartmentId,
                verifiedUserId,
                verifiedUserName,
                messageData
              );
            }
          }).catch(err => console.warn('Fehler beim Laden der notificationIntegration:', err));
        } catch (notifyError) {
          console.warn('Benachrichtigung über neue Nachricht konnte nicht gesendet werden:', notifyError);
          // Fehler bei der Benachrichtigung sollten nicht den Sendeprozess beeinträchtigen
        }
      } catch (error) {
        console.error('Fehler beim Senden der Nachricht:', error);
        reject(error.response ? error.response.data : new Error('Fehler beim Senden der Nachricht'));
      }
    });
  },
  
  // Event-Listener für neue Nachrichten (mit automatischer Entschlüsselung)
  onNewMessage: (callback) => {
    const socket = getSocket();
    
    // Wrapper, der die Nachricht entschlüsselt, bevor sie an den eigentlichen Callback weitergeleitet wird
    const decryptionWrapper = (message) => {
      // Prüfen, ob die Nachricht verschlüsselt ist
      if (message && message.encrypted) {
        try {
          // Wichtig: Wir verwenden die UserID des ABSENDERS zum Entschlüsseln, nicht die des aktuellen Benutzers
          // Damit stellen wir sicher, dass wir den gleichen Schlüssel wie beim Verschlüsseln verwenden
          const senderId = message.user_id || message.userId;
          if (!senderId) {
            console.error('Keine Absender-ID in der Nachricht gefunden, Entschlüsselung nicht möglich');
            throw new Error('Keine Absender-ID');
          }
          
          const decryptedContent = cryptoService.decryptMessage(
            message.content, 
            message.apartment_id || message.apartmentId, 
            senderId // Hier MUSS die UserID des ABSENDERS verwendet werden
          );
          
          // Nachricht mit entschlüsseltem Inhalt zurückgeben
          callback({
            ...message,
            content: decryptedContent,
            encrypted: false // Markiere als entschlüsselt
          });
        } catch (error) {
          console.error('Fehler beim Entschlüsseln der Nachricht:', error);
          // Bei Fehler die Originalnachricht weitergeben, aber mit Fehlerhinweis
          callback({
            ...message,
            content: '[Verschlüsselte Nachricht]',
            encryptionError: true
          });
        }
      } else {
        // Unverschlüsselte Nachrichten direkt weitergeben
        callback(message);
      }
    };
    
    socket.on('new-message', decryptionWrapper);
    
    // Rückgabe einer Cleanup-Funktion
    return () => socket.off('new-message', decryptionWrapper);
  },
  
  // Event-Listener fu00fcr Fehler registrieren
  onError: (callback) => {
    const socket = getSocket();
    socket.on('error', callback);
    return () => socket.off('error', callback);
  },
  
  // Nachricht löschen (u00fcber Socket.io) 
  deleteMessage: (messageId, apartmentId) => {
    try {
      if (!messageId) {
        throw new Error('Keine Nachrichten-ID angegeben');
      }
      
      // Aktuelle Benutzerinformationen abrufen
      const currentUser = JSON.parse(localStorage.getItem('user')) || {};
      const userId = currentUser.id;
      
      console.log(`%c[CHAT] Lösche Nachricht mit ID ${messageId} in Apartment ${apartmentId}`, 'color: #aa0066;');
      console.log(`%c[CHAT] Socket-Status: ${getSocket().connected ? 'Verbunden' : 'Nicht verbunden'}`, 'color: #aa0066;');
      
      // Socket.io-Event zum Löschen der Nachricht emittieren - mit mehr Kontext
      const socket = getSocket();
      
      // Stellen sicher, dass wir im richtigen Raum sind (re-join zur Sicherheit)
      if (apartmentId) {
        socket.emit('join-apartment', apartmentId);
      }
      
      // Detaillierte Daten fu00fcr den Lösch-Request senden
      socket.emit('delete-message', { 
        messageId, 
        userId,
        apartmentId,
        timestamp: new Date().toISOString()
      });
      
      return { deleted: true, socketId: socket.id };
    } catch (error) {
      console.error('Fehler beim Löschen der Nachricht:', error);
      throw error;
    }
  },
  
  // Event-Listener für gelöschte Nachrichten
  onMessageDeleted: (callback) => {
    const socket = getSocket();
    socket.on('message-deleted', callback);
    return () => socket.off('message-deleted', callback);
  },
  
  // Socket-Verbindung trennen (z.B. beim Logout)
  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }
};
