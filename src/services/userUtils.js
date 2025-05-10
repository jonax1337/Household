/**
 * Vereinfachte direkte Funktionen zur Benutzernamensauflösung
 */

import { userService, roommateService } from './api';

// In-Memory-Cache für alle bekannten Benutzer - ID zu Name Mapping
const userCache = {};

/**
 * Gibt den Namen eines Benutzers basierend auf seiner ID zurück
 * So simpel und direkt wie möglich implementiert
 * 
 * @param {number|string} userId - Die Benutzer-ID des gesuchten Benutzers
 * @param {number|string} apartmentId - Die Apartment-ID
 * @returns {string} - Der aufgelöste Benutzername oder ein Fallback
 */
export const resolveUserName = (userId, apartmentId) => {
  // Wenn keine ID, dann Standardwert zurückgeben
  if (!userId) return 'Jemand';
  
  try {
    // 1. Versuch: Ist es der aktuelle Benutzer?
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      const currentUser = JSON.parse(userRaw);
      if (currentUser && (currentUser.id == userId || currentUser.id === parseInt(userId))) {
        return currentUser.name || 'Du';
      }
    }
    
    // 2. Versuch: Ist der Benutzer bereits im Cache?
    if (userCache[userId]) {
      return userCache[userId];
    }
    
    // 3. Versuch: Haben wir den Benutzer in der Liste der Mitbewohner?
    const roommatesRaw = localStorage.getItem('roommates');
    if (roommatesRaw) {
      try {
        const roommates = JSON.parse(roommatesRaw);
        if (Array.isArray(roommates)) {
          const roommate = roommates.find(r => r.id == userId);
          if (roommate && roommate.name) {
            // Im Cache speichern
            userCache[userId] = roommate.name;
            return roommate.name;
          }
        }
      } catch (parseError) {
        console.warn('Fehler beim Parsen des Roommates-Cache', parseError);
      }
    }
    
    // Wenn wir bis hierhin kommen, dann versuchen wir, die Liste der Mitbewohner zu holen und zu cachen
    // Das geschieht asynchron und wird nicht sofort verfügbar sein
    if (apartmentId) {
      roommateService.getAll(apartmentId)
        .then(roommates => {
          if (Array.isArray(roommates)) {
            // In localStorage cachen
            localStorage.setItem('roommates', JSON.stringify(roommates));
            
            // User-Cache aktualisieren
            roommates.forEach(roommate => {
              userCache[roommate.id] = roommate.name;
            });
            
            console.log('Benutzer-Cache mit neuen Daten aktualisiert:', userCache);
          }
        })
        .catch(err => console.warn('Fehler beim Laden der Mitbewohner:', err));
    }
    
    // Falls wir den Namen später brauchen und er dann im Cache ist
    // In der Zwischenzeit verwenden wir einen Fallback
    return `Benutzer ${userId}`;
  } catch (error) {
    console.error('Fehler bei der Benutzernamensauflösung:', error);
    return `Benutzer ${userId}`;
  }
};

/**
 * Prüft, ob die angegebene ID zum aktuellen Benutzer gehört
 * 
 * @param {number|string} userId - Die zu prüfende Benutzer-ID
 * @returns {boolean} - true, wenn die ID zum aktuellen Benutzer gehört
 */
export const isCurrentUser = (userId) => {
  if (!userId) return false;
  
  try {
    const userRaw = localStorage.getItem('currentUser');
    const currentUser = userRaw ? JSON.parse(userRaw) : null;
    
    return currentUser && 
           (currentUser.id == userId || currentUser.id === parseInt(userId));
  } catch (error) {
    console.warn('Fehler beim Vergleichen der Benutzer-IDs:', error);
    return false;
  }
};
