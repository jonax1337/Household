import api from './api';

const activityService = {
  /**
   * Aktivität erstellen
   * @param {number} apartmentId - ID der Wohnung
   * @param {string} type - Typ der Aktivität (z.B. 'task_completed', 'shopping_item_added', etc.)
   * @param {string} content - Beschreibungstext der Aktivität
   * @param {object} data - Zusätzliche Daten zur Aktivität (optional)
   * @returns {Promise<object>} - Erstellte Aktivität
   */
  createActivity: async (apartmentId, type, content, data = {}) => {
    try {
      const response = await api.post('/activities', {
        apartmentId,
        type,
        content,
        data
      });
      return response.data;
    } catch (error) {
      console.error('Fehler beim Erstellen einer Aktivität:', error);
      // Fehler weiterleiten, aber Anwendung nicht abstürzen lassen
      return null;
    }
  },

  /**
   * Aktivitäten für eine Wohnung abrufen
   * @param {number} apartmentId - ID der Wohnung
   * @param {number} limit - Maximale Anzahl der Aktivitäten
   * @param {number} offset - Offset für Paginierung
   * @returns {Promise<Array>} - Liste der Aktivitäten
   */
  getActivities: async (apartmentId, limit = 20, offset = 0) => {
    try {
      const response = await api.get(`/activities/apartment/${apartmentId}?limit=${limit}&offset=${offset}`);
      return response.data;
    } catch (error) {
      console.error('Fehler beim Abrufen von Aktivitäten:', error);
      return [];
    }
  },

  // Helfer-Funktion zum Erstellen von Aktivitäten für häufige Aktionen
  taskCompleted: async (apartmentId, userName, taskTitle, points) => {
    return activityService.createActivity(
      apartmentId,
      'task_completed',
      `hat "${taskTitle}" erledigt (+${points} Punkte)`,
      { taskTitle, points }
    );
  },

  shoppingItemAdded: async (apartmentId, userName, itemName) => {
    return activityService.createActivity(
      apartmentId,
      'shopping_item_added',
      `hat "${itemName}" zur Einkaufsliste hinzugefügt`,
      { itemName }
    );
  },

  shoppingListCreated: async (apartmentId, userName, listName) => {
    return activityService.createActivity(
      apartmentId,
      'shopping_list_created',
      `hat die Einkaufsliste "${listName}" erstellt`,
      { listName }
    );
  },

  financialTransactionAdded: async (apartmentId, userName, description, amount) => {
    return activityService.createActivity(
      apartmentId,
      'financial_transaction_added',
      `hat eine neue Transaktion "${description}" über ${amount} € hinzugefügt`,
      { description, amount }
    );
  },
};

export default activityService;
