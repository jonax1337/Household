import taskService from './taskService';
import { resolveUserName } from './userUtils';

/**
 * Dashboard-Service zur Bereitstellung aggregierter Daten für das Dashboard
 */
const dashboardService = {
  /**
   * Lädt bevorstehende Aufgaben für die nächsten X Tage
   * @param {number} apartmentId - ID des Apartments
   * @param {number} daysAhead - Anzahl der Tage in die Zukunft (Standard: 3)
   * @returns {Promise<Array>} - Liste der bevorstehenden Aufgaben
   */
  getUpcomingTasks: async (apartmentId, daysAhead = 3) => {
    try {
      // Alle Aufgaben für das Apartment laden
      const allTasks = await taskService.getTaskInstances(apartmentId);
      
      // Aktuelles Datum und Grenzwert für die Filterung
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + daysAhead);
      
      // Filtern nach offenen Aufgaben in den nächsten X Tagen
      const upcomingTasks = allTasks.filter(task => {
        // Nur offene Aufgaben berücksichtigen
        if (task.status !== 'offen') return false;
        
        // Fälligkeitsdatum prüfen
        const dueDate = new Date(task.dueDate);
        return dueDate >= now && dueDate <= futureDate;
      });
      
      // Nach Fälligkeitsdatum sortieren
      return upcomingTasks.sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } catch (error) {
      console.error('Fehler beim Laden der bevorstehenden Aufgaben:', error);
      return [];
    }
  },
  
  /**
   * Lädt die Benutzer-Rangliste basierend auf den Punkten
   * @param {number} apartmentId - ID des Apartments
   * @returns {Promise<Array>} - Sortierte Liste der Benutzer mit Punkten
   */
  getUserRanking: async (apartmentId) => {
    try {
      // Direkter API-Aufruf zur Datenbank über den roommates-Router
      const baseUrl = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:5000' : '');
      const apiUrl = `${baseUrl}/api/roommates/user_apartments/${apartmentId}/points`;
      
      console.log('Rufe Punkterangliste ab:', apiUrl);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP-Fehler ${response.status} beim Abrufen der Rangliste`);
      }
      
      const usersData = await response.json();
      
      // Aktuelle Benutzer-ID ermitteln
      const currentUserRaw = localStorage.getItem('currentUser');
      const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
      
      // Benutzerdaten mit Namen und Istwert-Flag versehen
      const formattedUsers = usersData.map(user => ({
        id: user.user_id,
        name: user.user_name || resolveUserName(user.user_id, apartmentId),
        points: user.points || 0,
        isCurrentUser: currentUser && currentUser.id === user.user_id
      }));
      
      // Nach Punkten sortieren (absteigend)
      return formattedUsers.sort((a, b) => b.points - a.points);
    } catch (error) {
      console.error('Fehler beim Laden der Benutzer-Rangliste:', error);
      console.warn('Versuche Fallback-Methode mit vorhandenen Task-Daten...');
      
      try {
        // Fallback: Berechne Punkte aus Task-Instanzen
        const allTasks = await taskService.getTaskInstances(apartmentId);
        const completedTasks = allTasks.filter(task => task.status === 'erledigt' && task.completedByUserId);
        
        // Sammle alle User-IDs aus den Tasks
        const userIds = [...new Set(completedTasks.map(task => task.completedByUserId))];
        
        // Berechne Punkte pro Benutzer
        const userPoints = {};
        for (const userId of userIds) {
          const tasks = completedTasks.filter(task => task.completedByUserId === userId);
          const points = tasks.reduce((sum, task) => sum + (task.pointsAwarded || 0), 0);
          const name = tasks.find(t => t.completedByName)?.completedByName || resolveUserName(userId, apartmentId);
          
          userPoints[userId] = { id: userId, name, points };
        }
        
        // Aktuelle Benutzer-ID ermitteln
        const currentUserRaw = localStorage.getItem('currentUser');
        const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
        
        // Zu Array konvertieren und mit isCurrentUser markieren
        const result = Object.values(userPoints).map(user => ({
          ...user,
          isCurrentUser: currentUser && currentUser.id === user.id
        }));
        
        // Nach Punkten sortieren (absteigend)
        return result.sort((a, b) => b.points - a.points);
      } catch (fallbackError) {
        console.error('Auch Fallback für Rangliste fehlgeschlagen:', fallbackError);
        return [];
      }
    }
  },
  
  /**
   * Lädt die neuesten Aktivitäten für das Dashboard
   * @param {number} apartmentId - ID des Apartments
   * @param {number} limit - Maximale Anzahl der Aktivitäten (Standard: 10)
   * @returns {Promise<Array>} - Liste der neuesten Aktivitäten
   */
  getRecentActivities: async (apartmentId, limit = 10) => {
    try {
      // GET-Anfrage an den neuen API-Endpunkt für Aktivitäten
      const baseUrl = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:5000' : '');
      const apiUrl = `${baseUrl}/api/activities/apartment/${apartmentId}?limit=${limit}`;
      
      console.log('Rufe Aktivitäten ab:', apiUrl);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP-Fehler ${response.status} beim Abrufen der Aktivitäten`);
      }
      
      const activities = await response.json();
      console.log('Aktivitäten geladen:', activities);
      
      // Formatieren der Aktivitäten für die Anzeige
      return activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        user: activity.userName || resolveUserName(activity.userId, apartmentId),
        content: activity.content,
        timestamp: activity.createdAt,
        // Relativ formatierte Zeit (z.B. "vor 2 Stunden")
        time: formatRelativeTime(new Date(activity.createdAt)),
        // Symbol basierend auf dem Aktivitätstyp
        icon: getActivityIcon(activity.type),
        // Zusätzliche Daten für erweiterte Anzeigen
        data: activity.data || {}
      }));
    } catch (error) {
      console.error('Fehler beim Laden der Aktivitäten:', error);
      console.warn('Versuche Fallback-Methode mit vorhandenen Task-Daten...');
      
      try {
        // Fallback: Aktivitäten aus Task-Instanzen generieren
        const allTasks = await taskService.getTaskInstances(apartmentId);
        const completedTasks = allTasks.filter(task => task.status === 'erledigt' && task.completedAt)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, limit); // Begrenzen auf die angeforderte Anzahl
        
        return completedTasks.map((task, index) => ({
          id: `task-${task.id}` || index,
          type: 'task_completed',
          user: task.completedByName || 'Jemand',
          content: `hat "${task.title}" erledigt (+${task.pointsAwarded} Punkte)`,
          timestamp: task.completedAt,
          time: formatRelativeTime(new Date(task.completedAt)),
          icon: getActivityIcon('task_completed'),
          data: {
            taskId: task.id,
            taskTitle: task.title,
            pointsAwarded: task.pointsAwarded || 0
          }
        }));
      } catch (fallbackError) {
        console.error('Auch Fallback für Aktivitäten fehlgeschlagen:', fallbackError);
        return [];
      }
    }
  }
};

