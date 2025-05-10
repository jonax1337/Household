import axios from 'axios';

// API-Basis-URL von der api.js übernehmen
const getBaseUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  if (window.location.port === '3000') {
    return `${protocol}//${hostname}:5000`;
  }
  
  return `${protocol}//${hostname}`;
};

const BASE_URL = getBaseUrl();

// Axios-Instanz für API-Aufrufe
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor für Token-Hinzufügung
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['x-auth-token'] = token;
  }
  return config;
});

// Flag für Mock-Daten
let useMockData = false;

/**
 * Task-Service für die Verwaltung von Reinigungs- und anderen Aufgaben
 * Bietet API-Funktionen für Templates und Instanzen von Aufgaben
 */
const taskService = {
  /**
   * Alle Aufgaben für ein Apartment abrufen
   * Enthält sowohl Templates als auch Instanzen
   */
  getTaskInstances: async (apartmentId) => {
    console.log('======================================================');
    console.log('=== FRONTEND DEBUGGING: getTaskInstances() ===');
    console.log('======================================================');
    console.log('Parameter:', { apartmentId });
    console.log('Zeitstempel:', new Date().toISOString());
    
    try {
      console.log(`%c[API-REQUEST] Lade Tasks für Apartment ${apartmentId}`, 'color: #00aa66;');
      console.log('Sende Anfrage an:', `${BASE_URL}/tasks/apartment/${apartmentId}`);
      
      const startTime = Date.now();
      const response = await api.get(`/tasks/apartment/${apartmentId}`);
      const endTime = Date.now();
      
      console.log(`GET-Anfrage abgeschlossen in ${endTime - startTime}ms`);
      console.log('Response Status:', response.status);
      console.log('Response Headers:', response.headers);
      
      // Daten für Frontend-Verwendung aufbereiten - GENAU wie vom Backend geliefert
      const { tasks, standaloneInstances } = response.data;
      
      // Wir geben die Daten direkt zurück, wie sie vom Backend kommen
      // Nur minimale Transformation für Frontend-Anzeige
      const processedTasks = [];
      
      // Für die Protokollierung
      console.log('VOLLSTÄNDIGE Backend-Antwort:');
      console.log('- tasks:', tasks ? `Array mit ${tasks.length} Einträgen` : 'Nicht vorhanden');
      console.log('- standaloneInstances:', standaloneInstances ? `Array mit ${standaloneInstances.length} Einträgen` : 'Nicht vorhanden');
      
      // Ausführliche Rohwerte-Protokollierung
      console.group('Vollständige Rohwerte (zusammengeklappt)');
      console.log('tasks:', JSON.stringify(tasks, null, 2));
      console.log('standaloneInstances:', JSON.stringify(standaloneInstances, null, 2));
      console.groupEnd();
      
      // Tasks und ihre Instanzen verarbeiten
      if (Array.isArray(tasks)) {
        tasks.forEach(task => {
          // Für jede Task, finde die nächste offene Instanz
          if (Array.isArray(task.instances) && task.instances.length > 0) {
            // Zeige alle Instanzen, auch erledigte, und sortiere nach Fälligkeitsdatum
            const instances = task.instances
              .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
            
            // Verarbeite alle Instanzen, nicht nur die offenen
            for (const instance of instances) {
              // Debugging der Instanzdaten
              console.log(`Instanz ${instance.id} für Task ${task.id} wird verarbeitet:`, {
                due_date: instance.due_date,
                status: instance.status, // Status explizit ausgeben
                original_format: typeof instance.due_date,
                parsed_date: instance.due_date ? new Date(instance.due_date).toISOString() : 'ungültig',
                instance_data: instance // vollständige Instanzdaten
              });
              
              processedTasks.push({
                id: instance.id,
                task_id: task.id,
                apartmentId: instance.apartment_id,
                title: task.title,
                description: task.description || '',
                assignedToId: instance.assigned_user_id,
                assignedTo: instance.assigned_user_name || 'Nicht zugewiesen',
                // Stellen sicher, dass das Fälligkeitsdatum korrekt konvertiert wird
                dueDate: instance.due_date,  // Direkt das Original-Datum verwenden
                due_date: instance.due_date, // Zusätzlich als Backup
                status: instance.status,
                isDone: instance.status === 'erledigt',
                points: instance.points_awarded || task.points || 0,
                // Originalwert der Punkte ohne Reduktion
                originalPoints: task.points || 0,
                // Zusätzliche Informationen über abgeschlossene Aufgaben
                completedAt: instance.completed_at, // Wann wurde die Aufgabe erledigt
                completedByUserId: instance.completed_by_user_id, // Wer hat die Aufgabe erledigt
                completedByName: instance.completed_by_user_name || null, // Name des Benutzers, falls verfügbar
                pointsReduction: instance.points_reduction || 0, // Punktereduktion (0-50%)
                pointsAwarded: instance.points_awarded || task.points || 0, // Tatsächlich vergebene Punkte
                // Wichtig: Archivierungsstatus sowohl von der Instanz als auch vom Template übernehmen
                archived: instance.archived === 1 || task.archived === 1,
                // Template-Archivstatus auch separat speichern für Debugging
                template_archived: task.archived === 1,
                
                repeat: task.interval_type || 'none',
                interval_type: task.interval_type, // Originaldaten behalten
                interval_value: task.interval_value, // Originaldaten behalten
                color: task.color || '#4a90e2',
                notes: instance.notes || '',
                is_recurring: task.is_recurring === 1
              });
            }
          }
        });
      }
      
      // Alleinstehende Instanzen nur hinzufügen, wenn sie tatsächlich existieren
      if (Array.isArray(standaloneInstances)) {
        standaloneInstances.forEach(instance => {
          if (instance && instance.id) {
            // Verbindung zur Task-Tabelle herstellen, falls vorhanden
            const taskInfo = instance.task_id && Array.isArray(tasks) ? 
              tasks.find(t => t.id === instance.task_id) : null;
            
            // Debugging der Instanzdaten
            console.log(`Eigenständige Instanz ${instance.id} wird verarbeitet:`, {
              due_date: instance.due_date,
              original_format: typeof instance.due_date,
              parsed_date: instance.due_date ? new Date(instance.due_date).toISOString() : 'ungültig'
            });
              
            processedTasks.push({
              id: instance.id,
              task_id: instance.task_id,
              apartmentId: instance.apartment_id,
              title: instance.title || taskInfo?.title || 'Unbenannte Aufgabe',
              assignedToId: instance.assigned_user_id,
              assignedTo: instance.assigned_user_name || 'Nicht zugewiesen',
              // Stellen sicher, dass das Fälligkeitsdatum korrekt konvertiert wird
              dueDate: instance.due_date, // Direkt das Original-Datum verwenden
              due_date: instance.due_date, // Zusätzlich als Backup
              status: instance.status,
              isDone: instance.status === 'erledigt',
              points: instance.points_awarded || taskInfo?.points || 0,
              // Wichtig: Archivierungsstatus übernehmen
              archived: instance.archived === 1,
              // Bei eigenständigen Instanzen gibt es kein Template
              template_archived: false,
              repeat: taskInfo?.interval_type || 'none', // Einmalige Aufgabe oder aus Vorlage
              interval_type: taskInfo?.interval_type, // Originaldaten behalten
              interval_value: taskInfo?.interval_value, // Originaldaten behalten
              color: instance.color || taskInfo?.color || '#4a90e2',
              notes: instance.notes || ''
            });
          }
        });
      }
      
      console.log('%c[API-SUCCESS] Tasks erfolgreich geladen', 'color: #00aa66;', processedTasks);
      return processedTasks;
    } catch (error) {
      console.error('Fehler beim Laden der Tasks:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Daten');
        return [
          { id: 1, title: 'Bad putzen', assignedTo: 'Max', assignedToId: '1', dueDate: '2025-05-10', points: 10, repeat: 'weekly', isDone: false, color: '#4a90e2' },
          { id: 2, title: 'Küche reinigen', assignedTo: 'Anna', assignedToId: '2', dueDate: '2025-05-05', points: 15, repeat: 'weekly', isDone: false, color: '#2ecc71' },
          { id: 3, title: 'Müll rausbringen', assignedTo: 'Max', assignedToId: '1', dueDate: '2025-05-04', points: 5, repeat: 'daily', isDone: true, color: '#f1c40f' }
        ];
      }
      throw error;
    }
  },

  /**
   * Statistische Daten für das Apartment abrufen
   */
  getApartmentStatistics: async (apartmentId) => {
    try {
      console.log(`%c[API-REQUEST] Lade Statistiken für Apartment ${apartmentId}`, 'color: #00aa66;');
      const response = await api.get(`/tasks/apartment/${apartmentId}/stats`);
      console.log('%c[API-SUCCESS] Statistiken erfolgreich geladen', 'color: #00aa66;', response.data);
      return response.data;
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Statistiken');
        return {
          userDistribution: [
            { user_id: 1, name: 'Max', completed_tasks: 12, points: 95 },
            { user_id: 2, name: 'Anna', completed_tasks: 8, points: 70 },
            { user_id: 3, name: 'Lisa', completed_tasks: 10, points: 80 }
          ],
          taskStats: { open_tasks: 5, completed_tasks: 30, skipped_tasks: 2, total_tasks: 37 }
        };
      }
      throw error;
    }
  },

  /**
   * Punkte und Benutzerinformationen für das Apartment abrufen
   */
  getApartmentScores: async (apartmentId) => {
    try {
      console.log(`%c[API-REQUEST] Lade Scores für Apartment ${apartmentId}`, 'color: #00aa66;');
      const response = await api.get(`/tasks/apartment/${apartmentId}/stats`);
      
      // Benutzerspezifische Daten extrahieren
      const { userDistribution } = response.data;
      
      // Daten formatieren
      const formattedScores = userDistribution.map(user => ({
        user_id: user.user_id,
        name: user.name,
        email: '', // Keine E-Mail in dieser API enthalten
        points: user.points || 0,
        completed_tasks: user.completed_tasks || 0
      }));
      
      console.log('%c[API-SUCCESS] Scores erfolgreich geladen', 'color: #00aa66;', formattedScores);
      return formattedScores;
    } catch (error) {
      console.error('Fehler beim Laden der Scores:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Scores');
        return [
          { user_id: 1, name: 'Max', email: 'max@example.com', points: 95, completed_tasks: 12 },
          { user_id: 2, name: 'Anna', email: 'anna@example.com', points: 70, completed_tasks: 8 },
          { user_id: 3, name: 'Lisa', email: 'lisa@example.com', points: 80, completed_tasks: 10 }
        ];
      }
      throw error;
    }
  },

  /**
   * Neue Aufgabe erstellen (entweder Template oder direkt eine Instanz)
   */
  createTask: async (apartmentId, taskData) => {
    try {
      console.log(`%c[API-REQUEST] Erstelle Task für Apartment ${apartmentId}`, 'color: #00aa66;', taskData);
      console.log('=== FRONTEND DEBUGGING: createTask() ===');
      console.log('Parameter:', { apartmentId, taskData });
      console.log('Laufzeit-Informationen:', {
        useMockData,
        baseUrl: BASE_URL,
        timestamp: new Date().toISOString()
      });
      
      // Vorbereitung der API-Daten mit ausführlichem Logging
      const apiTaskData = {
        title: taskData.title,
        assigned_user_id: taskData.assignedUserId || null,
        due_date: taskData.dueDate || taskData.due_date || null,
        initial_due_date: taskData.dueDate || taskData.due_date || null, // Wichtig: initial_due_date explizit setzen
        points: taskData.points || 5,
        notes: taskData.notes || '',
        color: taskData.color || '#4a90e2',
        is_recurring: taskData.isRecurring,
        interval_type: taskData.intervalType,
        interval_value: taskData.intervalValue
      };
      
      console.log('API-DATEN VERARBEITUNG:', {
        originalData: taskData,
        processedData: apiTaskData,
        assignmentInfo: {
          originalAssignedToId: taskData.assignedToId,
          originalAssignedUserId: taskData.assignedUserId,
          finalValue: apiTaskData.assigned_user_id
        }
      });
      
      let response;
      
      console.log('FRONTEND CHECKPOINT 1: Verarbeite Task-Typ...');
      console.log('Task-Wiederholung:', taskData.repeat);
      
      // Wiederholungsinformationen debuggen
      console.log('WIEDERHOLUNGS-DETAILS:', {
        repeat: taskData.repeat,
        isRecurring: taskData.isRecurring,
        intervalType: taskData.intervalType,
        intervalValue: taskData.intervalValue
      });
      
      // Alle Aufgaben werden auf die gleiche Weise erstellt:
      // 1. Erst ein Eintrag in der task-Tabelle (Template)
      // 2. Dann eine Instanz in der task_instance-Tabelle
      // Auch wenn es keine wiederkehrende Aufgabe ist, nutzen wir den gleichen Prozess
      console.log('FRONTEND CHECKPOINT 2: Erstelle Aufgabe (Task + Instanz)');
      console.log('NOTES DEBUG:', {
        originalNotes: taskData.notes,
        apiTaskDataNotes: apiTaskData.notes
      });
      
      const templateData = {
        title: apiTaskData.title,
        description: taskData.description || taskData.notes || apiTaskData.notes || '',
        points: apiTaskData.points,
        is_recurring: taskData.repeat && taskData.repeat !== 'none' ? true : false,
        interval_type: taskData.repeat && taskData.repeat !== 'none' ? (taskData.intervalType || taskData.repeat) : 'none',
        interval_value: taskData.intervalValue || 1,
        color: apiTaskData.color
      };
      
      // Make sure the description is not empty if notes exist
      console.log('TEMPLATE DESCRIPTION CHECK:', {
        finalDescription: templateData.description,
        sources: {
          'taskData.description': taskData.description,
          'taskData.notes': taskData.notes,
          'apiTaskData.notes': apiTaskData.notes
        }
      });
      
      console.log('TEMPLATE-DATEN INTERVAL DEBUGGING:', {
        original_intervalType: taskData.repeat,
        original_intervalValue: taskData.intervalValue,
        verwendeter_intervalType: templateData.interval_type,
        verwendeter_intervalValue: templateData.interval_value
      });
      
      console.log('FRONTEND CHECKPOINT 3: Sende Task-Daten an Server:', templateData);
      
      try {
        // Task erstellen (früher Template genannt)
        const templateResponse = await api.post(`/tasks/apartment/${apartmentId}/template`, templateData);
        console.log('FRONTEND CHECKPOINT 4: Task-Antwort erhalten:', templateResponse.data);
        
        if (!templateResponse.data || !templateResponse.data.template || !templateResponse.data.template.id) {
          console.error('FEHLER: Task-Antwort enthält keine gültige Task-ID!');
          console.error('Antwort:', templateResponse.data);
          throw new Error('Ungültige Task-ID in Server-Antwort');
        }
        
        const instanceData = {
          template_id: templateResponse.data.template.id,
          due_date: apiTaskData.due_date,
          assigned_user_id: apiTaskData.assigned_user_id,
          points: apiTaskData.points,
          notes: templateData.description  // Use the same value as the template description
        };
        
        console.log('INSTANCE NOTES CHECK:', {
          finalNotes: instanceData.notes,
          templateDescription: templateData.description,
          apiTaskDataNotes: apiTaskData.notes
        });
        
        console.log('FRONTEND CHECKPOINT 5: Sende Instanz-Daten mit template_id:', instanceData);
        
        // Instanz des Tasks erstellen
        response = await api.post(`/tasks/apartment/${apartmentId}/instance`, instanceData);
        console.log('FRONTEND CHECKPOINT 6: Instanz-Antwort erhalten:', response.data);
      } catch (error) {
        console.error('FEHLER beim Erstellen des Tasks oder der Instanz:', error);
        console.error('Fehlerdetails:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw error;
      }
      
      // Task-Daten analysieren und in Frontend-Format konvertieren
      console.log('%c[API-RESPONSE] Rohdaten vom Server:', 'color: #ff9900;', response.data);
      
      // Prüfen, ob die Antwort eine gültige Task-Instanz enthält
      if (!response.data.task || !response.data.task.id) {
        throw new Error('Die API-Antwort enthält keine gültige Task-Instanz');
      }
      
      // Hier nichts im Frontend umwandeln, sondern nur das Format anpassen
      const newTask = {
        id: response.data.task.id,
        task_id: response.data.task.task_id,
        apartmentId: parseInt(apartmentId),
        title: response.data.task.title,
        assignedTo: response.data.task.assigned_user_id ? `Benutzer ${response.data.task.assigned_user_id}` : 'Nicht zugewiesen',
        assignedToId: response.data.task.assigned_user_id,
        dueDate: response.data.task.due_date,
        status: response.data.task.status || 'offen',
        isDone: response.data.task.status === 'erledigt',
        points: response.data.task.points_awarded || taskData.points || 5,
        repeat: taskData.repeat || 'none',
        color: response.data.task.color || taskData.color || '#4a90e2',
        notes: response.data.task.notes || taskData.notes || ''
      };
      
      console.log('%c[API-SUCCESS] Task erfolgreich erstellt', 'color: #00aa66;', newTask);
      
      // Benachrichtigung senden, wenn Task erfolgreich erstellt wurde
      try {
        // Benutzerinfo aus dem localStorage holen
        const userRaw = localStorage.getItem('currentUser');
        const userData = userRaw ? JSON.parse(userRaw) : null;
        const userId = userData?.id;
        const userName = userData?.name || 'Jemand';
        
        // Benachrichtigung über die Integration senden
        import('./notificationIntegration').then(module => {
          const notifyService = module.default;
          notifyService.tasks.onTaskCreated(
            newTask.title,
            newTask.dueDate,
            newTask.points,
            apartmentId,
            userId,
            userName // Direkt den Namen übergeben
          );
        }).catch(err => console.warn('Fehler beim Laden der notificationIntegration:', err));
      } catch (notifyError) {
        console.warn('Benachrichtigung über neue Aufgabe konnte nicht gesendet werden:', notifyError);
      }
      
      // Nach der Erstellung erfolgt ein Neuladen der gesamten Liste
      // durch den aufrufenden Code, wir geben hier nur die neuen Daten zurück
      return newTask;
    } catch (error) {
      console.error('Fehler beim Erstellen der Task:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, erstelle Mock-Task');
        return {
          id: Date.now(),
          ...taskData,
          isDone: false
        };
      }
      throw error;
    }
  },

  /**
   * Aufgabe aktualisieren - kann sowohl Templates als auch Instanzen aktualisieren
   */
  updateTask: async (taskId, taskData) => {
    try {
      // Apartment-ID aus taskData extrahieren
      const apartmentId = taskData.apartment_id || taskData.apartmentId; 
      
      if (!apartmentId) {
        throw new Error('Apartment-ID ist für das Update erforderlich');
      }
      
      // Bestimmen, ob es sich um ein Template oder eine Instanz handelt
      const isTemplate = taskData.isTemplate === true || taskData.editType === 'template';
      
      console.log(`%c[API-REQUEST] Aktualisiere ${isTemplate ? 'Task-Template' : 'Task-Instanz'} ${taskId} für Apartment ${apartmentId}`, 'color: #00aa66;', taskData);
      
      // API-Daten vorbereiten - Bei Templates brauchen wir andere Daten als bei Instanzen
      let apiTaskData;
      
      if (isTemplate) {
        // Daten für Template-Aktualisierung (direkt in der task Tabelle)
        apiTaskData = {
          title: taskData.title,
          description: taskData.notes || taskData.description || '',
          points: taskData.points || 5,
          is_recurring: taskData.repeat && taskData.repeat !== 'none' ? 1 : 0,
          interval_type: taskData.repeat === 'daily' ? 'daily' : 
                         taskData.repeat === 'weekly' ? 'weekly' : 
                         taskData.repeat === 'biweekly' ? 'weekly' : 
                         taskData.repeat === 'monthly' ? 'monthly' : null,
          interval_value: taskData.repeat === 'biweekly' ? 2 : 1,
          color: taskData.color || '#4a90e2',
          initial_due_date: taskData.dueDate, // Wichtig: Duäpliciere initial_due_date vom dueDate beim Template
          // Hier verwenden wir nicht assigned_user_id, weil Template-Zuweisungen 
          // in zukünftigen Instanzen gesetzt werden
        };
      } else {
        // Daten für Instanz-Aktualisierung - NUR instanz-spezifische Eigenschaften
        apiTaskData = {
          assigned_user_id: taskData.assignedToId || taskData.assignedUserId,
          due_date: taskData.dueDate,
          status: taskData.isDone === true || taskData.status === 'erledigt' ? 'erledigt' : 'offen',
          notes: taskData.notes || taskData.description || '',
          // WICHTIG: Keine points_awarded mehr - diese kommen immer vom Template
          // Keine Template-Eigenschaften wie title oder color
        };
      }
      
      // Den richtigen Endpunkt basierend auf Template oder Instanz verwenden
      let endpoint;
      if (isTemplate) {
        // Da im Backend kein direkter Endpunkt zum Updaten von Templates existiert,
        // nutzen wir denselben Endpunkt wie bei der Erstellung, nur mit PUT statt POST
        endpoint = `/tasks/apartment/${apartmentId}/task/${taskId}`;
      } else {
        // Die task_instance Tabelle updaten
        endpoint = `/tasks/apartment/${apartmentId}/instance/${taskId}`;
      }
      
      console.log(`%c[API-DEBUG] Sende Request an Endpunkt: ${endpoint}`, 'color: #3498db;');
      const response = await api.put(endpoint, apiTaskData);
      
      // Antwort aufbereiten
      const updatedTask = {
        ...response.data.task,
        assignedTo: response.data.task.assigned_user_name || 'Nicht zugewiesen',
        assignedToId: response.data.task.assigned_user_id,
        isDone: response.data.task.status === 'erledigt',
        repeat: taskData.repeat || 'none'
      };
      
      console.log('%c[API-SUCCESS] Task erfolgreich aktualisiert', 'color: #00aa66;', updatedTask);
      
      // Benachrichtigung senden, wenn die Task aktualisiert wurde
      try {
        // Benutzerinfo aus dem localStorage holen
        const userRaw = localStorage.getItem('currentUser');
        const userData = userRaw ? JSON.parse(userRaw) : null;
        const userId = userData?.id;
        const userName = userData?.name || 'Jemand';
        
        // Analysieren, welche Felder geändert wurden
        const changedFields = {};
        if (apiTaskData.title) changedFields.title = true;
        if (apiTaskData.description) changedFields.description = true;
        if (apiTaskData.points) changedFields.points = true;
        if (apiTaskData.due_date) changedFields.dueDate = true;
        if (apiTaskData.assigned_user_id) changedFields.assignedUser = true;
        if (apiTaskData.is_recurring !== undefined) changedFields.recurring = true;
        
        // Benachrichtigung über die Integration senden
        import('./notificationIntegration').then(module => {
          const notifyService = module.default;
          
          // Wenn ein Benutzer zugewiesen wurde, spezielle Benachrichtigung senden
          if (changedFields.assignedUser && apiTaskData.assigned_user_id) {
            notifyService.tasks.onTaskAssigned(
              updatedTask.title,
              updatedTask.points,
              apiTaskData.assigned_user_id,
              apartmentId,
              userId,
              userName // Direkt den Namen übergeben
            );
          } else {
            // Allgemeine Bearbeitungs-Benachrichtigung
            notifyService.tasks.onTaskEdited(
              updatedTask.title,
              changedFields,
              apartmentId,
              userId,
              userName // Direkt den Namen übergeben
            );
          }
        }).catch(err => console.warn('Fehler beim Laden der notificationIntegration:', err));
      } catch (notifyError) {
        console.warn('Benachrichtigung über aktualisierte Aufgabe konnte nicht gesendet werden:', notifyError);
      }
      
      // Wenn eine neue Task erstellt wurde (z.B. bei wiederkehrenden Aufgaben)
      if (response.data.nextTask) {
        console.log('%c[API-INFO] Neue Aufgabeninstanz wurde erstellt', 'color: #3498db;', response.data.nextTask);
      }
      
      return updatedTask;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Task:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Update');
        return {
          ...taskData,
          id: taskId
        };
      }
      throw error;
    }
  },

  /**
   * Aufgabeninstanz als erledigt markieren mit korrekter Punkteberechnung
   */
  completeTaskInstance: async (instanceId, explicitApartmentId = null, customPointsAwarded = null, completedByUserId = null) => {
    try {
      // Die Apartment-ID sollte idealerweise vom Aufrufer mitgegeben werden
      let apartmentId = explicitApartmentId;
      
      // Wenn keine Apartment-ID angegeben wurde, Mocking-Daten verwenden
      if (!apartmentId) {
        // Im Fehlerfall wissen wir nicht, zu welchem Apartment die Aufgabe gehört
        // Daher verwenden wir den Mock-Modus
        console.warn('Apartment-ID fehlt für Task ' + instanceId + ', versuche aus localStorage zu lesen');
        
        try {
          // Versuche die aktuell ausgewählte Apartment-ID aus dem localStorage zu lesen
          const selectedApartment = JSON.parse(localStorage.getItem('selectedApartment'));
          if (selectedApartment && selectedApartment.id) {
            apartmentId = selectedApartment.id;
            console.log(`Apartment-ID ${apartmentId} aus localStorage verwendet`);
          }
        } catch (e) {
          console.error('Fehler beim Lesen der Apartment-ID aus localStorage:', e);
        }
        
        if (!apartmentId) {
          console.warn('Keine Apartment-ID gefunden, verwende Mock-Daten');
          useMockData = true;
          return { success: true, totalPoints: 10 };
        }
      }
      
      console.log(`%c[API-REQUEST] Markiere Task ${instanceId} als erledigt für Apartment ${apartmentId}`, 'color: #00aa66;');
      
      // Hole die aktuelle Task-Instanz, um die korrekten Punkte zu berechnen, falls nicht explizit übergeben
      let pointsToAward = customPointsAwarded;
      
      if (pointsToAward === null) {
        // Aufgabe holen und Punkte berechnen, wenn nicht explizit übergeben
        try {
          const taskResponse = await api.get(`/tasks/apartment/${apartmentId}/instance/${instanceId}`);
          const taskData = taskResponse.data.task;
          
          if (taskData) {
            // Punkteabzug für überfällige Aufgaben berechnen
            let originalPoints = taskData.points || 5;
            let reducedPoints = originalPoints;
            
            // Das Fälligkeitsdatum und aktuelle Datum vergleichen
            const dateValue = taskData.due_date;
            if (dateValue) {
              try {
                const parts = dateValue.split('-');
                if (parts.length === 3) {
                  const year = parseInt(parts[0]);
                  const month = parseInt(parts[1]) - 1;
                  const day = parseInt(parts[2]);
                  const dueDate = new Date(year, month, day);
                  
                  // Aktuelles Datum (nur Datumsteil)
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  // Ist die Aufgabe überfällig?
                  if (dueDate < today) {
                    // Anzahl der Tage, die überfällig ist
                    const diffTime = today.getTime() - dueDate.getTime();
                    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    // Intervall bestimmen
                    let intervalDays = 7; // Standard: 7 Tage
                    if (taskData.interval_type === 'daily') {
                      intervalDays = 1 * (taskData.interval_value || 1);
                    } else if (taskData.interval_type === 'weekly') {
                      intervalDays = 7 * (taskData.interval_value || 1);
                    } else if (taskData.interval_type === 'monthly') {
                      intervalDays = 30 * (taskData.interval_value || 1);
                    }
                    
                    // Linear skalierende Reduktion berechnen (max 50%)
                    const reduction = Math.min(0.5, (daysOverdue / intervalDays) * 0.5);
                    reducedPoints = Math.round(originalPoints * (1 - reduction));
                    console.log(`Punktereduktion berechnet: ${originalPoints} -> ${reducedPoints} (${Math.round(reduction * 100)}% Abzug)`);
                  }
                }
              } catch (e) {
                console.error('Fehler bei der Berechnung des Punktabzugs:', e);
              }
            }
            
            // Verwende die reduzierten Punkte
            pointsToAward = reducedPoints;
          }
        } catch (e) {
          console.error('Fehler beim Abrufen der Aufgabe für Punkteberechnung:', e);
          // Fallback auf Standardpunkte
          pointsToAward = 5;
        }
      }
      
      // Instanz als erledigt markieren mit korrekten Punkten
      const payload = {
        is_done: true
      };
      
      // Wenn Punkte berechnet wurden, füge sie zum Payload hinzu
      if (pointsToAward !== null) {
        payload.points_awarded = pointsToAward;
      }
      
      // Wenn angegeben wurde, wer die Aufgabe erledigt hat, füge diese Information hinzu
      if (completedByUserId !== null) {
        payload.completed_by_user_id = completedByUserId;
      }
      
      console.log('Sende Payload mit berechneten Punkten:', payload);
      const response = await api.put(`/tasks/apartment/${apartmentId}/instance/${instanceId}`, payload);
      
      // Daten für das Frontend aufbereiten
      const result = {
        success: true,
        totalPoints: response.data.task?.points_awarded || pointsToAward || 0,
        nextTask: response.data.nextTask
      };
      
      console.log('%c[API-SUCCESS] Task erfolgreich als erledigt markiert mit angepassten Punkten', 'color: #00aa66;', result);
      
      // Benachrichtigung an andere Wohnungsmitglieder senden
      try {
        // Dynamischer Import der zentralen Benachrichtigungsintegration
        import('./notificationIntegration').then(module => {
          const notifyService = module.default;
          if (notifyService && apartmentId) {
            // userId aus localStorage ermitteln
            const userRaw = localStorage.getItem('user');
            const userData = userRaw ? JSON.parse(userRaw) : null;
            const userId = userData?.id;
            
            // Aufgabendaten für die Benachrichtigung vorbereiten
            const taskData = {
              title: response.data.task?.title || 'Eine Aufgabe',
              points_awarded: response.data.task?.points_awarded || 0,
              color: response.data.task?.color || '#4a90e2',
              instanceId: instanceId,
              completed_by_user_id: response.data.task?.completed_by_user_id,
              completed_by_user_name: response.data.task?.completed_by_user_name
            };
            
            // Die zentralisierte Methode für Aufgabenbenachrichtigungen verwenden
            notifyService.tasks.onTaskCompleted(
              taskData,
              apartmentId,
              userId
            ).catch(err => console.error('Fehler beim Senden der Push-Benachrichtigung:', err));
          }
        }).catch(err => console.error('Fehler beim Laden der Benachrichtigungsintegration:', err));
      } catch (error) {
        console.error('Fehler beim Senden der Push-Benachrichtigung:', error);
        // Nicht kritischer Fehler, Haupt-Ergebnis trotzdem zurückgeben
      }
      
      return result;
    } catch (error) {
      console.error('Fehler beim Markieren der Task als erledigt:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Complete');
        return { success: true, totalPoints: 10 };
      }
      throw error;
    }
  },

  /**
   * Aufgabeninstanz aktualisieren
   */
  updateTaskInstance: async (instanceId, instanceData) => {
    try {
      // Apartment-ID ist erforderlich
      const apartmentId = instanceData.apartment_id || instanceData.apartmentId;
      
      if (!apartmentId) {
        throw new Error('Apartment-ID ist für das Update erforderlich');
      }
      
      console.log(`%c[API-REQUEST] Aktualisiere Task-Instanz ${instanceId} für Apartment ${apartmentId}`, 'color: #00aa66;', instanceData);
      
      // API-Daten vorbereiten
      const apiTaskData = {};
      if (instanceData.assigned_user_id) apiTaskData.assigned_user_id = instanceData.assigned_user_id;
      if (instanceData.assignedToId) apiTaskData.assigned_user_id = instanceData.assignedToId;
      if (instanceData.notes !== undefined) apiTaskData.notes = instanceData.notes;
      if (instanceData.due_date) apiTaskData.due_date = instanceData.due_date;
      if (instanceData.dueDate) apiTaskData.due_date = instanceData.dueDate;
      if (instanceData.is_done !== undefined) apiTaskData.is_done = instanceData.is_done;
      if (instanceData.isDone !== undefined) apiTaskData.is_done = instanceData.isDone;
      if (instanceData.archived !== undefined) apiTaskData.archived = instanceData.archived;
      
      const response = await api.put(`/tasks/apartment/${apartmentId}/instance/${instanceId}`, apiTaskData);
      
      const updatedInstance = {
        ...response.data.task,
        assignedTo: response.data.task.assigned_user_name || 'Nicht zugewiesen',
        assignedToId: response.data.task.assigned_user_id,
        isDone: response.data.task.status === 'erledigt'
      };
      
      console.log('%c[API-SUCCESS] Task-Instanz erfolgreich aktualisiert', 'color: #00aa66;', updatedInstance);
      return updatedInstance;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Task-Instanz:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Update');
        return {
          ...instanceData,
          id: instanceId
        };
      }
      throw error;
    }
  },

  /**
   * Aufgabe löschen
   */
  deleteTask: async (taskId, apartmentId) => {
    try {
      console.log(`%c[API-REQUEST] Lösche Task-Template ${taskId} für Apartment ${apartmentId}`, 'color: #00aa66;');
      
      // HINWEIS: Diese Funktion ist für Templates gedacht, wird aber aktuell nicht voll implementiert
      // Da wir uns auf Instanzen konzentrieren, wird ein Fehler geworfen
      throw new Error('Das Löschen von Task-Templates ist derzeit nicht implementiert');
    } catch (error) {
      console.error('Fehler beim Löschen des Task-Templates:', error);
      throw error;
    }
  },
  
  /**
   * Aufgabeninstanz löschen
   */
  deleteTaskInstance: async (instanceId, apartmentId) => {
    try {
      console.log(`%c[API-REQUEST] Lösche Task-Instanz ${instanceId} für Apartment ${apartmentId}`, 'color: #00aa66;');
      
      // Backend-Aufruf zum Löschen der Instanz
      const response = await api.delete(`/tasks/apartment/${apartmentId}/instance/${instanceId}`);
      
      console.log('%c[API-SUCCESS] Task-Instanz erfolgreich gelöscht', 'color: #00aa66;', response.data);
      
      // Rückgabe, ob es eine erledigte Aufgabe war und ob Punkte abgezogen wurden
      return { 
        success: true, 
        wasCompleted: response.data.wasCompleted, 
        pointsRemoved: response.data.pointsRemoved || 0
      };
    } catch (error) {
      console.error('Fehler beim Löschen der Task-Instanz:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Delete');
        return { success: true, wasCompleted: false, pointsRemoved: 0 };
      }
      throw error;
    }
  },

  /**
   * Task-Template und alle zugehörigen Instanzen archivieren oder wiederherstellen
   */
  archiveTaskTemplate: async (templateId, apartmentId, archived = true) => {
    try {
      console.log(`%c[API-REQUEST] ${archived ? 'Archiviere' : 'Stelle wieder her'} Task-Template ${templateId} für Apartment ${apartmentId}`, 'color: #00aa66;');
      
      // Backend-Aufruf zum Archivieren/Wiederherstellen des Templates
      const response = await api.put(`/tasks/apartment/${apartmentId}/template/${templateId}/archive`, { archived });
      
      console.log(`%c[API-SUCCESS] Task-Template erfolgreich ${archived ? 'archiviert' : 'wiederhergestellt'}`, 'color: #00aa66;', response.data);
      
      return { 
        success: true, 
        archived: response.data.archived
      };
    } catch (error) {
      console.error(`Fehler beim ${archived ? 'Archivieren' : 'Wiederherstellen'} des Task-Templates:`, error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Daten');
        return { success: true, archived: archived ? 1 : 0 };
      }
      throw error;
    }
  },

  /**
   * Eine erledigte Aufgabeninstanz wiederherstellen (auf Status 'offen' setzen)
   * und dabei neuere offene Instanzen derselben Vorlage entfernen
   */
  reopenTaskInstance: async (instanceId, apartmentId) => {
    try {
      console.log(`%c[API-REQUEST] Stelle Task-Instanz ${instanceId} als 'offen' wieder her für Apartment ${apartmentId}`, 'color: #00aa66;');
      
      // Backend-Aufruf zur Wiederherstellung der Instanz
      const response = await api.put(`/tasks/apartment/${apartmentId}/instance/${instanceId}/reopen`, {});
      
      console.log('%c[API-SUCCESS] Task-Instanz erfolgreich wiederhergestellt', 'color: #00aa66;', response.data);
      
      return {
        success: true,
        removedNewerInstance: response.data.removedNewerInstance,
        reopenedInstance: response.data.task,
        pointsRemoved: response.data.pointsRemoved || 0,
        newTotalPoints: response.data.newTotalPoints
      };
    } catch (error) {
      console.error('Fehler beim Wiederherstellen der Task-Instanz:', error);
      if (useMockData || error.message.includes('Network Error')) {
        console.warn('Backend nicht erreichbar, verwende Mock-Reopen');
        return { success: true, removedNewerInstance: null, reopenedInstance: { id: instanceId } };
      }
      throw error;
    }
  }
};

export default taskService;
