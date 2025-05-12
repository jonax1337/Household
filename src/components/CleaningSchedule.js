import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiPlus, FiUserPlus, FiCheck, FiInfo, FiTrash2, FiCalendar, FiEdit2, FiAward, FiRepeat, FiLayout, FiArchive, FiClock, FiUser, FiUserCheck, FiFilter, FiChevronDown, FiX, FiPlusCircle, FiMoreVertical, FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import NoApartmentSelected from './NoApartmentSelected';

// Inline Styles für Template- und Instanz-Darstellung
const styles = {
  // Header Styles
  stickyHeaderCard: {
    position: 'sticky',
    top: 'max(16px, env(safe-area-inset-top) + 16px)', // Berücksichtigt Safe Area für Geräte mit Notches
    zIndex: 10,
    background: 'var(--card-background)', // Transparenter Hintergrund für Glaseffekt
    backdropFilter: 'var(--glass-blur)', // Unschärfe-Effekt für Glasmorphismus
    WebkitBackdropFilter: 'var(--glass-blur)', // Für Safari
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)', // Weicher Schatten für Glaseffekt
    borderRadius: 'var(--card-radius)',
    border: 'var(--glass-border)', // Feine Grenze für Glaseffekt
    transition: 'all 0.3s ease',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%'
  },
  headerTitle: {
    margin: 0,
    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
    fontWeight: 'bold',
    color: 'var(--text-primary)'
  },
  // Task Styles
  taskContainer: {
    position: 'relative',
    marginBottom: '8px',
    background: 'var(--card-background)',
    borderRadius: 'var(--button-radius)',
    padding: '16px',
    boxShadow: 'var(--shadow)',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border-color)'
  },
  taskTemplateContainer: {
    borderLeft: '3px solid var(--primary)'
  },
  taskInstanceContainer: {
    borderLeft: '3px solid transparent'
  },
  taskIcon: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  templateBadge: {
    background: 'rgba(var(--primary-rgb), 0.1)',
    color: 'var(--primary)',
    padding: '0 8px',
    borderRadius: 'var(--button-radius)',
    fontSize: '10px',
    fontWeight: 'bold',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '16px'
  }
};

// Task-Service für API-Aufrufe importieren
import taskService from '../services/taskService';

// Hilfsfunktion zum Generieren konsistenter Farben für Benutzer
const getColorForUser = (userId) => {
  if (!userId) return 'primary';
  // Feste Farbpalette für verschiedene Benutzer
  const colors = ['primary', 'secondary', 'success', 'warning', 'error'];
  // Stelle sicher, dass userId ein String ist
  const userIdString = String(userId);
  // Einfachere Hash-Funktion basierend auf der Summe der Charcode-Werte
  let hash = 0;
  for (let i = 0; i < userIdString.length; i++) {
    hash = ((hash << 5) - hash) + userIdString.charCodeAt(i);
  }
  return colors[Math.abs(hash) % colors.length];
};


// Style-Block für die Animationen
const cssAnimations = `
  @keyframes expandMenu {
    from { 
      max-height: 0; 
      opacity: 0;
      transform: translateY(-10px);
    }
    to { 
      max-height: 100px; 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .menu-item-button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important;
  }
`;