/**
 * Hilfsfunktion: Formatiert einen Zeitstempel relativ zur aktuellen Zeit
 * @param {Date} date - Zu formatierendes Datum
 * @returns {string} - Relativer Zeitstring (z.B. "vor 2 Stunden")
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'gerade eben';
  if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Minuten`;
  if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Stunden`;
  if (diffInSeconds < 172800) return 'gestern';
  if (diffInSeconds < 604800) return `vor ${Math.floor(diffInSeconds / 86400)} Tagen`;
  
  // Für ältere Einträge ein konkretes Datum zurückgeben
  return date.toLocaleDateString('de-DE');
}

/**
 * Hilfsfunktion: Gibt ein Aktivitäts-Icon basierend auf dem Typ zurück
 * @param {string} type - Aktivitätstyp 
 * @returns {Object} - React-Icon-Komponente mit Farbe
 */
function getActivityIcon(type) {
  // Wird in der Komponente direkt implementiert, da wir hier keine React-Icons importieren können
  return {
    type,
    color: getActivityColor(type)
  };
}

/**
 * Hilfsfunktion: Gibt eine Farbe basierend auf dem Aktivitätstyp zurück
 * @param {string} type - Aktivitätstyp
 * @returns {string} - Farbcode
 */
function getActivityColor(type) {
  switch (type) {
    case 'task_completed':
      return '#4CAF50'; // Grün
    case 'task_created':
    case 'task_assigned':
    case 'task_edited':
      return '#9C7CF4'; // Lila
    // Neue Typen - Einkaufsliste
    case 'shopping_item_added':
    case 'item_added': // Backward compatibility
    case 'item_checked':
    case 'shopping_list_created':
    case 'list_completed':
      return '#64CFF6'; // Blau
    // Neue Typen - Finanzen
    case 'financial_transaction_added':
    case 'expense_added': // Backward compatibility
    case 'payment_received':
      return '#4CAF50'; // Grün
    case 'message':
      return '#FF9554'; // Orange
    default:
      console.log('Unbekannter Aktivitätstyp für Farbe:', type);
      return '#9E9E9E'; // Grau
  }
}

export default dashboardService;
