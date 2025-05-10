import CryptoJS from 'crypto-js';

/**
 * Service zur Verschlüsselung und Entschlüsselung von Chat-Nachrichten
 * Verwendet AES-Verschlüsselung aus der crypto-js Bibliothek
 * 
 * Die Nachrichten werden mit einem Schlüssel verschlüsselt, der aus der
 * ApartmentID und der UserID generiert wird.
 */
const cryptoService = {
  /**
   * Generiert einen Verschlüsselungsschlüssel aus ApartmentID und UserID
   * @param {number|string} apartmentId - ID der Wohnung
   * @param {number|string} userId - ID des Benutzers
   * @returns {string} - Verschlüsselungsschlüssel
   */
  generateKey: (apartmentId, userId) => {
    // Kombiniere ApartmentID und UserID zu einem eindeutigen Schlüssel
    // Füge einen Salt hinzu, um die Sicherheit zu erhöhen
    const salt = 'household-app-secure-chat-v1';
    return `${salt}-${apartmentId}-${userId}`;
  },

  /**
   * Verschlüsselt eine Nachricht mit dem generierten Schlüssel
   * @param {string} message - Zu verschlüsselnde Nachricht
   * @param {number|string} apartmentId - ID der Wohnung
   * @param {number|string} userId - ID des Benutzers
   * @returns {string} - Verschlüsselte Nachricht als String
   */
  encryptMessage: (message, apartmentId, userId) => {
    try {
      if (!message) return '';
      
      const key = cryptoService.generateKey(apartmentId, userId);
      const encrypted = CryptoJS.AES.encrypt(message, key).toString();
      return encrypted;
    } catch (error) {
      console.error('Verschlüsselungsfehler:', error);
      return message; // Fallback: unverschlüsselte Nachricht bei Fehler
    }
  },

  /**
   * Entschlüsselt eine Nachricht mit dem generierten Schlüssel
   * @param {string} encryptedMessage - Verschlüsselte Nachricht
   * @param {number|string} apartmentId - ID der Wohnung
   * @param {number|string} userId - ID des Benutzers (des ursprünglichen Senders)
   * @returns {string} - Entschlüsselte Nachricht
   */
  decryptMessage: (encryptedMessage, apartmentId, userId) => {
    try {
      if (!encryptedMessage) return '';
      
      const key = cryptoService.generateKey(apartmentId, userId);
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      // Wenn die Entschlüsselung fehlschlägt, wird ein leerer String zurückgegeben
      return decrypted || '[Verschlüsselte Nachricht]';
    } catch (error) {
      console.error('Entschlüsselungsfehler:', error);
      return '[Verschlüsselte Nachricht]'; // Freundliche Fehlermeldung
    }
  }
};

export default cryptoService;