const CleaningSchedule = ({ selectedApartment }) => {
  // CSS-Animationen im Head einfügen
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = cssAnimations;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  // Extrahiere apartmentId aus selectedApartment mit Fallback-Wert
  const apartmentId = selectedApartment?.id || 0;
  
  // Zweistufiges Layout für mobile Optimierung mit Fullscreen-Modal
  const [showAddForm, setShowAddForm] = useState(false);
  const [cleaningTasks, setCleaningTasks] = useState([]);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    assignedTo: '', 
    dueDate: '', 
    points: 5, 
    repeat: 'none',
    customInterval: '', // Für benutzerdefinierte Intervalle
    color: '#4a90e2', // Standardfarbe
    notes: '' // Zusätzliche Notizen
  });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('list'); // 'list' oder 'calendar'
  const [editingTask, setEditingTask] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'completed', 'all', 'archived'
  const [taskHistory, setTaskHistory] = useState([]); // Aufzeichnung, wer wann was gemacht hat
  const [showCustomInterval, setShowCustomInterval] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [invitedRoommates, setInvitedRoommates] = useState([]); // Liste der Mitbewohner für Zuweisung
  const [currentUser, setCurrentUser] = useState(null); // Aktueller eingeloggter Benutzer
  const [reassignMenuVisible, setReassignMenuVisible] = useState(false);
  const [taskToReassign, setTaskToReassign] = useState(null);
  const [userPoints, setUserPoints] = useState({}); // Punktestände der Mitbewohner
  const [selectedReassignUserId, setSelectedReassignUserId] = useState(''); // Für die Neuzuweisung ausgewählter Benutzer
  const [activeMenuTask, setActiveMenuTask] = useState(null);
  const [showEditTypeModal, setShowEditTypeModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  // Für verschiedene Aktionen mit Bestätigung (Übernehmen, Löschen usw.)
  const [currentTaskAction, setCurrentTaskAction] = useState(null);
  const [completeForOtherUser, setCompleteForOtherUser] = useState(false);
  const [taskToCompleteForOther, setTaskToCompleteForOther] = useState(null);

  // State für Fehlermeldungen
  const [formError, setFormError] = useState('');

  // Farboptionen für Tasks
  const colorOptions = [
    { value: '#4a90e2', label: 'Blau' },
    { value: '#50c878', label: 'Grün' },
    { value: '#f5a623', label: 'Orange' },
    { value: '#e74c3c', label: 'Rot' },
    { value: '#9b59b6', label: 'Lila' },
    { value: '#f1c40f', label: 'Gelb' }
  ];
  
  // Wiederholungsoptionen
  const repeatOptions = [
    { value: 'none', label: 'Keine Wiederholung' },
    { value: 'daily', label: 'Täglich' },
    { value: 'weekly', label: 'Wöchentlich' },
    { value: 'monthly', label: 'Monatlich' },
    { value: 'custom', label: 'Benutzerdefiniert...' }
  ];

  // Lade den aktuellen Benutzer aus localStorage
  useEffect(() => {
    try {
      const userString = localStorage.getItem('currentUser');
      if (userString) {
        const user = JSON.parse(userString);
        console.log('Aktueller Benutzer aus localStorage geladen:', user);
        setCurrentUser(user);
      } else {
        console.warn('Kein Benutzer im localStorage gefunden');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Benutzers aus localStorage:', error);
    }
  }, []);

  // Diese Funktion zum Laden der Daten ist jetzt außerhalb des useEffect definiert,
  // damit sie von anderen Funktionen in der Komponente aufgerufen werden kann
  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Starte Laden der Daten für Apartment:', apartmentId);
        
      // Der aktuelle Benutzer wird aus dem localStorage geladen
      const savedUserData = localStorage.getItem('user');
      let currentUserId = null;
      if (savedUserData) {
        const userData = JSON.parse(savedUserData);
        setCurrentUser(userData);
        currentUserId = userData.id;
      }
      
      // Sequentiell laden um Fehler besser zu identifizieren
      console.log('Lade Tasks...');
      const tasks = await taskService.getTaskInstances(apartmentId);
      console.log('Tasks geladen:', tasks);
      
      console.log('Lade Statistiken...');
      const apartmentStats = await taskService.getApartmentStatistics(apartmentId);
      console.log('Statistiken geladen:', apartmentStats);
      
      console.log('Lade Scores...');
      const roommatesResponse = await taskService.getApartmentScores(apartmentId);
      console.log('Scores geladen:', roommatesResponse);
      
      console.log('Alle Daten erfolgreich geladen', {
        tasks: tasks,
        statistics: apartmentStats,
        roommates: roommatesResponse
      });
      
      // Die Benutzer aus der Apartment-Scores API setzen
      if (Array.isArray(roommatesResponse)) {
        const roommates = roommatesResponse.map(score => ({
          id: score.user_id,
          name: score.name,
          email: score.email
        }));
        console.log('Mitbewohner aus API:', roommates);
        setInvitedRoommates(roommates);
      } else {
        console.warn('Keine gültigen Mitbewohner-Daten erhalten');
      }
      
      // Punktestände direkt aus der Antwort der API nutzen
      const pointsObj = {};
      if (Array.isArray(roommatesResponse)) {
        roommatesResponse.forEach(score => {
          if (score && score.user_id) {
            pointsObj[score.user_id] = score.points || 0;
          }
        });
      } else {
        console.warn('Unerwartetes Format für roommatesResponse:', roommatesResponse);
      }
      console.log('Berechnete Punktestände:', pointsObj);
      setUserPoints(pointsObj);

      // Sortiere die Aufgaben: Nicht gelöschte zuerst, dann nach Fälligkeitsdatum
      const sortedTasks = tasks.sort((a, b) => {
        // Zuerst nach Status sortieren (erledigte am Ende)
        if (a.status !== b.status) {
          return a.status === 'erledigt' ? 1 : -1;
        }
        
        // Dann nach Fälligkeitsdatum
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      
      setCleaningTasks(sortedTasks);
      // Task-Historie aus den Statistikdaten extrahieren, falls vorhanden
      const historyData = apartmentStats?.userDistribution?.length > 0 
        ? apartmentStats.userDistribution.map(item => ({
            id: Math.random().toString(36).substr(2, 9),
            taskId: item.user_id,
            taskTitle: 'Aufgabe erledigt',
            completedBy: item.name,
            date: new Date().toISOString().split('T')[0]
          }))
        : [];
        
      setTaskHistory(historyData);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      // Detailliertere Fehlerprotokollierung
      if (error.response) {
        console.error('API-Fehler:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Keine Antwort vom Server erhalten:', error.request);
      } else {
        console.error('Fehler beim Einrichten der Anfrage:', error.message);
      }
      // Fallback: Mock-Daten
      setCleaningTasks([
        { 
          id: 1, 
          title: 'Bad putzen', 
          assignedTo: 'Max', 
          dueDate: '2025-05-01', 
          isDone: false, 
          points: 10, 
          repeat: 'weekly',
          color: '#4a90e2',
          history: [
            { date: '2025-04-24', completedBy: 'Anna' },
            { date: '2025-04-17', completedBy: 'Max' }
          ]
        },
        { 
          id: 2, 
          title: 'Küche reinigen', 
          assignedTo: 'Anna', 
          dueDate: '2025-05-03', 
          isDone: true, 
          points: 5, 
          repeat: 'daily',
          color: '#50c878',
          history: [
            { date: '2025-04-28', completedBy: 'Anna' }
          ]
        },
        { 
          id: 3, 
          title: 'Staubsaugen', 
          assignedTo: 'Lisa', 
          dueDate: '2025-05-02', 
          isDone: false, 
          points: 8, 
          repeat: 'none',
          color: '#f5a623',
          archived: false,
          history: []
        },
        { 
          id: 4, 
          title: 'Fenster putzen', 
          assignedTo: 'Max', 
          dueDate: '2025-04-20', 
          isDone: true, 
          points: 15, 
          repeat: 'none',
          color: '#9b59b6',
          archived: true,
          history: [
            { date: '2025-04-20', completedBy: 'Max' }
          ]
        },
      ]);
      
      // Mock-Verlauf
      setTaskHistory([
        { id: 1, taskId: 1, taskTitle: 'Bad putzen', completedBy: 'Anna', date: '2025-04-24' },
        { id: 2, taskId: 1, taskTitle: 'Bad putzen', completedBy: 'Max', date: '2025-04-17' },
        { id: 3, taskId: 2, taskTitle: 'Küche reinigen', completedBy: 'Anna', date: '2025-04-28' },
        { id: 4, taskId: 4, taskTitle: 'Fenster putzen', completedBy: 'Max', date: '2025-04-20' }
      ]);
      
      // Mock-Mitbewohner
      setInvitedRoommates([
        { id: 1, name: 'Max', avatar: '' },
        { id: 2, name: 'Anna', avatar: '' },
        { id: 3, name: 'Lisa', avatar: '' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apartmentId) {
      loadData();
    }
  }, [apartmentId]);
  
  // Daten neu laden, wenn cleaningTasks aktualisiert werden (z.B. nach Hinzufügen/Löschen)
  useEffect(() => {
    // Nur wenn Aufgaben im lokalen State sind und keine davon bereits gelöscht wurde
    if (cleaningTasks.length > 0 && !loading) {
      console.log('CleaningTasks wurden aktualisiert:', cleaningTasks);
    }
  }, [cleaningTasks]);

  // Event-Handler für Wiederholungsintervall
  const handleRepeatChange = (e) => {
    const value = e.target.value;
    setNewTask({...newTask, repeat: value});
    setShowCustomInterval(value === 'custom');
  };
  
  // Hilfsfunktion zur Identifizierung von Templates vs. Instanzen
  const isTaskTemplate = (task) => {
    // Ein Task ist ein Template, wenn er is_recurring = 1 hat oder ein interval_type hat
    return task.is_recurring === 1 || task.interval_type || (task.repeat && task.repeat !== 'none');
  };
  
  // Hilfsfunktion zur Identifizierung einer Task-Instanz
  const isTaskInstance = (task) => {
    // Eine Instanz hat eine task_id, die auf das Template verweist
    return task.task_id && !isTaskTemplate(task);
  };
  
  // Berechne das nächste Fälligkeitsdatum für ein Template basierend auf initial_due_date
  const getNextDueDate = (task) => {
    if (!isTaskTemplate(task) || !task.initial_due_date) return task.due_date;
    
    const initialDate = new Date(task.initial_due_date);
    const today = new Date();
    let nextDate = new Date(initialDate);
    
    // Berechne das nächste Fälligkeitsdatum basierend auf dem Intervall
    const intervalType = task.interval_type || (task.repeat === 'daily' ? 'daily' : 
                         task.repeat === 'weekly' ? 'weekly' : 
                         task.repeat === 'monthly' ? 'monthly' : null);
    
    const intervalValue = task.interval_value || 1;
    
    // Finde das nächste Fälligkeitsdatum in der Zukunft
    while (nextDate < today) {
      if (intervalType === 'daily') {
        nextDate.setDate(nextDate.getDate() + intervalValue);
      } else if (intervalType === 'weekly') {
        nextDate.setDate(nextDate.getDate() + (7 * intervalValue));
      } else if (intervalType === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + intervalValue);
      } else {
        // Wenn kein Intervall definiert ist, verwende einfach das Originaldatum
        break;
      }
    }
    
    return nextDate.toISOString().split('T')[0];
  };
  
  // Bereite die Aufgaben für die Anzeige vor
  const prepareTasksForDisplay = (tasks) => {
    // Gruppiere Aufgaben nach Template (für wiederkehrende) oder direkt (für einmalige)
    const templates = tasks.filter(task => isTaskTemplate(task));
    const instances = tasks.filter(task => isTaskInstance(task));
    
    // Speichere alle aufbereiteten Aufgaben in einem Array
    let preparedTasks = [];
    
    // Für jede Template-Aufgabe, finde alle zugehörigen Instanzen (egal welcher Status)
    templates.forEach(template => {
      // Für jedes Template, finde alle zugeordneten Instanzen
      const relatedInstances = instances.filter(
        instance => instance.task_id === template.id
      ).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      // Wenn Instanzen existieren, zeige diese an (inklusive Status)
      if (relatedInstances.length > 0) {
        // Füge alle Instanzen zum Ergebnis hinzu
        relatedInstances.forEach(instance => {
          // Debug: Zeige Status-Informationen für jede Instanz an
          console.log(`DEBUG STATUS: Instanz ${instance.id} für Template ${template.id}:`, {
            original_status: instance.status,
            isDone_result: instance.status === 'erledigt',
            assignedTo: instance.assignedUserName || template.assignedTo,
            complete_instance: instance
          });
          
          const preparedTask = {
            ...template,
            id: instance.id, // Verwende die ID der Instanz für Aktionen
            taskTemplateId: template.id, // Speichere die Template-ID separat
            dueDate: instance.due_date,
            status: instance.status, // Status der Instanz übernehmen
            isDone: instance.status === 'erledigt', // Explizit als isDone-Flag setzen
            assignedTo: instance.assignedUserName || template.assignedTo,
            archived: template.archived === 1 || template.archived === true, // Archivierungsstatus vom Template übernehmen
            isRecurring: true,
            isTemplate: false, // Ist eine Instanz, kein Template mehr
            hasInstances: true
          };
          
          // Speichere das Original-Template-Archiv-Flag für Debugging-Zwecke
          preparedTask.template_archived = template.archived;
          
          // Zeige die aufbereitete Aufgabe mit dem Status an
          console.log('Aufbereitete Aufgabe:', {
            id: preparedTask.id,
            title: preparedTask.title,
            status: preparedTask.status,
            isDone: preparedTask.isDone,
            archived: preparedTask.archived, // Zeige auch den Archivierungsstatus an
            template_archived: template.archived // Zeige das Original-Template-Archiv-Flag
          });
          
          preparedTasks.push(preparedTask);
        });
      } else {
        // Wenn keine Instanzen existieren, zeige das Template mit berechnetem nächsten Datum
        preparedTasks.push({
          ...template,
          dueDate: getNextDueDate(template),
          isDone: false,
          archived: template.archived === 1 || template.archived === true, // Archivierungsstatus vom Template
          isRecurring: true,
          isTemplate: true,
          hasInstances: false
        });
      }
    });
    
    // Füge einmalige Aufgaben hinzu, die keine Templates sind
    const singleTasks = instances.filter(instance => 
      // Nur Instanzen einschließen, die nicht zu einem der Templates gehören
      !templates.some(t => t.id === instance.task_id)
    ).map(task => ({
      ...task,
      isDone: task.status === 'erledigt',
      dueDate: task.due_date,
      archived: task.archived === 1 || task.archived === true, // Archivierungsstatus
      isRecurring: false,
      isTemplate: false
    }));
    
    return [...preparedTasks, ...singleTasks];
  };
  
  // Aufgabenfilter nach Status
  const getFilteredTasks = () => {
    const prepared = prepareTasksForDisplay(cleaningTasks);
    
    // Korrigiere die Status-Informationen explicit, damit isDone immer konsistent ist
    const fixedTasks = prepared.map(task => {
      // Wenn der Status 'erledigt' ist, stelle sicher, dass auch isDone auf true gesetzt ist
      if (task.status === 'erledigt' && !task.isDone) {
        return { ...task, isDone: true };
      }
      // Wenn umgekehrt isDone true ist, aber der Status nicht 'erledigt', korrigiere auch das
      if (task.isDone && task.status !== 'erledigt') {
        return { ...task, status: 'erledigt' };
      }
      return task;
    });
    
    // Filtere die Aufgaben nach Status
    let filtered = fixedTasks.filter(task => {
      // Stelle sicher, dass wir den Archivierungsstatus korrekt interpretieren
      // Ermittle ob Template oder Instanz archiviert ist
      const isArchived = task.archived === true || task.archived === 1 || task.template_archived === true || task.template_archived === 1;
      
      if (filterStatus === 'all') {
        const result = !isArchived;
        return result;
      }
      if (filterStatus === 'pending') {
        const result = !task.isDone && !isArchived;
        return result;
      }
      if (filterStatus === 'completed') {
        const result = (task.isDone || task.status === 'erledigt') && !isArchived;
        return result;
      }
      if (filterStatus === 'archived') {
        const result = isArchived;
        return result;
      }
      return true;
    });
    
    // Sortierlogik basierend auf dem Filter-Status
    if (filterStatus === 'pending') {
      // Anstehende Aufgaben: Sortiere nach Fälligkeitsdatum (aufsteigend)
      filtered = filtered.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate) : new Date(9999, 11, 31);
        const dateB = b.dueDate ? new Date(b.dueDate) : new Date(9999, 11, 31);
        return dateA - dateB; // Aufsteigend - nächste Fälligkeiten zuerst
      });
    } else if (filterStatus === 'completed') {
      // Erledigte Aufgaben: Sortiere nach Abschlussdatum (absteigend)
      filtered = filtered.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
        const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
        return dateB - dateA; // Absteigend - neueste zuerst
      });
    }
    
    
    return filtered;
  };

  const handleAddTask = async () => {
    // Validierungen durchführen und ggf. Fehlermeldung setzen
    if (!newTask.title || !newTask.assignedTo || !newTask.dueDate) {
      setFormError('Bitte fülle alle Pflichtfelder aus.');
      return false;
    }

    // Prüfen, ob benutzerdefiniertes Intervall vorhanden ist
    if (newTask.repeat === 'custom' && !newTask.customInterval) {
      setFormError('Bitte gib ein benutzerdefiniertes Intervall ein.');
      return;
    }

    // Validiere das Datum
    let formattedDate = '';
    try {
      // Prüfen ob ein valides Datum vorliegt
      const dateObj = new Date(newTask.dueDate);
      if (isNaN(dateObj.getTime())) {
        setFormError('Bitte gib ein gültiges Datum ein.');
        return;
      }
      // Stelle sicher, dass das Datum korrekt formatiert ist
      formattedDate = dateObj.toISOString().split('T')[0];
      console.log('Formatiertes Datum:', formattedDate);
    } catch (error) {
      console.error('Fehler bei der Datumformatierung:', error);
      setFormError('Bitte gib ein gültiges Datum ein.');
      return;
    }

    const finalTask = {
      ...newTask,
      // Stelle sicher, dass das Datum korrekt formatiert ist
      dueDate: formattedDate,
      // Stelle sicher, dass der Punktewert eine Zahl ist
      points: parseInt(newTask.points) || 5,
      // Stelle sicher, dass die Zuweisung als String gespeichert wird
      assignedTo: String(newTask.assignedTo)
    };
    console.log('Aufgabe zum Speichern vorbereitet:', finalTask);
    

    try {
      // Bereite Daten für die neue API vor
      const taskToAdd = {
        title: finalTask.title,
        description: finalTask.notes || '',
        points: parseInt(finalTask.points) || 5,
        isRecurring: finalTask.repeat !== 'none',
        intervalType: finalTask.repeat === 'daily' ? 'daily' : 
                      finalTask.repeat === 'weekly' ? 'weekly' : 
                      finalTask.repeat === 'biweekly' ? 'weekly' : 
                      finalTask.repeat === 'monthly' ? 'monthly' : 'weekly',
        intervalValue: finalTask.repeat === 'biweekly' ? 2 : 1,  
        color: finalTask.color || '#4a90e2',
        assignedUserId: invitedRoommates.find(r => r.name === finalTask.assignedTo)?.id,
        dueDate: finalTask.dueDate
      };
      
      // API-Aufruf zum Erstellen/Aktualisieren der Aufgabe
      setLoading(true);
      
      if (editingTask) {
        console.log('AUFGABE SPEICHERN: Unified mode', {
          task: editingTask,
          newData: taskToAdd
        });
        
        // Vereinheitlichter Aktualisierungsmodus - wir aktualisieren je nach Bedarf Template und/oder Instanz
        const hasTemplateParent = !!editingTask.templateId && editingTask.templateId !== editingTask.id;
        
        // Template-relevante Daten (Titel, Wiederholung, Punkte, Farbe)
        const templateData = {
          title: taskToAdd.title,
          description: taskToAdd.description,
          points: taskToAdd.points,
          isRecurring: taskToAdd.isRecurring,
          intervalType: taskToAdd.intervalType,
          intervalValue: taskToAdd.intervalValue,
          color: taskToAdd.color,
          apartmentId: apartmentId
        };
        
        // Instanz-relevante Daten (Fälligkeit, Zuweisung, Notizen)
        const instanceData = {
          dueDate: taskToAdd.dueDate,
          assignedUserId: taskToAdd.assignedUserId,
          notes: taskToAdd.description,
          apartmentId: apartmentId
        };
        
        // Bei Instanzen mit Template-Parent aktualisieren wir beides
        if (hasTemplateParent) {
          console.log('Aktualisiere sowohl Template als auch Instanz:', {
            templateId: editingTask.templateId,
            instanceId: editingTask.id
          });
          
          // Template aktualisieren (zuerst, da es die Instanz beeinflussen kann)
          await taskService.updateTask(editingTask.templateId, templateData);
          
          // Instanz aktualisieren
          await taskService.updateTaskInstance(editingTask.id, instanceData);
        } 
        // Bei direkten Templates aktualisieren wir nur das Template
        else {
          console.log('Aktualisiere nur das Template:', editingTask.id);
          
          // Template aktualisieren
          await taskService.updateTask(editingTask.id, {
            ...templateData,
            apartmentId: apartmentId // Wichtig: die API erwartet die ID im Objekt
          });
        }
      } else {
        // Neue Aufgabe erstellen - hier bleibt alles wie bisher
        await taskService.createTask(apartmentId, taskToAdd);
      }
      
      // Daten neu laden, um nur Backend-Daten anzuzeigen
      await loadData();
      
      // Bearbeitungsstatus zurücksetzen
      if (editingTask) {
        setEditingTask(null);
      }
      
      // Formular zurücksetzen
      setNewTask({ 
        title: '', 
        assignedTo: '', 
        dueDate: '', 
        points: 5, 
        repeat: 'none',
        customInterval: '',
        color: '#4a90e2',
        notes: ''
      });
      setShowCustomInterval(false);
      
      // Erfolg zurückgeben
      return true;
    } catch (error) {
      console.error('Fehler beim Erstellen/Aktualisieren der Aufgabe:', error);
      setFormError('Fehler beim Speichern der Aufgabe. Bitte versuche es später noch einmal.');
      return false;
    }
  };

  const handleEditTask = (task, editType = null) => {
    console.log('Bearbeite Aufgabe:', task.id);
    
    // Vereinfachter Ansatz: Immer die Instanz- und Template-Informationen laden
    // und in einem vereinheitlichten Formular anzeigen
    let instanceId = task.id;
    let templateId = task.task_id || task.id;
    
    // Für die Unterscheidung, ob wir eine Instanz oder direkt ein Template bearbeiten
    const hasTemplateParent = !!task.task_id;
    
    console.log('Vereinheitlichte Bearbeitung: Instanz-ID:', instanceId, 'Template-ID:', templateId);
    
    // Wir behalten ein Flag, um zu wissen, ob wir ein Template oder Instanz bearbeiten
    // Das hilft uns beim Speichern, die richtigen API-Aufrufe zu machen
    const isDirectlyTemplate = !hasTemplateParent;
    
    // Die zu bearbeitende Aufgabe speichern, mit beiden IDs
    const modifiedTask = {
      ...task,
      id: instanceId,         // Instanz-ID, für Instanz-Updates
      templateId: templateId, // Template-ID, für Template-Updates
      isDirectlyTemplate: isDirectlyTemplate // Flag für spätere Logik
    };
    
    setEditingTask(modifiedTask);
    setNewTask({
      title: task.title,                                                // Immer bearbeitbar, wirkt sich auf Template aus
      assignedTo: task.assignedTo || (task.assignedUser ? task.assignedUser.name : ''),
      assignedToId: task.assignedToId || task.assigned_user_id,
      dueDate: task.dueDate || task.due_date,
      points: task.points || 5,                                        // Immer bearbeitbar, wirkt sich auf Template aus
      repeat: task.repeat || (task.is_recurring ? 'weekly' : 'none'),  // Immer bearbeitbar, wirkt sich auf Template aus
      customInterval: task.customInterval || '',
      color: task.color || '#4a90e2',                                  // Immer bearbeitbar, wirkt sich auf Template aus
      notes: task.notes || '',
      isEditing: true,
      // Wir vereinheitlichen den Bearbeitungsmodus - kein Unterschied mehr zwischen Template und Instanz
      editType: 'unified', 
      isTemplate: false,  // Setzen wir auf false, damit das Formular alle Felder anzeigt
      // Neue Felder zur Identifikation
      instanceId: instanceId,
      templateId: templateId,
      isDirectlyTemplate: isDirectlyTemplate
    });
    
    setShowCustomInterval(task.repeat === 'custom');
    setShowAddForm(true); // Zeige das Formular an, wenn eine Aufgabe bearbeitet wird
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setNewTask({ 
      title: '', 
      assignedTo: '', 
      dueDate: '', 
      points: 5, 
      repeat: 'none',
      customInterval: '',
      color: '#4a90e2',
      notes: ''
    });
    setShowCustomInterval(false);
  };

  // Aufgabe als erledigt markieren mit dem tatsächlichen Benutzer
  const toggleTaskStatus = async (taskIdOrTask) => {
    try {
      console.log('Toggle Task Status für Task:', taskIdOrTask);
      
      if (!currentUser) {
        console.error('Kein Benutzer eingeloggt');
        alert('Bitte logge dich ein, um Aufgaben zu aktualisieren');
        return;
      }
      
      // Globaler Lock für toggleTaskStatus, um parallele Aufrufe zu verhindern
      if (window.isTogglingTask) {
        console.log('Es läuft bereits eine Aufgaben-Aktualisierung. Bitte warten...');
        return;
      }
      window.isTogglingTask = true;
      
      // Überprüfen, ob wir eine ID oder ein Objekt erhalten haben
      let task;
      if (typeof taskIdOrTask === 'object' && taskIdOrTask !== null) {
        // Ein Task-Objekt wurde übergeben
        task = taskIdOrTask;
      } else {
        // Eine ID wurde übergeben, finde die Aufgabe im State
        task = cleaningTasks.find(t => t.id == taskIdOrTask);
        if (!task) {
          console.error('Aufgabe nicht gefunden:', taskIdOrTask);
          window.isTogglingTask = false;
          return;
        }
      }
      
      // Überprüfen, ob bereits ein Menü geöffnet ist, um doppelte Modals zu vermeiden
      if (reassignMenuVisible || showReopenConfirmation) {
        console.log('Es ist bereits ein Dialog geöffnet. Ignoriere den Klick.');
        window.isTogglingTask = false;
        return;
      }
      
      // Neuen Aufgabenstatus setzen (umkehren)
      const updatedTask = { ...task, isDone: !task.isDone };
      // Wenn die Aufgabe als erledigt markiert wird
      if (updatedTask.isDone) {
        console.log('Aufgabe wird als erledigt markiert:', updatedTask.id);
        
        // Prüfen, ob die Aufgabe einem anderen Benutzer zugewiesen ist
        const assignedUserId = task.assignedToId || task.assignedUserId;
        const isAssignedToCurrentUser = assignedUserId === currentUser.id;
        const assignedName = task.assignedTo || getUsernameById(assignedUserId);
        
        // Wenn die Aufgabe einem anderen Benutzer zugewiesen ist, zeige den Dialog an
        if (assignedUserId && !isAssignedToCurrentUser) {
          console.log('Aufgabe ist einem anderen Benutzer zugewiesen:', assignedName);
          
          // Alle aktuellen Dialoge schließen
          setReassignMenuVisible(false);
          setShowReopenConfirmation(false);
          setCompleteForOtherUser(false);
          
          // Warte einen Moment, damit die Modals sich nicht überlappen
          setTimeout(() => {
            // Setze die aktuelle Aufgabe als die zu bearbeitende
            setTaskToCompleteForOther(task);
            // Zeige den Dialog an
            setCompleteForOtherUser(true);
          }, 10);
          
          window.isTogglingTask = false;
          return;
        }
        
        // Prüfen, ob es sich um eine wiederkehrende Aufgabe handelt
        const isRecurring = (
          task.is_recurring === true || 
          task.is_recurring === 1 || 
          task.repeat !== 'none' ||
          task.interval_type || 
          task.intervalType
        );
        
        console.log("Ist wiederkehrend?", isRecurring, task);
        
        // Bei wiederkehrenden Aufgaben das Neuzuweisungsmenü anzeigen
        if (isRecurring) {
          // Vorher alle alten Modals schließen
          setReassignMenuVisible(false);
          setShowReopenConfirmation(false);
          
          // Neuzuweisungsmenü sofort öffnen
          console.log('Öffne Neuzuweisungsmenü für wiederkehrende Aufgabe:', updatedTask.id);
          setTaskToReassign(updatedTask);
          setReassignMenuVisible(true);
          window.isTogglingTask = false;
          
        } else {
          // Bei einmaligen Aufgaben direkt als erledigt markieren
          console.log('Einmalige Aufgabe wird direkt als erledigt markiert');
          
          try {
            const result = await taskService.completeTaskInstance(task.id, apartmentId);
            console.log('Einmalige Aufgabe erfolgreich als erledigt markiert:', result);
            
            // Punktestand aktualisieren, der in der Antwort enthalten ist
            if (result.totalPoints !== undefined && currentUser?.id) {
              setUserPoints({
                ...userPoints,
                [currentUser.id]: result.totalPoints
              });
            }
            
            // Daten neu laden
            await loadData();
            
          } catch (error) {
            console.error('Fehler beim Markieren der Aufgabe als erledigt:', error);
            alert('Fehler: ' + (error.message || 'Aufgabe konnte nicht als erledigt markiert werden.'));
          }
          
          window.isTogglingTask = false;
        }
        
        return; // Wichtig: Hier return, damit der Code nicht weiterläuft
      }
      
      // Nur hier weitermachen, wenn die Aufgabe als nicht erledigt markiert wird
      await updateTaskStatus(updatedTask);
      window.isTogglingTask = false;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Aufgabe:', error);
      window.isTogglingTask = false;
    }
  };
  
  // Hilfsfunktion zum Neuzuweisen und Aktualisieren einer Aufgabe
  const confirmReassign = async (newUserId) => {
    try {
      if (!taskToReassign) {
        console.error('Keine Aufgabe zur Neuzuweisung vorhanden');
        return;
      }
      
      console.log('Neuzuweisung bestätigt mit Benutzer-ID:', newUserId);
      
      // Sicherstellen, dass die newUserId ein String ist oder leere String verwenden
      const safeNewUserId = newUserId ? newUserId.toString() : '';
      console.log('Sichere User-ID für Neuzuweisung:', safeNewUserId);
      
      // Finde den gewählten Benutzer für Logging
      const newAssignee = invitedRoommates.find(r => 
        r.id && safeNewUserId && r.id.toString() === safeNewUserId
      );
      console.log('Neuer Bearbeiter gefunden:', newAssignee ? newAssignee.name : 'Nicht gefunden');
      
      // Bei wiederkehrenden Aufgaben verwenden wir direkt die complete-Funktion mit Neuzuweisung
      if ((taskToReassign.repeat && taskToReassign.repeat !== 'none') || 
          taskToReassign.is_recurring === 1 || 
          taskToReassign.interval_type || 
          taskToReassign.customInterval) { // Mit customInterval ist es immer wiederkehrend
        
        // Debug-Ausgabe für wiederkehrende Aufgaben
        console.log('WIEDERKEHRUNGSPRÜFUNG:', {
          id: taskToReassign.id,
          is_recurring: taskToReassign.is_recurring,
          repeat: taskToReassign.repeat,
          interval_type: taskToReassign.interval_type,
          customInterval: taskToReassign.customInterval,
          erkannt_als: 'wiederkehrend'
        });
        
        try {
          // Direkt die komplette Aufgabe als erledigt markieren und neu zuweisen
          console.log('Markiere wiederkehrende Aufgabe als erledigt mit Neuzuweisung:', taskToReassign.id);
          
          // Bereite die notwendigen Daten vor
          const instanceId = taskToReassign.id;
          const completionData = {
            is_done: true,
            next_assigned_user_id: safeNewUserId // Wichtig: Neue Zuweisung für nächste Instanz
          };
          
          // Ermittle den ursprünglich zugewiesenen Benutzer für correctByUserId
          const assignedUserId = taskToReassign.assignedToId || taskToReassign.assigned_user_id;
          console.log('Verwende ursprünglich zugewiesenen Benutzer als completedBy:', assignedUserId);
          
          // Direkt die API-Funktion aufrufen, ohne updateTaskStatus zu verwenden
          // UND den ursprünglich zugewiesenen Benutzer als completedBy übergeben
          const result = await taskService.completeTaskInstance(instanceId, apartmentId, null, assignedUserId);
          console.log('Aufgabe wurde erfolgreich als erledigt markiert:', result);
          
          if (safeNewUserId) {
            // Aktualisiere die nächste Instanz mit dem neuen Benutzer
            if (result && result.nextTask && result.nextTask.id) {
              console.log('Aktualisiere nächste Instanz:', result.nextTask.id);
              await taskService.updateTaskInstance(result.nextTask.id, {
                apartmentId: apartmentId,
                assigned_user_id: safeNewUserId
              });
            }
          }
          
          // Kleine Pause einfügen, um sicherzustellen, dass die Server-Verarbeitung abgeschlossen ist
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.error('Fehler beim Erledigen und Neuzuweisen:', e);
        }
      } else {
        // Bei einmaligen Aufgaben nur als erledigt markieren
        console.log('Markiere einmalige Aufgabe als erledigt');
        try {
          // Ermittle den ursprünglich zugewiesenen Benutzer für completedByUserId
          const assignedUserId = taskToReassign.assignedToId || taskToReassign.assigned_user_id;
          console.log('Verwende ursprünglich zugewiesenen Benutzer als completedBy bei einmaliger Aufgabe:', assignedUserId);
          
          // UND den ursprünglich zugewiesenen Benutzer als completedBy übergeben
          await taskService.completeTaskInstance(taskToReassign.id, apartmentId, null, assignedUserId);
        } catch (e) {
          console.error('Fehler beim Erledigen der einmaligen Aufgabe:', e);
        }
      }
      
      // Aktualisiere die Aufgabenliste mit der korrekten Funktion
      console.log('Lade Daten neu nach Neuzuweisung');
      await loadData();
      
      // Schließe das Neuzuweisungsmenü
      setReassignMenuVisible(false);
      setTaskToReassign(null);
      
    } catch (error) {
      console.error('Fehler bei der Neuzuweisung:', error);
      // Zeige Fehlermeldung an
      alert('Bei der Neuzuweisung ist ein Fehler aufgetreten: ' + error.message);
    }
  };
  
  // Ohne Neuzuweisung fortfahren
  const continueWithoutReassign = async () => {
    try {
      if (!taskToReassign) return;
      
      console.log('Schließe Aufgabe ohne Neuzuweisung:', taskToReassign.id);
      
      // Aktuelle Aufgabe einfach als erledigt markieren, ohne neue zu erstellen
      // und dabei den ursprünglich zugewiesenen Benutzer als Bearbeiter eintragen
      try {
        // Ermittle den zugewiesenen Benutzer aus der Aufgabe
        const assignedUserId = taskToReassign.assignedToId || taskToReassign.assigned_user_id;
        
        console.log('Markiere Aufgabe als erledigt für ursprünglich zugewiesenen Benutzer:', assignedUserId);
        
        // Verwende den ursprünglich zugewiesenen Benutzer als completedBy
        await taskService.completeTaskInstance(taskToReassign.id, apartmentId, null, assignedUserId);
        console.log('Aufgabe erfolgreich als erledigt markiert durch ursprünglichen Benutzer');
      } catch (e) {
        console.error('Fehler beim Markieren als erledigt:', e);
      }
      
      // Schließe das Neuzuweisungsmenü
      setReassignMenuVisible(false);
      setTaskToReassign(null);
      setSelectedReassignUserId('');
      
      // Aktualisiere die Aufgabenliste mit der korrekten Funktion
      await loadData();
    } catch (error) {
      console.error('Fehler beim Abschließen der Aufgabe:', error);
    }
  };
  
  // Bestätigungsdialog für das Wiederherstellen einer erledigten Aufgabe zeigen
  const [taskToReopen, setTaskToReopen] = useState(null);
  const [showReopenConfirmation, setShowReopenConfirmation] = useState(false);
  
  // Aufgabenstatus aktualisieren (erledigt/nicht erledigt)
  const updateTaskStatus = async (task) => {
    // Prüfen, ob die Aufgabe eine Instanz oder ein Template ist
    const isTaskInstance = task.task_id !== undefined;
    const instanceId = isTaskInstance ? task.id : null;
    
    // Archivierte Aufgaben können nicht aktualisiert werden
    if (task.archived) {
      console.log('Archivierte Aufgabe kann nicht aktualisiert werden:', task.id);
      return;
    }
    
    console.log('updateTaskStatus aufgerufen mit:', {
      id: task.id,
      isTaskInstance,
      status: task.status,
      isDone: task.isDone,
      markingAsComplete: !(task.status === 'erledigt' || task.isDone)
    });
    
    // Wenn bereits erledigte Aufgabe wiederhergestellt werden soll, Bestätigungsdialog zeigen
    if (isTaskInstance && (task.status === 'erledigt' || task.isDone)) {
      setTaskToReopen(task);
      setShowReopenConfirmation(true);
      return;
    }
    
    try {
      // Wenn eine Aufgabeninstanz als erledigt markiert werden soll
      if (isTaskInstance && !(task.status === 'erledigt' || task.isDone)) {
        // Prüfen, ob es sich um eine wiederkehrende Aufgabe handelt
        const isRecurring = (
          task.is_recurring === true || 
          task.is_recurring === 1 || 
          task.repeat !== 'none' ||
          task.interval_type || 
          task.intervalType
        );
        
        console.log("Ist wiederkehrend?", isRecurring, task);

        // Prüfen, ob die Aufgabe einem anderen Benutzer zugewiesen ist
        const assignedUserId = task.assignedToId || task.assigned_user_id;
        const isAssignedToCurrentUser = assignedUserId && assignedUserId.toString() === currentUser?.id?.toString();

        // Wenn die Aufgabe einem anderen Benutzer zugewiesen ist, Bestätigungsdialog anzeigen
        if (assignedUserId && !isAssignedToCurrentUser) {
          console.log('Aufgabe ist einem anderen Benutzer zugewiesen:', task.assignedTo || task.assignedToName);
          setCurrentTaskAction({
            type: 'completeForOther',
            task: task,
            onConfirm: async () => {
              try {
                // Nach Bestätigung die wiederkehrende Aufgabe erledigen und ggf. neu zuweisen
                if (isRecurring) {
                  console.log('Zeige Neuzuweisungsmenü für wiederkehrende Aufgabe:', task.id);
                  setTaskToReassign(task);
                  setReassignMenuVisible(true);
                  // Dialog schließen
                  setCurrentTaskAction(null);
                  return;
                } else {
                  // Einmalige Aufgabe eines anderen Benutzers direkt als erledigt markieren
                  // Wir geben den original zugewiesenen Benutzer als completedBy an
                  await taskService.completeTaskInstance(instanceId, apartmentId, null, task.assignedToId);
                  // Daten neu laden
                  await loadData();
                  // Dialog schließen
                  setCurrentTaskAction(null);
                }
              } catch (error) {
                console.error('Fehler beim Erledigen der fremden Aufgabe:', error);
                alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
                setCurrentTaskAction(null);
              }
            }
          });
          return;
        }
        
        // Bei wiederkehrenden Aufgaben (die dem aktuellen Benutzer zugewiesen sind oder keinem) direkt den Neuzuweisungsdialog anzeigen
        if (isRecurring) {
          console.log('Zeige Neuzuweisungsmenü für wiederkehrende Aufgabe:', task.id);
          setTaskToReassign(task);
          setReassignMenuVisible(true);
          return; // Dialog anzeigen und auf Benutzerentscheidung warten
        }
        
        // Bei nicht wiederkehrenden Aufgaben direkt als erledigt markieren
        console.log('Markiere einmalige Aufgabe direkt als erledigt:', task.id);
        const result = await taskService.completeTaskInstance(instanceId, apartmentId);
        
        console.log('Aufgabe als erledigt markiert:', result);
        
        // Punktestand aktualisieren, der in der Antwort enthalten ist
        if (result.totalPoints !== undefined && currentUser?.id) {
          setUserPoints({
            ...userPoints,
            [currentUser.id]: result.totalPoints
          });
        }
      } 
      // Wenn Zuweisungen oder andere Änderungen gemacht werden sollen
      else if (isTaskInstance) {
        // Wenn ein neuer Zuweisender angegeben ist, diesen verwenden
        const assignedUserId = task.assignedToId || task.assigned_user_id;
        
        // Aktualisiere die Aufgabeninstanz
        const updatedData = {
          assigned_user_id: assignedUserId,
          notes: task.notes || ''
        };
        
        await taskService.updateTaskInstance(instanceId, updatedData);
      }
      // Bei Aufgabenvorlagen andere API-Methode verwenden
      else {
        const updatedData = {
          title: task.title,
          description: task.description || '',
          points: task.points || 5,
          isRecurring: task.is_recurring || false,
          intervalType: task.interval_type || 'weekly',
          intervalValue: task.interval_value || 1,
          color: task.color || '#4a90e2'
        };
        
        await taskService.updateTask(task.id, updatedData);
      }
      
      // Daten neu laden, um den aktuellen Status aller Aufgaben zu erhalten
      await loadData();
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Aufgabe:', error);
      throw error;
    }  
  };

  // Aufgabe übernehmen
  const takeOverTask = async (taskId) => {
    try {
      if (!currentUser) {
        console.error('Kein Benutzer eingeloggt');
        alert('Bitte logge dich ein, um Aufgaben zu übernehmen');
        return;
      }
      
      // Finde die Aufgabe, um den Titel für die Benachrichtigung zu erhalten
      const task = cleaningTasks.find(task => task.id === taskId);
      if (!task) return;
      
      // Prüfe, ob die Aufgabe bereits dem aktuellen Benutzer zugewiesen ist
      if (task.assignedToId === currentUser.id.toString()) {
        console.log('Diese Aufgabe ist bereits dir zugewiesen');
        return;
      }
      
      // Zeige Bestätigungsdialog an
      setCurrentTaskAction({
        type: 'takeover',
        task: task,
        onConfirm: async () => {
          try {
            // Setze Loading-Status
            setLoading(true);
            
            // Ermittle die Apartment-ID (wichtig für API-Call)
            const apartmentId = selectedApartment?.id;
            if (!apartmentId) {
              throw new Error('Keine Apartment-ID verfügbar');
            }
            
            console.log(`Aufgabe ${taskId} wird dem Benutzer ${currentUser.id} zugewiesen in Apartment ${apartmentId}`);
            
            // Backend-Aufruf zur Zuweisung der Aufgabe mit Apartment-ID
            await taskService.updateTaskInstance(taskId, {
              assigned_user_id: currentUser.id
            }, apartmentId);
            
            // Daten neu laden, um die aktualisierten Werte vom Backend zu erhalten
            await loadData();
            
            // Schließe den Dialog
            setCurrentTaskAction(null);
          } catch (error) {
            console.error('Fehler beim Übernehmen der Aufgabe:', error);
            alert(`Fehler beim Übernehmen der Aufgabe: ${error.message || 'Unbekannter Fehler'}`);
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error('Fehler beim Vorbereiten der Aufgabenübernahme:', error);
    }
  };

  // Hilfsfunktion zur Berechnung des nächsten gültigen Fälligkeitsdatums
  const calculateNextDueDate = (task) => {
    // Aktuelles Datum als Ausgangspunkt
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Intervalltyp und -wert ermitteln
    let intervalType = task.interval_type || 
                      (task.repeat === 'daily' ? 'daily' : 
                       task.repeat === 'weekly' ? 'weekly' : 
                       task.repeat === 'biweekly' ? 'weekly' : 
                       task.repeat === 'monthly' ? 'monthly' : 'weekly');
    
    let intervalValue = task.interval_value || 
                       (task.repeat === 'biweekly' ? 2 : 1);
    
    let nextDueDate;
    
    // Original Datum nur für den Wochentag oder Monatstag verwenden
    let originalDueDate;
    if (task.dueDate) {
      originalDueDate = new Date(task.dueDate);
    } else if (task.due_date) {
      originalDueDate = new Date(task.due_date);
    } else {
      originalDueDate = new Date(today);
    }
    
    const originalDay = originalDueDate.getDay(); // Wochentag: 0 = Sonntag, 1 = Montag, usw.
    const originalDate = originalDueDate.getDate(); // Tag im Monat
    
    // Je nach Intervalltyp das nächste Datum berechnen - immer vom HEUTIGEN TAG ausgehend
    if (intervalType === 'daily') {
      // Bei täglichen Aufgaben einfach morgen
      nextDueDate = new Date(today);
      nextDueDate.setDate(today.getDate() + intervalValue);
    } 
    else if (intervalType === 'weekly') {
      // Bei wöchentlichen Aufgaben den gleichen Wochentag in der nächsten Woche finden
      nextDueDate = new Date(today);
      
      // Nächstes Vorkommen dieses Wochentags finden
      const currentDay = today.getDay();
      let daysUntilTargetDay = originalDay - currentDay;
      
      // Wenn der Zieltag in der Vergangenheit liegt oder heute ist, in die nächste Woche gehen
      if (daysUntilTargetDay <= 0) {
        daysUntilTargetDay += 7;
      }
      
      nextDueDate.setDate(today.getDate() + daysUntilTargetDay);
      
      // Bei mehrwöchigen Intervallen (z.B. 2 Wochen) nicht weiter anpassen, 
      // da wir bereits vom heutigen Tag ausgehen und direkt den nächsten passenden Wochentag wählen
    }
    else if (intervalType === 'monthly') {
      // Bei monatlichen Aufgaben den gleichen Tag im aktuellen oder nächsten Monat finden
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const currentDate = today.getDate();
      
      // Nächsten passenden Monatstag finden
      if (currentDate < originalDate) {
        // Der Zieltag liegt später im aktuellen Monat
        // Prüfen, ob der Tag im aktuellen Monat existiert
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const targetDate = Math.min(originalDate, daysInCurrentMonth);
        nextDueDate = new Date(currentYear, currentMonth, targetDate);
      } else {
        // Der Zieltag liegt im nächsten Monat
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        
        // Prüfen, ob der Tag im nächsten Monat existiert
        const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const targetDate = Math.min(originalDate, daysInNextMonth);
        nextDueDate = new Date(nextYear, nextMonth, targetDate);
      }
    }
    else {
      // Standard: Morgen als Datum setzen
      nextDueDate = new Date(today);
      nextDueDate.setDate(today.getDate() + 1);
    }
    
    // Formatiere das Datum als YYYY-MM-DD String
    const formattedDate = nextDueDate.toISOString().split('T')[0];
    console.log(`Nächstes berechnetes Fälligkeitsdatum: ${formattedDate} (basierend auf Intervall ${intervalType}, Wert ${intervalValue})`);
    
    return formattedDate;
  };

  // Aufgabe archivieren/wiederherstellen
  const toggleArchiveStatus = async (taskId) => {
    try {
      // Setze Loading-Status
      setLoading(true);
      
      // Finde die aktuelle Aufgabe
      const task = cleaningTasks.find(task => task.id === taskId);
      if (!task) return;
      
      // Ermittle die Apartment-ID (wichtig für API-Call)
      const apartmentId = selectedApartment?.id;
      if (!apartmentId) {
        throw new Error('Keine Apartment-ID verfügbar');
      }
      
      // Archivierungsstatus umkehren
      const newArchivedStatus = !task.archived;
      
      // Ermittle das Template, zu dem diese Aufgabe gehört
      // Entweder direkt die task_id (wenn es eine Instanz ist) oder die eigene ID (wenn es ein Template ist)
      const templateId = task.task_id || task.id;
      
      console.log(`Aufgabe ${taskId} (Template-ID: ${templateId}) wird ${newArchivedStatus ? 'archiviert' : 'wiederhergestellt'} in Apartment ${apartmentId}`);
      console.log('Aktueller Status der Aufgabe:', task);
      
      // Wir nutzen die neue Template-basierte Archivierungsfunktion
      // Diese archiviert das Template UND alle seine Instanzen auf einmal
      await taskService.archiveTaskTemplate(templateId, apartmentId, newArchivedStatus);
      
      // Wenn die Aufgabe aus dem Archiv geholt wird und wiederkehrend ist, prüfen wir,
      // ob das Datum in der Vergangenheit liegt und aktualisieren es bei Bedarf
      if (!newArchivedStatus) { // Beim Wiederherstellen
        // Prüfe, ob wiederkehrend
        const isRecurring = task.is_recurring === true || task.is_recurring === 1 || task.repeat !== 'none';
        
        if (isRecurring) {
          const dateValue = task.dueDate || task.due_date;
          if (dateValue) {
            try {
              // Prüfe, ob das Datum in der Vergangenheit liegt
              const dueDate = new Date(dateValue);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              if (dueDate < today) {
                // Datum ist in der Vergangenheit, berechne neues Datum
                console.log(`Aufgabe hat überfälliges Datum: ${dateValue}, berechne neues Datum...`);
                
                // Finde die neueste Instanz dieser Aufgabenvorlage
                const instances = cleaningTasks.filter(t => 
                  (t.task_id === templateId || t.id === templateId) && !t.isDone);
                
                if (instances.length > 0) {
                  // Berechne das nächste Fälligkeitsdatum
                  const nextDueDate = calculateNextDueDate(task);
                  
                  console.log(`Aktualisiere Datum von ${dateValue} auf ${nextDueDate}`);
                  
                  // Finde die ID der zu aktualisierenden Instanz
                  const instanceToUpdate = instances[0];
                  
                  // Aktualisiere das Datum dieser Instanz
                  await taskService.updateTaskInstance(instanceToUpdate.id, {
                    apartmentId: apartmentId,
                    dueDate: nextDueDate
                  });
                  
                  console.log(`Datum für Instanz ${instanceToUpdate.id} aktualisiert`);
                }
              }
            } catch (e) {
              console.error('Fehler bei der Datumsprüfung oder -aktualisierung:', e);
            }
          }
        }
      }
      
      // Daten neu laden, um die aktualisierten Werte vom Backend zu erhalten
      await loadData();
      
    } catch (error) {
      console.error('Fehler beim Archivieren/Wiederherstellen der Aufgabe:', error);
      alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  };

  // Funktion zum Übernehmen einer Aufgabe
  const takeoverTask = async (taskId) => {
    try {
      console.log('takeoverTask aufgerufen für ID:', taskId);
      // Finde die Aufgabe zum Übernehmen
      const task = cleaningTasks.find(task => task.id === taskId);
      if (!task) {
        console.error('Aufgabe nicht gefunden für ID:', taskId);
        return;
      }
      
      console.log('Gefundene Aufgabe zum Übernehmen:', task);
      
      // Bestätigungsdialog anzeigen
      setCurrentTaskAction({
        type: 'takeover',
        task: task,
        onConfirm: async () => {
          try {
            // Setze Loading-Status
            setLoading(true);
            
            // Ermittle die Apartment-ID (für API-Call)
            const apartmentId = selectedApartment?.id;
            if (!apartmentId) {
              throw new Error('Keine Apartment-ID verfügbar');
            }
            
            // Aktualisiere die Aufgabe mit dem neuen Benutzer
            await taskService.updateTaskInstance(task.id, {
              apartmentId: apartmentId,
              assignedUserId: currentUser.id,  // Der aktuelle Benutzer übernimmt die Aufgabe
              assignedToId: currentUser.id     // Aktualisiere auch assignedToId für Konsistenz
            });
            
            // Daten neu laden
            await loadData();
            
            // Dialog schließen
            setCurrentTaskAction(null);
          } catch (error) {
            console.error('Fehler beim Übernehmen der Aufgabe:', error);
            alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error('Fehler beim Vorbereiten der Übernahme:', error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      // Finde die Aufgabe zum Löschen
      const task = cleaningTasks.find(task => task.id === taskId);
      if (!task) return;
      
      // Bestätigungsdialog anzeigen
      setCurrentTaskAction({
        type: 'delete',
        task: task,
        onConfirm: async () => {
          try {
            // Setze Loading-Status
            setLoading(true);
            
            // Bestimme, ob es sich um eine Template oder eine Instanz handelt
            const isTemplate = task.isTemplate;
            
            // Ermittle die Apartment-ID (für API-Call)
            const apartmentId = selectedApartment?.id;
            if (!apartmentId) {
              throw new Error('Keine Apartment-ID verfügbar');
            }
            
            let response;
            
            if (isTemplate) {
              response = await taskService.deleteTask(taskId, apartmentId);
            } else {
              response = await taskService.deleteTaskInstance(taskId, apartmentId);
              
              // Wenn Punkte abgezogen wurden, zeige Feedback an und aktualisiere Punkte im UI
              if (response.wasCompleted && response.pointsRemoved > 0 && response.completedByUserId) {
                // Alert-Nachricht anzeigen
                alert(`${response.pointsRemoved} Punkte wurden abgezogen, da eine erledigte Aufgabe gelöscht wurde.`);
                
                // Aktualisiere die Punkte im State, genau wie in confirmReopenTask
                if (response.newTotalPoints !== null) {
                  setUserPoints({
                    ...userPoints,
                    [response.completedByUserId]: response.newTotalPoints
                  });
                }
              }
            }
            
            // Daten neu laden, um den aktuellen Status aller Aufgaben zu erhalten
            await loadData();
            
            // Dialog schließen
            setCurrentTaskAction(null);
          } catch (error) {
            console.error('Fehler beim Löschen der Aufgabe:', error);
            alert(`Fehler beim Löschen der Aufgabe: ${error.message || 'Unbekannter Fehler'}`);
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error('Fehler beim Vorbereiten des Löschvorgangs:', error);
    }
  };

  // State für die Kalender-Ansicht (Woche oder Monat)
  const [calendarViewType, setCalendarViewType] = useState('month');
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  
  // Responsiv: Prüfe Bildschirmgröße und setze entsprechende Ansicht (Woche für Mobile, Monat für Desktop)
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setCalendarViewType('week');
      } else {
        setCalendarViewType('month');
      }
    };
    
    // Initial und bei Größenänderung prüfen
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);
  
  // Hilfsfunktionen für den Kalender
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Anpassung für Montag als erster Tag der Woche (statt Sonntag)
  const getFirstDayOfMonth = (year, month) => {
    // Original: 0=Sonntag, 1=Montag, ..., 6=Samstag
    const firstDay = new Date(year, month, 1).getDay();
    // Umrechnung auf Montag=0, Dienstag=1, ..., Sonntag=6
    return firstDay === 0 ? 6 : firstDay - 1;
  };
  
  // Berechnet den Anfang der aktuellen Woche (Montag)
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Korrektur für Sonntag
    return new Date(d.setDate(diff));
  }

  // Prüft, ob eine Aufgabe für ein bestimmtes Datum gilt
  const isTaskForDate = (task, date) => {
    try {
      // Wenn es eine archivierte Aufgabe ist, ignorieren
      if (task.archived) return false;
      
      // Versuche, das Datum der Aufgabe zu erhalten
      let taskDate;
      if (task.dueDate) {
        taskDate = new Date(task.dueDate);
      } else if (task.due_date) {
        taskDate = new Date(task.due_date);
      } else {
        // Kein Datum vorhanden
        return false;
      }
      
      // Prüfe, ob das Datum gültig ist
      if (isNaN(taskDate.getTime())) return false;
      
      // Direkter Datumsvergleich für nicht-wiederkehrende Aufgaben
      const dateMatch = (
        taskDate.getFullYear() === date.getFullYear() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getDate() === date.getDate()
      );
      
      // Für nicht-wiederholende Aufgaben prüfen wir nur das direkte Datum
      if (!task.repeat || task.repeat === 'none') {
        if (!task.is_recurring && !task.interval_type) {
          if (dateMatch) {
            // Status im Cache speichern/aktualisieren
            updateTaskStatusCache(task);
            return true;
          }
          return false;
        }
      }
      
      // Für wiederkehrende Aufgaben
      let isRelevant = false;
      
      // Aus den normalen repeat-Werten
      if (task.repeat === 'daily') {
        isRelevant = true;
      } else if (task.repeat === 'weekly') {
        isRelevant = taskDate.getDay() === date.getDay();
      } else if (task.repeat === 'biweekly') {
        const diffTime = Math.abs(date - taskDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isRelevant = taskDate.getDay() === date.getDay() && diffDays % 14 === 0;
      } else if (task.repeat === 'monthly') {
        isRelevant = taskDate.getDate() === date.getDate();
      }
      
      // Aus den DB-Werten
      if (task.interval_type) {
        if (task.interval_type === 'daily') {
          isRelevant = true;
        } else if (task.interval_type === 'weekly') {
          // Bei wöchentlicher Wiederholung den Wochentag vergleichen
          const intervalValue = task.interval_value || 1;
          if (intervalValue === 1) {
            isRelevant = taskDate.getDay() === date.getDay();
          } else if (intervalValue === 2) { // Zweiwochenrhythmus
            const diffTime = Math.abs(date - taskDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isRelevant = taskDate.getDay() === date.getDay() && diffDays % 14 === 0;
          }
        } else if (task.interval_type === 'monthly') {
          isRelevant = taskDate.getDate() === date.getDate();
        }
      }
      
      // Bei benutzerdefinierten Intervallen
      if (task.repeat === 'custom' && task.customInterval) {
        const intervalStr = String(task.customInterval);
        
        // Beispiel: "1,15" für 1. und 15. des Monats
        if (intervalStr.includes(',')) {
          const days = intervalStr.split(',').map(d => parseInt(d.trim()));
          isRelevant = days.includes(date.getDate());
        }
        
        // Beispiel: "3d" für alle 3 Tage
        if (intervalStr.endsWith('d')) {
          const days = parseInt(intervalStr);
          if (!isNaN(days)) {
            const diffTime = Math.abs(date - taskDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isRelevant = diffDays % days === 0;
          }
        }
      }
      
      // Wenn die Aufgabe an diesem Tag relevant ist, Status-Cache aktualisieren
      if (isRelevant || dateMatch) {
        updateTaskStatusCache(task);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('Fehler in isTaskForDate:', e, task);
      return false;
    }
  };
  
  // Hilfsfunktion zum Aktualisieren des Task-Status-Caches
  const updateTaskStatusCache = (task) => {
    // Task-Status-Cache initialisieren falls noch nicht vorhanden
    if (!window.taskStatusCache) {
      window.taskStatusCache = {};
    }
    
    // Status im Cache speichern/aktualisieren
    const isDone = task.isDone || task.status === 'erledigt';
    window.taskStatusCache[task.id] = {
      isDone: isDone,
      status: isDone ? 'erledigt' : 'offen'
    };
    
    // Für Anzeige in der Kalenderansicht den Status setzen
    task.isDone = isDone;
    task.status = isDone ? 'erledigt' : 'offen';
  };

  const renderCalendarDays = () => {
    if (calendarViewType === 'week') {
      return renderWeekView();
    } else {
      return renderMonthView();
    }
  };
  
  // Rendert die Wochenansicht als kompakte vertikale Liste (ein Tag pro Zeile)
  const renderWeekView = () => {
    const days = [];
    const weekStart = new Date(currentWeekStart);
    const isMobile = window.innerWidth < 768;
    
    // Wochenansicht: Überschrift für Wochentage (Mo, Di, Mi, ...)
    const weekdayHeader = (
      <div className="weekday-header" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        marginBottom: '10px',
        textAlign: 'center',
        fontWeight: 'normal',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem'
      }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>
    );
    
    // Rendere 7 Tage der aktuellen Woche 
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      
      // Finde Aufgaben für diesen Tag
      const tasksForDay = cleaningTasks.filter(task => 
        !task.archived && isTaskForDate(task, currentDate)
      );
      
      // Prüfe, ob der aktuelle Tag heute ist
      const isToday = new Date().toDateString() === currentDate.toDateString();
      const dayName = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1];
      const dayOfMonth = currentDate.getDate();
      const month = currentDate.toLocaleDateString('de-DE', { month: 'short' });
      
      days.push(
        <div key={i} className={`week-day-item ${isToday ? 'today' : ''}`} style={{
          borderBottom: '1px solid var(--border-color)',
          padding: '15px 0',
          marginBottom: '0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '10px'
          }}>
            {/* Tagesnummer mit Wochentag (links) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '40px',
            }}>
              <span style={{
                fontWeight: 'bold',
                fontSize: '1.2rem',
                color: isToday ? 'white' : 'var(--primary)',
                backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>{dayOfMonth}</span>
              <span style={{
                fontSize: '0.9rem',
                color: 'var(--text)',
                marginTop: '2px'
              }}>{dayName}</span>
            </div>
            
            {/* Monat und Aufgabenzähler */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '2px'
              }}>{month}</span>
              
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
              }}>
                {tasksForDay.length} Aufgaben
              </span>
            </div>
          </div>
          
          {/* Aufgabenliste */}
          {tasksForDay.length > 0 ? (
            <div className="day-tasks-list" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '60vh',
              overflowY: 'auto',
              padding: '0 3px'
            }}>
              {tasksForDay.map((task, taskIndex) => (
                <div 
                  key={`${i}-${task.id}`} 
                  className={`day-task-row ${task.isDone ? 'done' : ''}`} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: task.color ? `${task.color}15` : undefined,
                    borderLeft: `3px solid ${task.color || '#4a90e2'}`
                  }}
                >
                  <div 
                    className="calendar-task-checkbox" 
                    onClick={() => toggleTaskStatus(task.id)}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: `2px solid ${task.color || '#4a90e2'}`,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: '10px',
                      backgroundColor: task.isDone ? task.color || '#4a90e2' : 'transparent',
                      transition: 'background-color 0.2s ease, transform 0.1s ease',
                      cursor: 'pointer'
                    }}
                  >
                    {task.isDone && <FiCheck size={10} style={{color: 'white'}} />}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '500',
                      marginBottom: '2px',
                      textDecoration: task.isDone ? 'line-through' : 'none',
                      opacity: task.isDone ? 0.7 : 1
                    }}>
                      {task.title}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <span>{task.assignedTo}</span>
                      {task.repeat !== 'none' && (
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <FiRepeat size={10} style={{ marginRight: '2px' }} />
                          {task.repeat === 'custom' 
                            ? formatCustomInterval(task.customInterval)
                            : repeatOptions.find(opt => opt.value === task.repeat)?.label}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <FiAward size={10} style={{ marginRight: '2px' }} />
                        {task.points || 5}
                      </span>
                    </div>
                  </div>
                  
                  {currentUser && task.assignedToId !== currentUser.id.toString() && (
                    <button 
                      className="task-takeover-small"
                      onClick={() => takeOverTask(task.id)}
                      title="Diese Aufgabe übernehmen"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.7rem',
                        padding: '2px 5px',
                        cursor: 'pointer',
                        borderRadius: '3px',
                        opacity: 0.8,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <FiUserCheck size={12} style={{ marginRight: '2px' }} /> Übernehmen
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              padding: '8px 0', 
              color: 'var(--text-secondary)', 
              fontSize: '0.9rem', 
              fontStyle: 'italic' 
            }}>
              Keine Aufgaben
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="week-list" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: '100%',
        padding: '0 10px'
      }}>
        {days}
      </div>
    );
  };
  
  // Rendert die Monatsansicht mit responsivem Design
  const renderMonthView = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const isMobile = window.innerWidth < 768;
    
    const days = [];
    
    // Fülle die ersten Tage mit leeren Zellen
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Füge die Tage des Monats hinzu
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      
      // Prüfe, ob dies der heutige Tag ist
      const today = new Date();
      const isToday = 
        today.getDate() === i && 
        today.getMonth() === month && 
        today.getFullYear() === year;
      
      // Finde Aufgaben für diesen Tag (inklusive wiederholende Aufgaben)
      const tasksForDay = cleaningTasks.filter(task => 
        !task.archived && isTaskForDate(task, currentDate)
      );
      
      days.push(
        <div key={i} className={`calendar-day ${tasksForDay.length > 0 ? 'has-tasks' : ''} ${isToday ? 'today' : ''}`}>
        {/* Spezielles Styling für den heutigen Tag */}
        {isToday && <div className='today-indicator' style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          borderRadius: '5px',
          border: '2px solid var(--primary)',
          opacity: '0.7',
          pointerEvents: 'none'
        }}></div>}
          <div className="day-number" style={{
            fontWeight: isToday ? 'bold' : 'normal',
            color: isToday ? 'var(--primary)' : 'inherit',
            position: 'relative'
          }}>
            {i}
          </div>
          {tasksForDay.length > 0 && (
            <div className="day-tasks">
              {tasksForDay.map(task => (
                <div 
                  key={`${i}-${task.id}`} 
                  className={`day-task ${task.isDone ? 'done' : ''}`} 
                  title={`${task.title} (${task.assignedTo})`}
                  style={{
                    backgroundColor: task.color ? `${task.color}25` : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    padding: isMobile ? '2px' : '3px 5px',
                    borderRadius: '4px',
                    marginBottom: '1px'
                  }}
                >
                  {/* Task-Markierung im Monthly Overview (nicht abhakbar - nur Planungsansicht) */}
                  <div 
                    className="calendar-task-status" 
                    style={{
                      width: isMobile ? '12px' : '14px',
                      height: isMobile ? '12px' : '14px',
                      borderRadius: '50%',
                      backgroundColor: task.color || '#4a90e2',
                      marginRight: '6px',
                      opacity: 0.8
                    }}
                  />
                  
                  {!isMobile && (
                    <span 
                      className="task-name" 
                      style={{
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '80px',
                      }}
                    >
                      {task.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return days;
  };

  const changeTimeFrame = (increment) => {
    if (calendarViewType === 'week') {
      // Bei Wochenansicht: Woche weiter/zurück
      const newWeek = new Date(currentWeekStart);
      newWeek.setDate(newWeek.getDate() + (increment * 7));
      setCurrentWeekStart(newWeek);
    } else {
      // Bei Monatsansicht: Monat weiter/zurück
      const newMonth = new Date(currentMonth);
      newMonth.setMonth(newMonth.getMonth() + increment);
      setCurrentMonth(newMonth);
    }
  };
  
  // Aufgabenverlauf für eine bestimmte Aufgabe anzeigen
  const renderTaskHistory = (task) => {
    if (!task.history || task.history.length === 0) {
      return <div className="task-history-empty">Keine Verlaufseinträge vorhanden</div>;
    }
    
    return (
      <div className="task-history">
        {task.history.map((entry, index) => {
          // Stelle sicher, dass completedBy ein String ist und nicht ein Objekt
          let completedByName = '';
          
          if (typeof entry.completedBy === 'object' && entry.completedBy !== null) {
            // Wenn es ein Objekt ist, extrahiere den Namen
            completedByName = entry.completedBy.name || 'Unbekannter Benutzer';
          } else {
            // Sonst verwende den Wert direkt als String
            completedByName = String(entry.completedBy || '');
          }
          
          return (
            <div key={index} className="task-history-entry">
              <div className="task-history-date">{new Date(entry.date).toLocaleDateString()}</div>
              <div className="task-history-user">{completedByName}</div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Formatiert ein benutzerdefiniertes Intervall für die Anzeige
  const formatCustomInterval = (interval) => {
    if (!interval) return 'Undefiniert';
    
    // Stelle sicher, dass interval ein String ist
    const intervalStr = String(interval).trim();
    
    // Kommagetrennte Werte = bestimmte Tage des Monats
    if (intervalStr.includes(',')) {
      const daysArray = intervalStr.split(',').map(day => day.trim()).filter(Boolean);
      if (daysArray.length > 0) {
        return `Am ${daysArray.join('. und am ')}. des Monats`;
      }
      return 'Undefiniert';
    }
    
    // Alle X Tage (Format: Zahl + d)
    if (/^\d+d$/.test(intervalStr)) {
      const days = parseInt(intervalStr);
      if (days === 1) return 'Täglich';
      if (days === 7) return 'Wöchentlich';
      if (days === 14) return 'Alle 2 Wochen';
      if (days === 30 || days === 31) return 'Monatlich';
      return `Alle ${days} Tage`;
    }
    
    // Alle X Wochen (Format: Zahl + w)
    if (/^\d+w$/.test(intervalStr)) {
      const weeks = parseInt(intervalStr);
      if (weeks === 1) return 'Wöchentlich';
      if (weeks === 2) return 'Alle 2 Wochen';
      return `Alle ${weeks} Wochen`;
    }
    
    // Alle X Monate (Format: Zahl + m)
    if (/^\d+m$/.test(intervalStr)) {
      const months = parseInt(intervalStr);
      if (months === 1) return 'Monatlich';
      return `Alle ${months} Monate`;
    }
    
    // Fallback
    return intervalStr;
  };
  
  const toggleAddForm = () => {
    // Modal umschalten
    const newState = !showAddForm;
    setShowAddForm(newState);
    
    // Fehler zurücksetzen und Formular zurücksetzen wenn Modal geöffnet wird
    if (newState) { // Wenn wir das Modal öffnen
      setFormError('');
      setEditingTask(null);
      setNewTask({ 
        title: '', 
        assignedTo: '', 
        dueDate: '', 
        points: 5, 
        repeat: 'none',
        customInterval: '',
        color: '#4a90e2', // Feste Farbe statt Zufallsfarbe, um Fehler zu vermeiden
        notes: '',
        isTemplate: true // Wichtig: Sicherstellen, dass neue Tasks immer als Templates behandelt werden
      });
      setShowCustomInterval(false);
    }
  };

  // Wenn keine Wohnung ausgewählt ist, zeige die NoApartmentSelected-Komponente
  if (!selectedApartment || !selectedApartment.id) {
    return <NoApartmentSelected component="cleaningSchedule" />;
  }
  
  // Zeige Ladeindikator, wenn Daten geladen werden
  if (loading) {
    return <div className="centered-content">Lade Reinigungsplan...</div>;
  }

  // Funktion zum Abbrechen der Neuzuweisung und Schließen des Menüs
  const cancelReassign = () => {
    setReassignMenuVisible(false);
    setTaskToReassign(null);
  };
  
  // Render: Punktestand der Mitbewohner
  const renderPointsBoard = () => {
    // Sortierte Liste der Mitbewohner nach Punkten
    const sortedRoommates = [...invitedRoommates].sort((a, b) => {
      const pointsA = userPoints[a.id] || 0;
      const pointsB = userPoints[b.id] || 0;
      return pointsB - pointsA; // Absteigend (höchste Punkte zuerst)
    });
    
    return (
      <div className="points-board" style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: '100%'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '600', color: '#333' }}>
          <FiAward style={{ marginRight: '8px', color: '#f5a623' }} /> Punktestand
        </h3>
        <div className="points-list" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'space-between'
        }}>
          {sortedRoommates.map((roommate, index) => (
            <div key={roommate.id} className="points-user" style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: index === 0 ? '#fff9e6' : '#f8f9fa',
              border: index === 0 ? '1px solid #f5a623' : '1px solid #e9ecef',
              flex: '1 1 calc(50% - 10px)',
              minWidth: '150px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'default',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 3px 5px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            }}
            >
              {index === 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '20px',
                  height: '20px',
                  background: '#f5a623',
                  clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
                  zIndex: 1
                }}></div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {index < 3 && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: index === 0 ? '#f5a623' : index === 1 ? '#bdbdbd' : '#cd7f32',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {roommate.name} {roommate.id.toString() === (currentUser?.id?.toString() ?? '') && '(Du)'}
                  </div>
                </div>
                <div style={{
                  fontWeight: 'bold',
                  color: index === 0 ? '#f5a623' : '#666',
                  marginLeft: '10px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span>{userPoints[roommate.id] || 0}</span>
                  <small style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>Pkt</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Bestätigungsdialog zum Rückgängigmachen einer erledigten Aufgabe
  const confirmReopenTask = async () => {
    try {
      if (!taskToReopen || !apartmentId) return;
      
      setLoading(true);
      console.log('Mache Erledigung rückgängig für Aufgabe:', taskToReopen.id);
      
      // API-Aufruf zum Wiederherstellen der Aufgabe
      const result = await taskService.reopenTaskInstance(taskToReopen.id, apartmentId);
      
      console.log('Ergebnis des Wiederherstellens:', result);
      
      // Wenn ein Benutzer Punkte verloren hat, diese aktualisieren
      if (result.pointsRemoved > 0 && taskToReopen.completedByUserId) {
        setUserPoints({
          ...userPoints,
          [taskToReopen.completedByUserId]: result.newTotalPoints
        });
      }
      
      // Dialog schließen und Daten neu laden
      setShowReopenConfirmation(false);
      setTaskToReopen(null);
      await loadData();
      
    } catch (error) {
      console.error('Fehler beim Wiederherstellen der Aufgabe:', error);
      alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const cancelReopenTask = () => {
    setShowReopenConfirmation(false);
    setTaskToReopen(null);
  };
  
  return (
    <div className="container fadeIn">
      {/* Bestätigungsdialog für Wiederherstellung */}
      {showReopenConfirmation && taskToReopen && createPortal(
        <div className="fullscreen-menu fadeIn fullscreen-modal">
          <div className="fullscreen-menu-content modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Aufgabe wiederherstellen</h2>
              <button 
                className="icon-button" 
                onClick={cancelReopenTask}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '20px' }}>
              Bist du sicher, dass du die Aufgabe <strong>{taskToReopen.title}</strong> wieder als offen markieren möchtest?
            </p>
            
            {taskToReopen.completedByUserId && (
              <div style={{
                backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                padding: '10px 15px',
                borderRadius: 'var(--button-radius)',
                marginBottom: '20px'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '5px', color: 'var(--text)' }}>
                  <FiInfo style={{ verticalAlign: 'middle', marginRight: '5px' }} /> <strong>Hinweis</strong>
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                  Dadurch werden <strong>{taskToReopen.points_awarded || taskToReopen.points} Punkte</strong> von <strong>{taskToReopen.completedByName || 'dem Benutzer'}</strong> abgezogen.
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="button secondary" 
                onClick={cancelReopenTask}
                style={{ minWidth: '120px', 
                  backgroundColor: 'var(--error)', 
                  width: '100%',
                  boxShadow: '0 3px 5px rgba(0,0,0,0.1)' 
                }}>
                Abbrechen
              </button>
              <button 
                className="button primary" 
                onClick={confirmReopenTask}
                style={{ minWidth: '180px', 
                  backgroundColor: 'var(--primary)', 
                  boxShadow: '0 3px 5px rgba(0,0,0,0.1)',
                  width: '100%',
                }}>
                Aufgabe wiederherstellen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Neuzuweisungsmenü */}
      {completeForOtherUser && taskToCompleteForOther && createPortal(
        <div className="fullscreen-menu fadeIn fullscreen-modal" style={{ zIndex: 1000 }}>
          <div className="fullscreen-menu-content modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Aufgabe erledigt?</h2>
              <button 
                className="icon-button" 
                onClick={() => {
                  setCompleteForOtherUser(false);
                  setTaskToCompleteForOther(null);
                  window.isTogglingTask = false;
                }}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div>
              <p>
                Diese Aufgabe ist <strong>{taskToCompleteForOther.assignedTo}</strong> zugewiesen.
                Wie möchtest du fortfahren?
              </p>
              
              {/* Debug-Informationen für Entwickler */}
              <div style={{ display: 'none' }}>
                <pre style={{ fontSize: '10px', overflow: 'auto', padding: '5px', backgroundColor: '#f5f5f5', borderRadius: '3px' }}>
                  {JSON.stringify({
                    taskId: taskToCompleteForOther.id,
                    title: taskToCompleteForOther.title,
                    assignedToId: taskToCompleteForOther.assignedToId,
                    assignedTo: taskToCompleteForOther.assignedTo,
                    currentUserId: currentUser?.id,
                    isRecurring: taskToCompleteForOther.is_recurring || taskToCompleteForOther.repeat !== 'none',
                    dueDate: taskToCompleteForOther.dueDate || taskToCompleteForOther.due_date
                  }, null, 2)}
                </pre>
              </div>
              
              <div style={{ 
                marginTop: '16px',
                backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                padding: '10px 15px',
                borderRadius: 'var(--button-radius)',
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '5px', color: 'var(--text)' }}>
                  <FiInfo style={{ verticalAlign: 'middle', marginRight: '5px' }} /> <strong>Hinweis</strong>
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                  Wenn du die Aufgabe für {taskToCompleteForOther.assignedTo} abhakst, werden {taskToCompleteForOther.assignedTo} die Punkte gutgeschrieben.
                </p>
              </div>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'row',
                gap: '8px', 
                marginTop: '24px',
                width: '100%'
              }}>
                <button 
                  className="button" 
                  onClick={() => {
                    setCompleteForOtherUser(false);
                    setTaskToCompleteForOther(null);
                    window.isTogglingTask = false;
                  }}
                  style={{
                    backgroundColor: 'var(--error)',
                    border: 'none',
                    padding: '12px 0',
                    borderRadius: '8px',
                    fontWeight: '500',
                    color: 'white',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Abbrechen
                </button>
                                <button
                  className="button"
                  onClick={async () => {
                    // Für sich selbst markieren (aktuelle Benutzer-ID)
                    const instanceId = taskToCompleteForOther.id;
                    const apartmentId = selectedApartment?.id;
                    
                    console.log('Für mich abhaken: Task ID=', instanceId, 'UserID=', currentUser.id, 'Aufgabe=', taskToCompleteForOther);
                    
                    try {
                      // API-Aufruf, um die Aufgabe als erledigt zu markieren (eigene ID)
                      await taskService.completeTaskInstance(instanceId, apartmentId, currentUser.id);
                      console.log('Erfolgreich als erledigt markiert (für mich)');
                      
                      // Dialog schließen
                      setCompleteForOtherUser(false);
                      setTaskToCompleteForOther(null);
                      
                      // Bei wiederkehrenden Aufgaben das Neuzuweisungsmenü anzeigen
                      const isRecurring = (
                        taskToCompleteForOther.is_recurring === true || 
                        taskToCompleteForOther.is_recurring === 1 || 
                        taskToCompleteForOther.repeat !== 'none' ||
                        taskToCompleteForOther.interval_type || 
                        taskToCompleteForOther.intervalType
                      );
                      
                      if (isRecurring) {
                        console.log('Aufgabe ist wiederkehrend, zeige Neuzuweisungsmenü');
                        
                        // Setze die aktuelle Aufgabe als die zu bearbeitende
                        setTaskToReassign(taskToCompleteForOther);
                        // Zeige das Neuzuweisungsmenü an (nach kurzer Verzögerung)
                        setTimeout(() => {
                          setReassignMenuVisible(true);
                        }, 100);
                      } else {
                        window.isTogglingTask = false;
                        // Aktualisiere die Ansicht
                        await loadData();
                      }
                    } catch (error) {
                      console.error('Fehler beim Markieren der Aufgabe:', error);
                      alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
                      window.isTogglingTask = false;
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--secondary)',
                    color: 'white',
                    padding: '12px 0',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '500',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Für mich abhaken
                </button>
                                <button
                  className="button"
                  onClick={async () => {
                    // Für den zugewiesenen Benutzer markieren
                    const instanceId = taskToCompleteForOther.id;
                    const apartmentId = selectedApartment?.id;
                    const assignedUserId = taskToCompleteForOther.assignedToId || taskToCompleteForOther.assignedUserId;
                    
                    console.log('Für anderen Benutzer abhaken: Task ID=', instanceId, 'UserID=', assignedUserId, 'Aufgabe=', taskToCompleteForOther);
                    
                    try {
                      // API-Aufruf, um die Aufgabe als erledigt zu markieren (andere ID)
                      await taskService.completeTaskInstance(instanceId, apartmentId, assignedUserId);
                      console.log('Erfolgreich als erledigt markiert (für anderen Benutzer)');
                      
                      // Dialog schließen
                      setCompleteForOtherUser(false);
                      setTaskToCompleteForOther(null);
                      
                      // Bei wiederkehrenden Aufgaben das Neuzuweisungsmenü anzeigen
                      const isRecurring = (
                        taskToCompleteForOther.is_recurring === true || 
                        taskToCompleteForOther.is_recurring === 1 || 
                        taskToCompleteForOther.repeat !== 'none' ||
                        taskToCompleteForOther.interval_type || 
                        taskToCompleteForOther.intervalType
                      );
                      
                      if (isRecurring) {
                        console.log('Aufgabe ist wiederkehrend, zeige Neuzuweisungsmenü');
                        
                        // Setze die aktuelle Aufgabe als die zu bearbeitende
                        setTaskToReassign(taskToCompleteForOther);
                        // Zeige das Neuzuweisungsmenü an (nach kurzer Verzögerung)
                        setTimeout(() => {
                          setReassignMenuVisible(true);
                        }, 100);
                      } else {
                        window.isTogglingTask = false;
                        // Aktualisiere die Ansicht
                        await loadData();
                      }
                    } catch (error) {
                      console.error('Fehler beim Markieren der Aufgabe:', error);
                      alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
                      window.isTogglingTask = false;
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    padding: '12px 0',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: '500',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Für {taskToCompleteForOther.assignedTo} abhaken
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {reassignMenuVisible && taskToReassign && createPortal(
        <div className="fullscreen-menu fadeIn fullscreen-modal" style={{ zIndex: 1000 }}>
          <div className="fullscreen-menu-content modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Aufgabe erledigt</h2>
              <button 
                className="icon-button" 
                onClick={cancelReassign}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '20px', color: 'var(--text)' }}>
              Möchtest du diese Aufgabe für die nächste Iteration einem anderen Mitbewohner zuweisen?
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="newAssignee" style={{ marginBottom: '10px', display: 'block', fontWeight: '500' }}>
                <FiUserCheck size={16} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
                Neuer Verantwortlicher:
              </label>
              <select
                id="newAssignee"
                className="input"
                defaultValue={taskToReassign.assignedToId || ''}
                onChange={(e) => setSelectedReassignUserId(e.target.value)}
                style={{ 
                  padding: '12px', 
                  borderRadius: 'var(--button-radius)', 
                  borderColor: 'var(--border-color)',
                  fontSize: '15px'
                }}
              >
                {invitedRoommates.map(roommate => (
                  <option key={roommate.id} value={roommate.id}>{roommate.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              flexDirection: 'row',
              alignItems: 'center', 
              gap: '8px', 
              marginTop: '30px',
              width: '100%'}}>
              <button 
                className="button"
                onClick={continueWithoutReassign}
                style={{ 
                  backgroundColor: 'var(--error)',
                  border: '1px solid var(--border-color)',
                  width: '100%',
                  textAlign: 'center',
                  boxShadow: '0 3px 5px rgba(0,0,0,0.1)'
                  
                }}
              >
                Beibehalten
              </button>
              
              <button 
                className="button"
                onClick={() => confirmReassign(document.getElementById('newAssignee').value)}
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  width: '100%',
                  boxShadow: '0 3px 5px rgba(0,0,0,0.1)',
                  fontWeight: '500'
                }}
              >
                Neu zuweisen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    
      {/* Sticky Header */}
      <div className="card" style={styles.stickyHeaderCard}>
        <div style={styles.headerContent}>
          <h1 style={styles.headerTitle}>Aufgaben</h1>
          
          <button 
            className="icon-button-add" 
            onClick={toggleAddForm}
            title="Neue Aufgabe"
          >
            <FiPlus size={24} />
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        
        {/* Aufgabenformular als Fullscreen-Modal */}
        {showAddForm && createPortal(
          <div className="fullscreen-menu fadeIn fullscreen-modal">
            <div className="fullscreen-menu-content modal-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>
                {editingTask 
                  ? 'Aufgabe bearbeiten' 
                  : 'Neue Aufgabe'
                }
              </h2>
                <button 
                  className="icon-button" 
                  onClick={toggleAddForm}
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="form-group">
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskTitle">
                    Titel {newTask.isTemplate ? '*' : ''}
                  </label>
                  <input
                    id="taskTitle"
                    type="text"
                    className="input"
                    placeholder="z.B. Badezimmer putzen"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                
                {/* Einheitliches Zuweisungsfeld */}
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskAssignedTo">
                    Zugewiesen an *
                  </label>
                  <select
                    id="taskAssignedTo"
                    className="input"
                    value={newTask.assignedToId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedRoommate = invitedRoommates.find(r => 
                        r.id.toString() === selectedId
                      );
                      setNewTask({
                        ...newTask, 
                        assignedToId: selectedId,
                        assignedTo: selectedRoommate ? selectedRoommate.name : ''
                      });
                    }}
                  >
                    <option value="">Bitte wählen...</option>
                    {invitedRoommates.map(roommate => (
                      <option key={roommate.id} value={roommate.id}>{roommate.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Einheitliches Fälligkeitsdatum */}
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskDueDate">
                    Fällig am *
                  </label>
                  <input
                    id="taskDueDate"
                    type="date"
                    className="input"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  />
                </div>
                
                {/* Wiederholung - immer anzeigen */}
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskRepeat">
                    Wiederholung
                  </label>
                  <select
                    id="taskRepeat"
                    className="input"
                    value={newTask.repeat}
                    onChange={handleRepeatChange}
                  >
                    {repeatOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                
                {showCustomInterval && (
                  <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="customInterval">
                      Benutzerdefiniertes Intervall *
                      <span style={{ fontSize: '0.8rem', marginLeft: '5px', color: 'var(--text-secondary)' }}>
                        (Wird gespeichert und bei zukünftigen Instanzen verwendet)
                      </span>
                    </label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        id="customInterval"
                        type="text"
                        className="input"
                        placeholder="z.B. 3d, 2w, 1m"
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewTask({...newTask, customInterval: value});
                        }}
                      />
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button
                          type="button"
                          className="interval-chip"
                          onClick={() => setNewTask({...newTask, customInterval: '3d'})}
                          style={{
                            border: 'none',
                            background: 'rgba(var(--primary-rgb), 0.1)',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            color: 'var(--text)'
                          }}
                        >
                          Alle 3 Tage (3d)
                        </button>
                        <button
                          type="button"
                          className="interval-chip"
                          onClick={() => setNewTask({...newTask, customInterval: '2w'})}
                          style={{
                            border: 'none',
                            background: 'rgba(var(--primary-rgb), 0.1)',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            color: 'var(--text)'
                          }}
                        >
                          Alle 2 Wochen (2w)
                        </button>
                        <button
                          type="button"
                          className="interval-chip"
                          onClick={() => setNewTask({...newTask, customInterval: '3m'})}
                          style={{
                            border: 'none',
                            background: 'rgba(var(--primary-rgb), 0.1)',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            color: 'var(--text)'
                          }}
                        >
                          Alle 3 Monate (3m)
                        </button>
                      </div>
                      
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                        <strong>Format:</strong>
                        <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                          <li><strong>Tage:</strong> Anzahl + d (z.B. 3d = alle 3 Tage)</li>
                          <li><strong>Wochen:</strong> Anzahl + w (z.B. 2w = alle 2 Wochen)</li>
                          <li><strong>Monate:</strong> Anzahl + m (z.B. 1m = monatlich)</li>
                        </ul>
                      </div>
                      
                      {newTask.customInterval && (
                        <div style={{ 
                          marginTop: '5px', 
                          padding: '8px 12px', 
                          backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                          borderRadius: '4px',
                          color: 'var(--text)',
                          fontWeight: 'medium'
                        }}>
                          <strong>Vorschau:</strong> {formatCustomInterval(newTask.customInterval)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskPoints">
                    Punkte
                  </label>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      id="taskPoints"
                      value={newTask.points}
                      onChange={(e) => setNewTask({...newTask, points: parseInt(e.target.value) || 5})}
                      style={{ 
                        width: '100%', 
                        height: '6px',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(newTask.points - 1) * 5}%, #e0e0e0 ${(newTask.points - 1) * 5}%, #e0e0e0 100%)`,
                        borderRadius: '10px',
                        outline: 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                      className="custom-slider"
                    />
                    <span 
                      style={{ 
                        minWidth: '30px', 
                        textAlign: 'center', 
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        fontSize: '14px'
                      }}
                    >
                      {newTask.points}
                    </span>
                  </div>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskColor">
                    Farbe
                  </label>
                  
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px'}}>
                    {colorOptions.map(option => (
                      <div 
                        key={option.value} 
                        onClick={() => {
                          setNewTask({...newTask, color: option.value});
                          setShowCustomColorPicker(false);
                        }}
                        style={{
                          width: '30px', 
                          height: '30px', 
                          backgroundColor: option.value,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          border: newTask.color === option.value ? '2px solid #333' : '1px solid #ddd',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s ease',
                          transform: newTask.color === option.value ? 'scale(1.1)' : 'scale(1)'
                        }}
                        title={option.label}
                      />
                    ))}
                    
                    {/* Benutzerdefinierter Farbauswahl-Button */}
                    <div 
                      onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
                      style={{
                        width: '30px', 
                        height: '30px', 
                        background: 'linear-gradient(135deg, #ff5e62, #ff9966, #ffff66, #66ff66, #66d9ff, #c366ff, #ff66bf)',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: !colorOptions.some(opt => opt.value === newTask.color) ? '2px solid #333' : '1px solid #ddd',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Eigene Farbe wählen"
                    >
                      <span style={{
                        color: 'white', 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}>+</span>
                    </div>
                  </div>
                  
                  {/* Benutzerdefinierter Farbwähler */}
                  {showCustomColorPicker && (
                    <div style={{ marginTop: '10px' }}>
                      <input
                        type="color"
                        value={newTask.color}
                        onChange={(e) => setNewTask({...newTask, color: e.target.value})}
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--button-radius)',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ marginTop: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Aktueller Farbwert: {newTask.color}
                      </div>
                    </div>
                  )}
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="taskNotes">
                    Notizen
                  </label>
                  <textarea
                    id="taskNotes"
                    className="input"
                    placeholder={newTask.isTemplate 
                      ? "Allgemeine Hinweise zur Durchführung dieser Aufgabe" 
                      : "Notizen für diese spezifische Aufgabeninstanz"}
                    value={newTask.notes}
                    onChange={(e) => setNewTask({...newTask, notes: e.target.value})}
                    style={{ minHeight: '80px' }}
                  />
                </div>
                
                {formError && (
                  <div 
                    style={{ 
                      backgroundColor: '#ffeeee', 
                      padding: '10px 15px', 
                      borderRadius: '4px', 
                      marginBottom: '15px',
                      color: '#e74c3c',
                      fontSize: '14px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    {formError}
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '20px' }}>
                  <button 
                    className="button" 
                    onClick={() => {
                      setShowAddForm(false);
                      setFormError(''); // Fehler zurücksetzen beim Schließen
                      if (editingTask) cancelEdit();
                    }}
                    style={{
                      backgroundColor: 'var(--error)',
                      boxShadow: '0 4px 8px rgba(231, 76, 60, 0.2)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Abbrechen
                  </button>
                  <button 
                    className="button primary" 
                    onClick={async (e) => {
                      // Event stoppen, damit das Formular nicht automatisch geschlossen wird
                      e.preventDefault();
                      
                      // Fehler zurücksetzen
                      setFormError('');
                      
                      // Validierung durchführen
                      if (!newTask.title || !newTask.assignedTo || !newTask.dueDate) {
                        setFormError('Bitte fülle alle Pflichtfelder aus.');
                        return;
                      }
                      
                      if (newTask.repeat === 'custom' && !newTask.customInterval) {
                        setFormError('Bitte gib ein benutzerdefiniertes Intervall ein.');
                        return;
                      }
                      
                      // API-Aufruf durchführen und Modal nur schließen, wenn erfolgreich
                      try {
                        let taskToSave = {...newTask};
                        
                        // Datumsvalidierung
                        try {
                          const dateObj = new Date(taskToSave.dueDate);
                          if (isNaN(dateObj.getTime())) {
                            setFormError('Bitte gib ein gültiges Datum ein.');
                            return;
                          }
                          taskToSave.dueDate = dateObj.toISOString().split('T')[0];
                        } catch (error) {
                          setFormError('Bitte gib ein gültiges Datum ein.');
                          return;
                        }
                        
                        // Punkte als Zahl sicherstellen
                        taskToSave.points = parseInt(taskToSave.points) || 5;
                        
                        console.log('FORMULAR-SUBMIT: Starte API-Verarbeitung', taskToSave);
                        setLoading(true);
                        
                        // Die ID des zugewiesenen Benutzers finden
                        let assignedUserId = null;
                        if (taskToSave.assignedTo) {
                          // Versuche zuerst über den Namen zu finden
                          const assignedRoommate = invitedRoommates.find(r => r.name === taskToSave.assignedTo);
                          
                          if (assignedRoommate) {
                            assignedUserId = assignedRoommate.id;
                            console.log('Mitbewohner gefunden:', assignedRoommate);
                          } else if (taskToSave.assignedToId) {
                            // Fallback: vorhandene ID verwenden
                            assignedUserId = taskToSave.assignedToId;
                            console.log('Vorhandene assignedToId verwendet:', assignedUserId);
                          }
                          
                          console.log('Zugewiesener Benutzer:', {
                            name: taskToSave.assignedTo,
                            id: assignedUserId,
                            allRoommates: invitedRoommates.map(r => ({ id: r.id, name: r.name }))
                          });
                        }
                        
                        // Wenn eine benutzerdefinierte Intervall-Eingabe existiert, in Standard-Intervalltypen umwandeln
                        let customIntervalData = null;
                        if (taskToSave.repeat === 'custom' && taskToSave.customInterval) {
                          const intervalStr = taskToSave.customInterval.trim();
                          console.log('Analysiere benutzerdefinierten Intervall:', intervalStr);
                          
                          // Tage-Format (3d) -> direkt in daily umwandeln
                          if (/^\d+d$/.test(intervalStr)) {
                            const days = parseInt(intervalStr);
                            console.log(`Benutzerdefiniertes Intervall '${intervalStr}' wird zu: daily, Wert=${days}`);
                            
                            // Direkt in Standardformat umwandeln, ohne 'custom' Typ zu verwenden
                            taskToSave.repeat = 'daily';
                            // Wichtig: Den Wert in taskToSave speichern, damit er später übernommen wird
                            taskToSave.intervalValue = days;
                            customIntervalData = {
                              intervalType: 'daily',
                              intervalValue: days
                            };
                          }
                          // Wochen-Format (2w) -> direkt in weekly umwandeln
                          else if (/^\d+w$/.test(intervalStr)) {
                            const weeks = parseInt(intervalStr);
                            console.log(`Benutzerdefiniertes Intervall '${intervalStr}' wird zu: weekly, Wert=${weeks}`);
                            
                            // Direkt in Standardformat umwandeln, ohne 'custom' Typ zu verwenden
                            taskToSave.repeat = 'weekly';
                            // Wichtig: Den Wert in taskToSave speichern, damit er später übernommen wird
                            taskToSave.intervalValue = weeks;
                            customIntervalData = {
                              intervalType: 'weekly',
                              intervalValue: weeks
                            };
                          }
                          // Monats-Format (3m) -> direkt in monthly umwandeln
                          else if (/^\d+m$/.test(intervalStr)) {
                            const months = parseInt(intervalStr);
                            console.log(`Benutzerdefiniertes Intervall '${intervalStr}' wird zu: monthly, Wert=${months}`);
                            
                            // Direkt in Standardformat umwandeln, ohne 'custom' Typ zu verwenden
                            taskToSave.repeat = 'monthly';
                            // Wichtig: Den Wert in taskToSave speichern, damit er später übernommen wird
                            taskToSave.intervalValue = months;
                            customIntervalData = {
                              intervalType: 'monthly',
                              intervalValue: months
                            };
                          }
                          // Fallback: Versuche, einen numerischen Wert zu extrahieren und als tägliches Intervall zu behandeln
                          else {
                            // Extrahiere Zahlen aus dem String
                            const numericValue = intervalStr.replace(/\D/g, '');
                            const value = parseInt(numericValue) || 1;
                            console.log(`Unbekanntes Format '${intervalStr}', verwende daily mit Wert=${value}`);
                            
                            taskToSave.repeat = 'daily';
                            customIntervalData = {
                              intervalType: 'daily',
                              intervalValue: value
                            };
                          }
                          
                          console.log('CUSTOM INTERVAL VERARBEITET:', customIntervalData);
                        }
                        
                        // Daten für die API vorbereiten
                        const apiTask = {
                          title: taskToSave.title,
                          description: taskToSave.notes || '',
                          points: parseInt(taskToSave.points) || 5,
                          isRecurring: taskToSave.repeat !== 'none',
                          
                          // Intervalltyp und -wert - vereinfacht, da wir custom direkt in Standardtypen umwandeln
                          // Custom wird nur noch für spezielle Fälle wie monthly_days verwendet
                          intervalType: taskToSave.repeat === 'custom' && customIntervalData 
                            ? customIntervalData.intervalType
                            : (taskToSave.repeat === 'daily' ? 'daily' : 
                               taskToSave.repeat === 'weekly' ? 'weekly' : 
                               taskToSave.repeat === 'biweekly' ? 'weekly' : 
                               taskToSave.repeat === 'monthly' ? 'monthly' : 'weekly'),
                          
                          // Intervallwert - direkt vom Standard oder umgewandelten benutzerdefinierten Wert
                          intervalValue: taskToSave.intervalValue || // Nutze den gespeicherten Wert, wenn vorhanden
                                       (taskToSave.repeat === 'custom' && customIntervalData
                                         ? customIntervalData.intervalValue
                                         : (taskToSave.repeat === 'biweekly' ? 2 : 1)),
                          
                          // Speichere das benutzerdefinierte Intervall nur für Spezialformate wie monthly_days
                          customInterval: (taskToSave.repeat === 'custom' && customIntervalData && 
                                          customIntervalData.customIntervalString) 
                                       ? customIntervalData.customIntervalString : null,
                          
                          color: taskToSave.color || '#4a90e2',
                          assignedUserId: assignedUserId,
                          dueDate: taskToSave.dueDate,
                          // KRITISCHE ÄNDERUNG: Explizites Setzen des initial_due_date für die DB
                          initial_due_date: taskToSave.dueDate,
                          repeat: taskToSave.repeat || 'none' // Explizit Wiederholung übergeben
                        };
                        
                        console.log('FORMULAR-SUBMIT: API-Daten vorbereitet', {
                          ...apiTask,
                          dueDate_info: {
                            originalValue: taskToSave.dueDate,
                            explicit_initial_due_date: apiTask.initial_due_date,
                            isTemplate: newTask.isTemplate
                          }
                        });
                        
                        try {
                          if (editingTask) {
                            // Vereinheitlichtes Bearbeiten: Sowohl Instanz als auch Template werden aktualisiert
                            console.log('FORMULAR-SUBMIT: Vereinheitlichtes Update für', editingTask);
                            
                            // 1. Ermittle die IDs für Instanz und Template
                            const instanceId = editingTask.id;
                            const templateId = editingTask.task_id || editingTask.templateId;
                            
                            console.log(`Vereinheitlichte Bearbeitung: Instanz-ID: ${instanceId} Template-ID: ${templateId}`);
                            
                            // 2. Aktualisiere Template-spezifische Daten (wenn eine Template-ID vorhanden ist)
                            if (templateId) {
                              // Template-spezifische Daten
                              const templateData = {
                                apartmentId: apartmentId,
                                title: apiTask.title,
                                color: apiTask.color,
                                points: apiTask.points,
                                isRecurring: apiTask.isRecurring,
                                intervalType: apiTask.intervalType,
                                intervalValue: apiTask.intervalValue,
                                // WICHTIG: Repeat-Wert explizit u00fcbergeben, damit er nicht verloren geht
                                repeat: apiTask.repeat || taskToSave.repeat,
                                description: apiTask.description, // Beschreibung auch im Template speichern
                                isTemplate: true
                              };
                              
                              console.log('Template-Daten zum Update:', templateData);
                              try {
                                await taskService.updateTask(templateId, templateData);
                                console.log('Template aktualisiert:', templateId);
                              } catch (err) {
                                console.error('Fehler beim Aktualisieren des Templates:', err);
                                // Fehler nicht werfen, damit immer noch versucht wird, die Instanz zu aktualisieren
                              }
                            }
                            
                            // 3. Aktualisiere Instanz-spezifische Daten
                            // Instanz-spezifische Daten - mit Zeitzonenanpassung fu00fcr das Datum
                            
                            // Fälligkeitsdatum mit Zeitzonenanpassung
                            let adjustedDueDate = apiTask.dueDate;
                            if (adjustedDueDate) {
                              try {
                                // Datum parsen und einen Tag hinzufügen, um MySQL UTC-Konvertierung auszugleichen
                                const dateParts = adjustedDueDate.split('-');
                                if (dateParts.length === 3) {
                                  const year = parseInt(dateParts[0]);
                                  const month = parseInt(dateParts[1]) - 1; // Monate sind 0-basiert in JS
                                  const day = parseInt(dateParts[2]);
                                  
                                  // Datum erstellen und einen Tag hinzufügen
                                  const dueDate = new Date(year, month, day);
                                  dueDate.setDate(dueDate.getDate() + 1);
                                  
                                  // Zurück in ISO-Format konvertieren (YYYY-MM-DD)
                                  adjustedDueDate = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
                                  console.log(`Datum angepasst: ${apiTask.dueDate} -> ${adjustedDueDate} (für Zeitzonenkorrektur)`);
                                }
                              } catch (e) {
                                console.error('Fehler bei der Datumsanpassung:', e);
                              }
                            }
                            
                            const instanceData = {
                              apartmentId: apartmentId,
                              assigned_user_id: apiTask.assignedUserId,
                              due_date: adjustedDueDate,
                              notes: apiTask.description
                            };
                            
                            console.log('Instanz-Daten zum Update:', instanceData);
                            await taskService.updateTaskInstance(instanceId, instanceData);
                            setEditingTask(null);
                          } else {
                            // Neue Aufgabe erstellen
                            console.log('FORMULAR-SUBMIT: Sende createTask an API', apartmentId, {
                              ...apiTask,
                              initial_due_date_debug: apiTask.initial_due_date
                            });
                            
                            // Erweiterte Debug-Ausgabe vor dem API-Aufruf
                            console.log('TASK-CREATION DEBUGGING: Werte für initial_due_date:', {
                              fromTaskToSave: taskToSave.dueDate,
                              fromApiTask: apiTask.initial_due_date,
                              isTemplateFlag: apiTask.isRecurring || taskToSave.repeat !== 'none'
                            });
                            
                            await taskService.createTask(apartmentId, apiTask);
                          }
                          
                          // Daten neu laden um Backend-Daten anzuzeigen
                          await loadData();
                        } catch (error) {
                          console.error('FEHLER bei API-Aufruf:', error);
                          setFormError(`API-Fehler: ${error.message || 'Unbekannter Fehler'}`);
                          setLoading(false);
                          return; // Nicht fortfahren bei Fehler
                        }
                        
                        // Modal schließen und Formular zurücksetzen
                        setShowAddForm(false);
                        setNewTask({ 
                          title: '', 
                          assignedTo: '', 
                          dueDate: '', 
                          points: 5, 
                          repeat: 'none',
                          customInterval: '',
                          color: '#4a90e2',
                          notes: ''
                        });
                        setShowCustomInterval(false);
                      } catch (error) {
                        console.error('Fehler beim Speichern:', error);
                        setFormError('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
                      }
                    }}
                    style={{ 
                      backgroundColor: 'var(--primary)',
                      boxShadow: '0 4px 8px rgba(var(--primary-rgb), 0.2)',
                      transition: 'all 0.2s ease',
                      fontWeight: '500'
                    }}
                  >
                    {editingTask 
                      ? (newTask.isTemplate 
                          ? 'Vorlage speichern' 
                          : 'Instanz aktualisieren')
                      : 'Neue Aufgabe hinzufügen'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
        
        {/* Ansichtsfilter */}
        {cleaningTasks.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--button-radius)',
              padding: '3px',
              gap: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              width: 'fit-content'
            }}>
              <button
                className={`filter-button`}
                onClick={() => setFilterStatus('pending')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--button-radius)',
                  border: 'none',
                  background: filterStatus === 'pending' ? 'var(--primary)' : 'transparent',
                  color: filterStatus === 'pending' ? 'white' : 'var(--text-secondary)',
                  fontWeight: filterStatus === 'pending' ? '600' : 'normal',
                  transition: 'all 0.2s ease',
                  fontSize: '13px'
                }}
              >
                Anstehend
              </button>
              <button
                className={`filter-button`}
                onClick={() => setFilterStatus('completed')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--button-radius)',
                  border: 'none',
                  background: filterStatus === 'completed' ? 'var(--primary)' : 'transparent',
                  color: filterStatus === 'completed' ? 'white' : 'var(--text-secondary)',
                  fontWeight: filterStatus === 'completed' ? '600' : 'normal',
                  transition: 'all 0.2s ease',
                  fontSize: '13px'
                }}
              >
                Erledigt
              </button>
              <button
                className={`filter-button`}
                onClick={() => setFilterStatus('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--button-radius)',
                  border: 'none',
                  background: filterStatus === 'all' ? 'var(--primary)' : 'transparent',
                  color: filterStatus === 'all' ? 'white' : 'var(--text-secondary)',
                  fontWeight: filterStatus === 'all' ? '600' : 'normal',
                  transition: 'all 0.2s ease',
                  fontSize: '13px'
                }}
              >
                Alle
              </button>
              <button
                className={`filter-button`}
                onClick={() => setFilterStatus('archived')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--button-radius)',
                  border: 'none',
                  background: filterStatus === 'archived' ? 'var(--primary)' : 'transparent',
                  color: filterStatus === 'archived' ? 'white' : 'var(--text-secondary)',
                  fontWeight: filterStatus === 'archived' ? '600' : 'normal',
                  transition: 'all 0.2s ease',
                  fontSize: '13px'
                }}
              >
                <FiArchive size={16} />
              </button>
            </div>
          </div>
        )}

        {activeView === 'list' ? (
          getFilteredTasks().length === 0 ? (
            <div className="empty-state">
              {filterStatus === 'archived' ? (
                <>
                  <FiArchive size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                  <p>Keine archivierten Aufgaben</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Erledigte Aufgaben ohne Wiederholung werden automatisch archiviert
                  </p>
                </>
              ) : (
                <>
                  <FiCalendar size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                  <p>Keine {filterStatus === 'pending' ? 'anstehenden' : filterStatus === 'completed' ? 'erledigten' : ''} Aufgaben vorhanden</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Füge deine erste Aufgabe hinzu</p>
                </>
              )}
            </div>
          ) : (
            <div className="task-list">
              {getFilteredTasks().map(task => (
                <div 
                  className={`task-card ${task.isDone ? 'completed' : ''} ${task.archived ? 'archived' : ''}`} 
                  style={{ 
                    ...styles.taskContainer, 
                    ...(task.isTemplate ? styles.taskTemplateContainer : styles.taskInstanceContainer),
                    borderLeftColor: task.color,
                    position: 'relative',
                    padding: '10px',
                    paddingLeft: '15px',
                    display: 'grid',
                    gridTemplateColumns: '30px 1fr 15px',
                    gridTemplateRows: 'auto 1fr auto',
                    gap: '5px 5px',
                    alignItems: 'start',
                    opacity: task.archived ? 0.8 : 1,
                    background: task.archived ? 'rgba(var(--primary-rgb), 0.08)' : 'var(--card-background)',
                    // Feste Minimalhöhe für Stabilität
                    minHeight: activeMenuTask === task.id ? '120px' : '85px',
                    transition: 'min-height 0.3s ease-out'
                  }} 
                  key={task.id}
                >
                  {/* Checkbox in der Mitte der ersten Spalte - nur in Zeile 1 und 2 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    gridColumn: '1',
                    gridRow: '1 / span 2',
                    position: 'sticky',
                    top: '10px'
                  }}>
                    {/* Je nach Status (erledigt/nicht erledigt) unterschiedliches Icon anzeigen */}
                    <div 
                      className="task-checkbox" 
                      onClick={task.archived ? undefined : () => updateTaskStatus(task)}
                      style={{
                        width: '24px',
                        height: '24px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '50%',
                        backgroundColor: task.isDone ? task.color || 'var(--primary)' : 'transparent',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: task.archived ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: task.archived ? 0.5 : 1,
                        position: 'relative'
                      }}
                    >
                      {task.isDone ? (
                        <FiCheck style={{color: 'var(--card-background)', transform: 'scale(1.2)'}} />
                      ) : (
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'transparent' }} />
                      )}
                      
                      {/* Hover-Hint für erledigte Aufgaben */}
                      {task.isDone && (
                        <div className="tooltip" style={{
                          position: 'absolute',
                          top: '-25px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          whiteSpace: 'nowrap',
                          opacity: 0,
                          pointerEvents: 'none',
                          transition: 'opacity 0.2s ease',
                          zIndex: 10
                        }}>
                          Erledigung rückgängig machen
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Punkteanzeige als absolut positioniertes Element oben rechts */}
                  {task.points > 0 && (() => {
                    // Für erledigte oder archivierte Aufgaben zeigen wir die tatsächlich vergebenen Punkte
                    // Für anstehende Aufgaben zeigen wir die Punkte mit möglicher Reduktion
                    
                    // Bei erledigten oder archivierten Aufgaben sofort die tatsächlichen Punkte anzeigen
                    if ((filterStatus === 'completed' && task.isDone) || filterStatus === 'archived' || task.archived) {
                      const actualPoints = task.isDone ? (task.pointsAwarded || task.points_awarded || task.points) : task.points;
                      return (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          zIndex: 5,
                          background: task.archived ? 'var(--text-secondary)' : 'var(--primary)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: 'var(--button-radius)',
                          fontSize: '13px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 3px 5px rgba(0, 0, 0, 0.1)',
                          transform: 'scale(0.9)',
                          transition: 'all 0.2s ease',
                          opacity: task.archived ? 0.8 : 1
                        }}>
                          <FiAward size={12} style={{ marginRight: '1px' }} />
                          <div>{actualPoints}</div>
                        </div>
                      );
                    }
                    
                    // Für anstehende Aufgaben (pending, all) berechnen wir mögliche Punktreduktion
                    let percentReduction = 0;
                    let originalPoints = task.points;
                    let reducedPoints = originalPoints;

                    // Prüfen, ob die Aufgabe überfällig ist oder war
                    const dateValue = task.dueDate || task.due_date;
                    if (dateValue) {
                      try {
                        const parts = dateValue.split('-');
                        if (parts.length === 3) {
                          const year = parseInt(parts[0]);
                          const month = parseInt(parts[1]) - 1;
                          const day = parseInt(parts[2]);
                          const dueDate = new Date(year, month, day);
                          
                          // Aktuelle Zeit (nur Datumsteil)
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          
                          // Ist die Aufgabe überfällig?
                          if (dueDate < today) {
                            // Anzahl der Tage, die überfällig ist
                            const diffTime = today - dueDate;
                            const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            // Intervall bestimmen
                            let intervalDays = 7; // Standard: 7 Tage
                            if (task.interval_type === 'daily' || task.intervalType === 'daily') {
                              intervalDays = 1 * (task.interval_value || 1);
                            } else if (task.interval_type === 'weekly' || task.intervalType === 'weekly') {
                              intervalDays = 7 * (task.interval_value || 1);
                            } else if (task.interval_type === 'monthly' || task.intervalType === 'monthly') {
                              intervalDays = 30 * (task.interval_value || 1);
                            }
                            
                            // Linear skalierende Reduktion berechnen (max 50%)
                            const reduction = Math.min(0.5, (daysOverdue / intervalDays) * 0.5);
                            percentReduction = Math.round(reduction * 100);
                            reducedPoints = Math.round(originalPoints * (1 - reduction));
                          }
                        }
                      } catch (e) {
                        console.error('Fehler bei der Berechnung des Punktabzugs:', e);
                      }
                    }

                    return (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 5,
                        background: 'var(--primary)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: 'var(--button-radius)',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 3px 5px rgba(0, 0, 0, 0.1)',
                        transform: 'scale(0.9)',
                        transition: 'all 0.2s ease'
                      }}>
                        <FiAward size={12} style={{ marginRight: '1px' }} />
                        {/* Wenn Abzug vorhanden ist, Original UND reduzierte Punkte anzeigen */}
                        {percentReduction > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <del style={{ color: 'rgba(255, 255, 255, 0.7)', marginRight: '5px', fontSize: '12px' }}>
                              {originalPoints}
                            </del>
                            <span style={{ color: 'white' }}>
                              {reducedPoints}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              color: 'white',
                              background: 'rgba(255, 255, 255, 0.2)',
                              padding: '1px 5px',
                              borderRadius: '5px',
                              marginLeft: '4px'
                            }}>
                              -{percentReduction}%
                            </span>
                          </div>
                        ) : (
                          <div>
                            {originalPoints}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3-Punkte-Menü und Übernehmen-Icon in der dritten Spalte, vertikal zentriert */}
                  <div style={{ 
                    gridColumn: '3',
                    gridRow: '1 / span 3',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    height: '100%'
                  }}>
                    {/* Übernehmen-Icon-Button, falls nicht dem aktuellen Benutzer zugewiesen */}
                    {(() => {
                      // Holt direkt die Benutzer-ID aus dem localStorage
                      let currentUserId = null;
                      try {
                        const userData = localStorage.getItem('userData');
                        if (userData) {
                          const user = JSON.parse(userData);
                          currentUserId = user.id.toString();
                          console.log('Benutzer-ID aus localStorage:', currentUserId);
                          console.log('Task zugewiesen an:', task.assignedToId);
                        }
                      } catch (e) {
                        console.error('Fehler beim Laden der Benutzer-ID aus localStorage:', e);
                      }
                      
                      // Prüft, ob der Task dem aktuellen Benutzer zugewiesen ist
                      const isAssignedToCurrentUser = currentUserId && (task.assignedToId === currentUserId || task.assigned_user_id === currentUserId);
                      
                      if (currentUserId && !isAssignedToCurrentUser) {
                        // Falls Task einem anderen Benutzer zugewiesen ist
                        return (
                          <button 
                            className="task-takeover"
                            onClick={(e) => {
                              e.stopPropagation(); // Verhindere Event-Bubbling
                              takeOverTask(task.id);
                            }}
                            title="Diese Aufgabe übernehmen"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(var(--primary-rgb), 0.1)',
                              color: 'var(--primary)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              zIndex: 5
                            }}
                          >
                            <FiUserCheck size={16} />
                          </button>
                        );
                      } else if (isAssignedToCurrentUser) {
                        // Falls Task dem aktuellen Benutzer zugewiesen ist
                        return (
                          <div
                            title="Diese Aufgabe ist dir zugewiesen"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(var(--success-rgb), 0.15)',
                              color: 'var(--success)',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              position: 'relative',
                              zIndex: 5
                            }}
                          >
                            <FiUser size={14} />
                          </div>
                        );
                      }
                      
                      return null; // Kein Icon anzeigen, wenn kein Benutzer angemeldet ist
                    })()}
                    
                    {/* 3-Punkte-Menü Toggle - absolut positioniert */}
                    <div className="task-actions" style={{
                      position: 'absolute',
                      top: '45px',  // Konstante Position vom oberen Rand
                      right: '10px', // Konstante Position vom rechten Rand
                      width: '20px',
                      height: '20px',
                      zIndex: 10     // Höherer zIndex damit es über anderen Elementen bleibt
                    }}>
                      <button 
                        className="task-menu-toggle" 
                        onClick={() => setActiveMenuTask(activeMenuTask === task.id ? null : task.id)}
                        title="Aktionen anzeigen"
                        style={{
                          background: 'none',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          position: 'relative'
                        }}
                      >
                        {/* Zwei überlagerte Divs mit absoluter Positionierung für perfekte Rotation */}
                        <div style={{ 
                          position: 'absolute',
                          width: '28px',
                          height: '28px',
                          display: 'flex', 
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.2s ease',
                          transformOrigin: 'center center'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text)' }}></div>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text)' }}></div>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text)' }}></div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {/* Eingebettetes Menü innerhalb der Karte als separate Zeile */}
                  {activeMenuTask === task.id && (
                    <div 
                      className="task-menu-expanded"
                      style={{
                        gridColumn: '1 / span 3', // Gesamte Breite der Karte nutzen
                        gridRow: '3', // Explizit als dritte Zeile platzieren
                        overflow: 'hidden',
                        animation: 'expandMenu 0.3s ease-out forwards',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-color)',
                        bottom: '0',
                        width: '100%',
                        zIndex: 2
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        width: '100%',
                        gap: '5px',
                        padding: '0 5px'
                      }}>
                      <style>
                        {`
                          .menu-button-text {
                            font-size: clamp(7px, 0.65vw, 10px);
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            max-width: 100%;
                            text-align: center;
                            display: block;
                          }
                          
                          @media (max-width: 320px) {
                            .menu-button-text {
                              font-size: 8px;
                            }
                          }
                        `}
                      </style>
                        {/* Menüeinträge als Button-Reihe */}
                        {task.archived ? (
                          <button 
                            className="menu-item-button" 
                            onClick={() => {
                              toggleArchiveStatus(task.id);
                              setActiveMenuTask(null);
                            }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '8px 2px',
                              flex: 1,
                              textAlign: 'center',
                              border: 'none',
                              borderRadius: 'var(--button-radius)',
                              background: 'var(--background)',
                              cursor: 'pointer',
                              color: 'var(--text)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <FiArchive size={18} />
                            <span className="menu-button-text">Wiederherstellen</span>
                          </button>
                        ) : (
                          <>
                            {/* Bearbeiten-Button nur anzeigen, wenn die Aufgabe NICHT erledigt ist */}
                            {!task.isDone && (
                              <button 
                                className="menu-item-button" 
                                onClick={() => {
                                  handleEditTask(task);
                                  setActiveMenuTask(null);
                                }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '8px 2px',
                                  flex: 1,
                                  textAlign: 'center',
                                  border: 'none',
                                  borderRadius: 'var(--button-radius)',
                                  background: 'var(--background)',
                                  cursor: 'pointer',
                                  color: 'var(--text)',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <FiEdit2 size={18} />
                                <span className="menu-button-text">Bearbeiten</span>
                              </button>
                            )}
                            
                            {/* Übernehmen-Button - wird nur angezeigt, wenn die Aufgabe jemand anderem zugewiesen und nicht erledigt ist */}
                            {!task.isDone && task.assignedToId && task.assignedToId !== currentUser?.id && (
                              <button 
                                className="menu-item-button" 
                                onClick={() => {
                                  takeoverTask(task.id);
                                  setActiveMenuTask(null);
                                }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '8px 2px',
                                  flex: 1,
                                  textAlign: 'center',
                                  border: 'none',
                                  borderRadius: 'var(--button-radius)',
                                  background: 'var(--background)',
                                  cursor: 'pointer',
                                  color: 'var(--text)',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <FiUserPlus size={18} />
                                <span className="menu-button-text">Übernehmen</span>
                              </button>
                            )}
                            
                            {/* Archivieren-Button für ALLE Aufgaben anzeigen (unabhängig vom Status) */}
                            <button 
                              className="menu-item-button" 
                              onClick={() => {
                                toggleArchiveStatus(task.id);
                                setActiveMenuTask(null);
                              }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '8px 2px',
                                flex: 1,
                                textAlign: 'center',
                                border: 'none',
                                borderRadius: 'var(--button-radius)',
                                background: 'var(--background)',
                                cursor: 'pointer',
                                color: 'var(--text)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <FiArchive size={18} />
                              <span className="menu-button-text">Archivieren</span>
                            </button>
                          </>
                        )}
                        
                        <button 
                          className="menu-item-button" 
                          onClick={() => {
                            deleteTask(task.id);
                            setActiveMenuTask(null);
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '8px 2px',
                            flex: 1,
                            textAlign: 'center',
                            border: 'none',
                            borderRadius: 'var(--button-radius)',
                            background: 'var(--background)',
                            cursor: 'pointer',
                            color: 'var(--error)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <FiTrash2 size={18} />
                          <span className="menu-button-text">Löschen</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Hauptinhalt der Karte */}
                  <div className="task-content" style={{ color: 'var(--text)' }}>
                    {/* Titel der Aufgabe */}
                    <div 
                      className="task-title" 
                      style={{ 
                        fontSize: '16px', 
                        fontWeight: '600', 
                        marginBottom: '0',
                        lineHeight: '1.2',
                        paddingTop: '0',
                        marginTop: '8px',
                        marginRight: '64px',
                        textDecoration: task.isDone ? 'line-through' : 'none',
                        opacity: task.isDone ? 0.7 : 1,
                        color: 'var(--text)'
                      }}
                    >
                      {task.title}
                    </div>
                    
                    {/* Notizen (falls vorhanden) */}
                    {task.notes && (
                      <div className="task-notes" style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginBottom: '16px',
                        padding: '8px',
                        backgroundColor: 'rgba(var(--background-rgb), 0.5)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        marginTop: '8px'
                      }}>
                        {task.notes}
                      </div>
                    )}
                    
                    {/* Info-Zeilen - kompaktere Darstellung */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {/* Zugewiesener Benutzer mit Mini-Profilbild */}
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: task.assignedToId ? `var(--${getColorForUser(task.assignedToId) || 'primary'})` : 'var(--text-secondary)',
                          marginRight: '8px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          lineHeight: 1,
                          textAlign: 'center',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                        }}>
                          {task.assignedTo ? task.assignedTo.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span style={{ color: 'var(--text)' }}>{task.assignedTo || 'Nicht zugewiesen'}</span>
                      </div>
                      
                      {/* Zusätzliche Infos für erledigte Aufgaben */}
                      {task.isDone && (
                        <div className="completed-info" style={{
                          fontSize: '12px',
                          backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                          borderRadius: '8px',
                          padding: '8px',
                          marginTop: '8px',
                          borderLeft: '2px solid var(--primary)',
                          color: 'var(--text-secondary)'
                        }}>
                          {/* Wer und wann erledigt */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}>
                            <FiCheck size={14} style={{ marginRight: '6px', color: 'var(--success)' }} />
                            <div>
                              <span>Erledigt von </span>
                              {task.completedByName ? (
                                <strong style={{ color: 'var(--text)' }}>{task.completedByName}</strong>
                              ) : (
                                <strong style={{ color: 'var(--text)' }}>{task.completedByUserId ? 'ID: ' + task.completedByUserId : 'Unbekannt'}</strong>
                              )}
                              {task.completedAt && (
                                <span> am <strong style={{ color: 'var(--text)' }}>{new Date(task.completedAt).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})}</strong> um <strong style={{ color: 'var(--text)' }}>{new Date(task.completedAt).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</strong></span>
                              )}
                            </div>
                          </div>
                          
                          {/* Punkte und Status */}
                          <div style={{
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center'
                          }}>
                            {/* Punkte mit evtl. Abzug */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <FiAward size={14} style={{ marginRight: '5px', color: 'var(--warning)' }} />
                              {task.pointsReduction > 0 ? (
                                <span>
                                  <strong style={{ color: 'var(--text)' }}>{task.pointsAwarded}</strong> von {task.originalPoints} Punkten
                                  <span style={{ color: 'var(--error)', marginLeft: '4px' }}>(-{task.pointsReduction}%)</span>
                                </span>
                              ) : (
                                <span><strong style={{ color: 'var(--text)' }}>{task.pointsAwarded}</strong> Punkte</span>
                              )}
                            </div>
                            
                            {/* Überfälligkeitsstatus */}
                            {task.completedAt && task.dueDate && new Date(task.completedAt) > new Date(task.dueDate) && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: 'var(--error)',
                                fontSize: '11px',
                                backgroundColor: 'rgba(var(--error-rgb), 0.08)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                <FiAlertCircle size={11} style={{ marginRight: '3px' }} />
                                <span>Überfällig</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Datum Layout mit Fälligkeitsbadge in einer Zeile und Wiederholungsbadge darunter */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                        {/* Obere Zeile: Datum + Fälligkeitsbadge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <FiCalendar size={12} style={{ color: 'var(--text-secondary)' }} />
                          <span style={{ color: 'var(--text)' }}>
                            {(() => {
                              // Datumsanzeige mit korrekter Zeitzone
                              let dateValue = task.dueDate || task.due_date;
                              let dateObj = null;
                              
                              if (dateValue) {
                                try {
                                  
                                  // WICHTIG: ISO-Format für Datum verwenden, garantiert UTC-Interpretation
                                  // ohne Zeitverschiebung durch Zeitzone (Problem war UTC vs lokale Zeit)
                                  const isoDateString = `${dateValue}T12:00:00Z`;
                                  
                                  // Direkte Konstruktion des Datums ohne Zeitverschiebungen
                                  const parts = dateValue.split('-');
                                  if (parts.length === 3) {
                                    const year = parseInt(parts[0]);
                                    const month = parseInt(parts[1]) - 1; // Monate sind 0-basiert in JS
                                    const day = parseInt(parts[2]);
                                    
                                    // Das +1 korrigiert den Zeitzonenfehler - stellt sicher, dass der Tag stimmt
                                    dateObj = new Date(Date.UTC(year, month, day + 0));
                                  }
                                  
                                  if (isNaN(dateObj.getTime())) dateObj = null;
                                } catch (e) {
                                  console.error('Fehler beim Parsen des Datums:', e);
                                }
                              }
                              
                              return dateObj
                                ? dateObj.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})
                                : 'Kein Datum';
                            })()}
                          </span>
                        </div>
                        
                        {/* Untere Zeile: Fälligkeits- und Wiederholungsbadges nebeneinander */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                          {/* Status der Fälligkeit im Badge-Stil anzeigen - jetzt links vom Wiederholungsbadge */}
                          {(() => {
                            let dateValue = task.dueDate || task.due_date;
                            if (!dateValue || task.isDone) return null;
                            
                            // Datum ohne Zeitanteil parsen
                            const parts = dateValue.split('-');
                            if (parts.length !== 3) return null;
                            
                            const year = parseInt(parts[0]);
                            const month = parseInt(parts[1]) - 1;
                            const day = parseInt(parts[2]);
                            const dueDate = new Date(year, month, day);
                            
                            // Aktuelle Zeit (nur Datumsteil)
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            // Differenz in Tagen
                            const diffTime = dueDate.getTime() - today.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                            
                            // Farbe und Text basierend auf der Differenz
                            let color, text, bgColor, icon;
                            
                            if (diffDays < 0) {
                              // Überfällig
                              color = 'var(--error)';
                              bgColor = 'rgba(var(--primary-rgb), 0.08)';
                              
                              // Berechne Punktabzug basierend auf Überfälligkeitsdauer relativ zum Aufgabenintervall
                              let pointsReduction = 0;
                              const daysOverdue = Math.abs(diffDays);
                              
                              // Intervall-basierte Berechnung des Punktabzugs
                              let intervalDays = 7; // Standard: 7 Tage
                              
                              // Ermittle das tatsächliche Intervall der Aufgabe
                              if (task.interval_type === 'daily' || task.intervalType === 'daily') {
                                intervalDays = 1 * (task.interval_value || 1);
                              } else if (task.interval_type === 'weekly' || task.intervalType === 'weekly') {
                                intervalDays = 7 * (task.interval_value || 1);
                              } else if (task.interval_type === 'monthly' || task.intervalType === 'monthly') {
                                intervalDays = 30 * (task.interval_value || 1);
                              } else if (task.interval_type === 'custom') {
                                // Für benutzerdefinierte Intervalle nehmen wir den interval_value als Tage
                                intervalDays = task.interval_value || 7;
                              }
                              
                              // Intervallwert berücksichtigen (z.B. alle 2 Wochen = 14 Tage)
                              const intervalValue = task.interval_value || task.intervalValue || 1;
                              intervalDays *= intervalValue;
                              
                              // Je länger überfällig relativ zum Intervall, desto mehr Punktabzug (max 50%)
                              // Bei Überfälligkeit volle Punktzahl erst bei Erreichen des gesamten Intervalls abziehen
                              // Linear skalierend von 0% bei 0 Tagen bis 50% bei intervalDays Tagen
                              // Bei weekly (7 Tage): 0 Tage = 0%, 3.5 Tage = 25%, 7 Tage = 50%
                              pointsReduction = (daysOverdue / intervalDays) * 0.5;
                              
                              // Auf max 50% begrenzen (z.B. bei starker Überfälligkeit)
                              pointsReduction = Math.min(0.5, pointsReduction);
                              
                              // Auf Prozent umrechnen (0.1 = 10%) und auf ganze Zahlen runden
                              const percentReduction = Math.round(pointsReduction * 100);
                              
                              // WICHTIG: Reduzierte Punkte berechnen und am Task-Objekt speichern!
                              const originalPoints = task.points || task.points_awarded || 10;
                              const reducedPoints = Math.round(originalPoints * (1 - pointsReduction));
                              
                              // Speichere die berechneten Werte direkt am Task-Objekt für spätere Verwendung
                              task.pointsReduction = pointsReduction;
                              task.percentReduction = percentReduction;
                              task.originalPoints = originalPoints;
                              task.reducedPoints = reducedPoints;
                              
                              // Zeige, wie viele Tage überfällig und den Punkteabzug
                              text = `${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'Tag' : 'Tage'} überfällig`;
                              
                              // Debug-Log-Ausgaben, um die Berechnung nachzuvollziehen
                              console.log(`Punkteabzug für Aufgabe '${task.title}':`, {
                                originalPoints,
                                reducedPoints,
                                daysOverdue,
                                intervalDays,
                                ratio: daysOverdue / intervalDays, 
                                pointsReduction: pointsReduction.toFixed(2),
                                percentReduction
                              });
                              
                              icon = <FiClock size={12} style={{ marginRight: '4px' }} />;
                            } else if (diffDays === 0) {
                              // Heute fällig
                              color = 'var(--warning)';
                              bgColor = 'rgba(var(--primary-rgb), 0.08)';
                              text = 'Heute fällig';
                              icon = <FiClock size={12} />;
                            } else if (diffDays === 1) {
                              // Morgen fällig
                              color = 'var(--warning)';
                              bgColor = 'rgba(var(--primary-rgb), 0.08)';
                              text = 'Morgen fällig';
                              icon = <FiClock size={12} />;
                            } else if (diffDays <= 3) {
                              // In nächsten 3 Tagen fällig
                              color = 'var(--primary)';
                              bgColor = 'rgba(var(--primary-rgb), 0.08)';
                              text = `In ${diffDays} Tagen fällig`;
                              icon = <FiClock size={12} />;
                            } else {
                              // Später fällig
                              color = 'var(--text-secondary)';
                              bgColor = 'rgba(var(--primary-rgb), 0.08)';
                              text = `In ${diffDays} Tagen fällig`;
                              icon = <FiClock size={12} />;
                            }
                            
                            return (
                              <div style={{
                                background: bgColor,
                                padding: '3px 8px',
                                borderRadius: 'var(--button-radius)',
                                fontSize: '11px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: color,
                                width: 'fit-content',
                                fontWeight: '600',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                              }}>
                                {icon}
                                {text}
                              </div>
                            );
                          })()}
                          
                          {/* Wiederholungsbadge */}
                          {(task.isTemplate || task.repeat !== 'none' || task.is_recurring === 1 || task.interval_type || task.customInterval) && (
                            <div style={{
                              background: 'rgba(var(--primary-rgb), 0.08)',
                              padding: '3px 6px',
                              borderRadius: 'var(--button-radius)',
                              fontSize: '11px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              color: 'var(--primary)',
                              width: 'fit-content', // Nur so breit wie nötig
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                            }}>
                              <FiRepeat size={12} />
                              {(() => {
                                // Prüfe zunächst auf benutzerdefinierte Intervalle mit originaler Formatierung
                                if (task.customInterval) {
                                  return formatCustomInterval(task.customInterval);
                                }
                                
                                // Rekonstruiere benutzerdefinierte Intervalle aus interval_type und interval_value
                                if (task.interval_type === 'custom') {
                                  const intervalValue = task.interval_value || 1;
                                  // Formatiere einen rekonstruierten String im Format 'Xd' (X Tage)
                                  return `Alle ${intervalValue} Tage`;
                                }
                                
                                // Standardintervalle basierend auf interval_type
                                if (task.interval_type === 'daily') {
                                  const days = task.interval_value || 1;
                                  return days === 1 ? 'Täglich' : `Alle ${days} Tage`;
                                }
                                if (task.interval_type === 'weekly') {
                                  const weeks = task.interval_value || 1;
                                  return weeks === 1 ? 'Wöchentlich' : `Alle ${weeks} Wochen`;
                                }
                                if (task.interval_type === 'monthly') {
                                  const months = task.interval_value || 1;
                                  return months === 1 ? 'Monatlich' : `Alle ${months} Monate`;
                                }
                                if (task.interval_type === 'monthly_days') {
                                  // Für spezifische Tage im Monat setzen wir einen Fallback-Text
                                  return 'An bestimmten Tagen des Monats';
                                }
                                
                                // Legacy-Logik für ältere Datensätze
                                if (task.repeat === 'daily') return 'Täglich';
                                if (task.repeat === 'weekly') return 'Wöchentlich';
                                if (task.repeat === 'biweekly') return 'Alle 2 Wochen';
                                if (task.repeat === 'monthly') return 'Monatlich';
                                if (task.repeat === 'custom' && task.customInterval) {
                                  return formatCustomInterval(task.customInterval);
                                }
                                
                                // Fallback für nicht kategorisierbare wiederkehrende Aufgaben
                                if (task.is_recurring === 1) return 'Wiederkehrend';
                                
                                // Standardfall
                                return 'Einmalig';
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Nur Punkte mit Stern-Icon */}
                      {/* Punkteanzeige wurde entfernt und befindet sich jetzt nur noch als absolut positioniertes Element oben rechts */}
                    </div>
                    
                    {/* Verlauf (falls vorhanden) */}
                    {task.history && task.history.length > 0 && (
                      <details className="task-history-details" style={{ marginTop: '12px' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          Verlauf ({task.history.length} {task.history.length === 1 ? 'Eintrag' : 'Einträge'})
                        </summary>
                        {renderTaskHistory(task)}
                      </details>
                    )}
                  </div>
                  </div>
              ))}
            </div>
          )
        ) : (
          <div className="calendar-view">
            <div className="calendar-header">
              <button className="button secondary small" onClick={() => changeTimeFrame(-1)}>
                &lt;
              </button>
              <h3>
                {calendarViewType === 'week' 
                  ? `${currentWeekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} - ${new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })
                }
              </h3>
              <button className="button secondary small" onClick={() => changeTimeFrame(1)}>
                &gt;
              </button>
            </div>
            
            <div className="calendar-view-toggle" style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              margin: '10px 0 15px 0'
            }}>
              <button 
                className={`view-toggle-button ${calendarViewType === 'week' ? 'active' : ''}`}
                onClick={() => setCalendarViewType('week')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  background: calendarViewType === 'week' ? 'var(--primary)' : 'transparent',
                  color: calendarViewType === 'week' ? 'white' : 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Woche
              </button>
              <button 
                className={`view-toggle-button ${calendarViewType === 'month' ? 'active' : ''}`}
                onClick={() => setCalendarViewType('month')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  background: calendarViewType === 'month' ? 'var(--primary)' : 'transparent',
                  color: calendarViewType === 'month' ? 'white' : 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Monat
              </button>
            </div>
            
            <div className="calendar-weekdays">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Zusätzlicher Div am Ende des Containers für Abstand zur Navbar */}
      <div style={{ marginBottom: '120px' }}></div>

      {/* Modal zur Auswahl zwischen Template und Instance ist nicht mehr notwendig, da wir direkt zum einheitlichen Bearbeitungsmodus wechseln */}
      {/* Falls showEditTypeModal noch irgendwo aufgerufen wird, leiten wir es direkt zur vereinheitlichten Bearbeitungsfunktion weiter */}
      {showEditTypeModal && taskToEdit && (() => {
        // Das Modal soll nicht mehr angezeigt werden, stattdessen rufen wir direkt die einheitliche Bearbeitungsfunktion auf
        setTimeout(() => {
          handleEditTask(taskToEdit);
          setShowEditTypeModal(false);
          setTaskToEdit(null);
        }, 0);
        
        // Nichts anzeigen
        return null;
      })()}

      {/* Bestätigungsdialog für Aktionen (Übernehmen, Löschen) - im Stil der App */}
      {currentTaskAction && createPortal(
        <div className="fullscreen-menu fadeIn fullscreen-modal" style={{ zIndex: 1000 }}>
          <div className="fullscreen-menu-content modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>
                {currentTaskAction.type === 'delete' ? 'Aufgabe löschen' : 
                 currentTaskAction.type === 'takeover' ? 'Aufgabe übernehmen' : 
                 currentTaskAction.type === 'completeForOther' ? 'Fremde Aufgabe erledigen' : 'Bestätigung'}
              </h2>
              <button 
                className="icon-button" 
                onClick={() => setCurrentTaskAction(null)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div className="form-group">
              <div style={{ marginBottom: '16px' }}>
                <p style={{ marginBottom: '8px' }}>
                  {currentTaskAction.type === 'delete' 
                    ? <>Möchtest du die Aufgabe <strong>"{currentTaskAction.task.title}"</strong> wirklich löschen?</> 
                    : currentTaskAction.type === 'takeover' 
                    ? <>Möchtest du die Aufgabe <strong>"{currentTaskAction.task.title}"</strong> übernehmen?</>
                    : currentTaskAction.type === 'completeForOther'
                    ? <>Möchtest du die Aufgabe <strong>"{currentTaskAction.task.title}"</strong> für <strong>{currentTaskAction.task.assignedTo}</strong> erledigen?</>
                    : 'Bist du sicher?'}
                </p>
                
                {/* Zusätzliche Informationen für Fremde Aufgabe erledigen */}
                {currentTaskAction.type === 'completeForOther' && (
                  <div style={{
                    backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                    padding: '10px 15px',
                    borderRadius: 'var(--button-radius)',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ marginTop: 0, marginBottom: '5px', color: 'var(--text)' }}>
                      <FiInfo style={{ verticalAlign: 'middle', marginRight: '5px' }} /> <strong>Hinweis</strong>
                    </h4>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                      Diese Aktion wird die Aufgabe als erledigt markieren, obwohl sie {currentTaskAction.task.assignedTo} zugewiesen ist.
                    </p>
                  </div>
                )}
                
                {/* Zusätzliche Warnhinweise im verbesserten Format */}
                {currentTaskAction.type === 'delete' && (
                  <div style={{
                  }}>
                    {currentTaskAction.task.isDone ? (
                      // Bei erledigten Aufgaben
                      <div style={{
                        backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                        padding: '10px 15px',
                        borderRadius: 'var(--button-radius)',
                        marginBottom: '20px'
                      }}>
                        <h4 style={{ marginTop: 0, marginBottom: '5px', color: 'var(--text)' }}>
                          <FiInfo style={{ verticalAlign: 'middle', marginRight: '5px' }} /> <strong>Hinweis</strong>
                        </h4>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                          Dadurch werden auch die für diese Aufgabe vergebenen Punkte gelöscht.
                        </p>
                      </div>
                    ) : (
                      // Bei offenen Aufgaben
                      <div style={{
                        backgroundColor: 'rgba(var(--primary-rgb), 0.08)',
                        padding: '10px 15px',
                        borderRadius: 'var(--button-radius)',
                        marginBottom: '20px'
                      }}>
                        <h4 style={{ marginTop: 0, marginBottom: '5px', color: 'var(--text)' }}>
                          <FiInfo style={{ verticalAlign: 'middle', marginRight: '5px' }} /> <strong>Hinweis</strong>
                        </h4>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                        Nach dem löschen werden von dieser Aufgabe keine neuen Instanzen mehr erstellt.
                        </p>
                      </div>
                    )}
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--error)' }}>Das löschen einer Aufgabe kann nicht rückgängig gemacht werden.</p>
                  </div>
                )}
              </div>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: currentTaskAction.type === 'completeForOther' ? 'column' : 'row',
                gap: '8px', 
                marginTop: '20px',
                width: '100%'
              }}>
                {/* Standard Buttons (nebeneinander oder untereinander je nach Typ) */}
                <div style={{
                  display: 'flex', 
                  flexDirection: 'row',
                  gap: '8px', 
                  width: '100%'
                }}>
                  <button 
                    className="button secondary" 
                    onClick={() => setCurrentTaskAction(null)}
                    style={{
                      backgroundColor: 'var(--error)',
                      border: '1px solid var(--border-color)',
                      padding: '12px 0',
                      borderRadius: '8px',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      flex: 1,
                      minWidth: 0,
                      color: 'white',
                      textAlign: 'center'
                    }}
                  >
                    Abbrechen
                  </button>
                  
                  {/* Archivieren-Option nur bei offenen Aufgaben anzeigen */}
                  {currentTaskAction.type === 'delete' && !currentTaskAction.task.isDone && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setCurrentTaskAction(null);
                        // Hier die Funktion zum Archivieren aufrufen statt zum Löschen
                        toggleArchiveStatus(currentTaskAction.task.id);
                      }}
                      style={{
                        backgroundColor: 'var(--text-secondary)',
                        border: 'none',
                        padding: '12px 0',
                        borderRadius: '8px',
                        fontWeight: '500',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        color: 'white',
                        textAlign: 'center',
                        flex: 1
                      }}
                    >
                      Archivieren
                    </button>
                  )}
                  
                  <button
                    className={`button ${currentTaskAction.type === 'delete' ? 'danger' : 'primary'}`}
                    onClick={currentTaskAction.onConfirm}
                    style={{
                      backgroundColor: currentTaskAction.type === 'delete' ? 'var(--primary)' : 'var(--primary)',
                      color: 'white',
                      padding: '12px 0',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'center'
                    }}
                  >
                    {currentTaskAction.type === 'delete' ? 'Löschen' : 
                     currentTaskAction.type === 'takeover' ? 'Übernehmen' : 
                     currentTaskAction.type === 'completeForOther' ? `Für ${currentTaskAction.task.assignedTo} erledigen` : 'Bestätigen'}
                  </button>
                </div>
                
                {/* Zusätzlicher Button für 'completeForOther' */}
                {currentTaskAction.type === 'completeForOther' && (
                  <button
                    className="button secondary"
                    onClick={async () => {
                      try {
                        // Setze Loading-Status
                        setLoading(true);
                        
                        // Dialog schließen
                        setCurrentTaskAction(null);
                        
                        const task = currentTaskAction.task;
                        const apartmentId = selectedApartment?.id;
                        
                        if (!apartmentId) {
                          throw new Error('Keine Apartment-ID verfügbar');
                        }
                        
                        // 1. Aufgabe dem aktuellen Benutzer zuweisen
                        await taskService.updateTaskInstance(task.id, {
                          apartmentId: apartmentId,
                          assignedUserId: currentUser.id,
                          assignedToId: currentUser.id
                        });
                        
                        // 2. Aufgabe als erledigt markieren
                        if (task.isRecurring) {
                          // Bei wiederkehrenden Aufgaben das Neuzuweisungsmenü anzeigen
                          // Wichtig: Hier muss die Aufgabe bereits dem aktuellen Benutzer zugewiesen sein
                          setTaskToReassign({
                            ...task,
                            assignedTo: currentUser.name,
                            assignedToId: currentUser.id,
                            assignedUserId: currentUser.id
                          });
                          setReassignMenuVisible(true);
                        } else {
                          // Einmalige Aufgabe direkt als erledigt markieren
                          // Bei der 'Mir zuweisen und abhaken'-Option ist der aktuelle Benutzer auch derjenige, der die Aufgabe erledigt hat
                          await taskService.completeTaskInstance(task.id, apartmentId, null, currentUser.id);
                        }
                        
                        // Daten neu laden
                        await loadData();
                      } catch (error) {
                        console.error('Fehler beim Übernehmen und Erledigen:', error);
                        alert(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{
                      backgroundColor: 'var(--success)',
                      border: 'none',
                      padding: '12px 0',
                      marginTop: '8px',
                      borderRadius: '8px',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      color: 'white',
                      textAlign: 'center',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FiUserCheck size={18} style={{ marginRight: '8px' }} /> Mir zuweisen und abhaken
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      
    </div>
  );
};

export default CleaningSchedule;