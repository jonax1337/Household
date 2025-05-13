import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiPlus, FiUsers, FiCheckSquare, FiShoppingCart, FiDollarSign, FiCalendar, FiAward, FiMessageCircle, FiClock, FiStar, FiEdit, FiPaperclip, FiTrendingUp, FiBookmark, FiCheckCircle, FiPlusCircle, FiImage, FiBell } from 'react-icons/fi';
import CreateApartment from './CreateApartment';
import JoinApartment from './JoinApartment';
// NotificationPrompt wurde in die Settings-Seite verschoben
import { registerServiceWorker } from '../serviceWorkerRegistration';
import dashboardService from '../services/dashboardService';
import taskService from '../services/taskService';

const Dashboard = ({ 
  apartments, 
  setApartments, 
  selectedApartment, 
  setSelectedApartment,
  loadUserApartments,
  handleAddApartment,
  handleJoinApartment,
  handleLogout
}) => {
  // Router-Hooks
  const navigate = useNavigate();
  const location = useLocation();
  
  // Lokaler State
  const [showApartmentMenu, setShowApartmentMenu] = useState(false);
  const [showJoinApartmentModal, setShowJoinApartmentModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [notificationStatus, setNotificationStatus] = useState(null);
  
  // Dashboard-Daten
  const [userRanking, setUserRanking] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Wohnung automatisch auswählen, wenn vorhanden
  useEffect(() => {
    if (apartments.length > 0 && !selectedApartment) {
      setSelectedApartment(apartments[0]);
    }
  }, [apartments, selectedApartment, setSelectedApartment]);
  
  // Nach Benachrichtigungserlaubnis fragen, NACHDEM der Benutzer sich angemeldet hat
  useEffect(() => {
    // Nur ausführen, wenn der Benutzer bereits angemeldet ist und Apartments geladen wurden
    // Dies stellt sicher, dass wir nach der Authentifizierung sind
    const requestNotificationPermission = async () => {
      // Nur fragen, wenn die Berechtigung noch nicht erteilt oder verweigert wurde
      if (('Notification' in window) && Notification.permission === 'default') {
        console.log('Frage nach Benachrichtigungsberechtigung nach erfolgreicher Anmeldung...');
        
        try {
          // Kurze Verzögerung, damit die Benutzeroberfläche zuerst geladen wird
          setTimeout(async () => {
            const permission = await Notification.requestPermission();
            console.log('Benachtigungsberechtigung:', permission);
            setNotificationStatus(permission);
            
            // Bei Erfolg Push abonnieren
            if (permission === 'granted') {
              try {
                const notificationService = (await import('../services/notificationService')).default;
                // Wenn ein Apartment ausgewählt ist, verwende dessen ID
                const apartmentId = selectedApartment ? selectedApartment.id : null;
                await notificationService.subscribeToPush(apartmentId);
                console.log('Push-Benachrichtigungen erfolgreich abonniert');
              } catch (subError) {
                console.warn('Konnte Push nicht abonnieren:', subError);
              }
            }
          }, 1500); // 1,5 Sekunden Verzögerung für bessere UX
        } catch (error) {
          console.error('Fehler bei der Benachrichtigungsanfrage:', error);
        }
      }
    };
    
    // Nur ausführen, wenn Apartments geladen wurden (Benutzer ist angemeldet)
    if (apartments.length > 0) {
      requestNotificationPermission();
    }
  }, [apartments, selectedApartment]);  // Abhängigkeit von apartments = wird erst nach Anmeldung ausgeführt
  
  // Dashboard-Daten laden, wenn sich das ausgewählte Apartment ändert
  useEffect(() => {
    // Daten nur laden, wenn ein Apartment ausgewählt ist
    if (!selectedApartment || !selectedApartment.id) return;
    
    const apartmentId = selectedApartment.id;
    setIsLoading(true);
    
    // Alle Dashboard-Daten parallel laden
    const loadDashboardData = async () => {
      try {
        console.log('Dashboard-Daten laden für Apartment:', apartmentId);
        
        // Bevorstehende Aufgaben laden (nächste 3 Tage)
        const tasksPromise = dashboardService.getUpcomingTasks(apartmentId, 3);
        
        // Benutzer-Rangliste laden
        // Falls der API-Endpunkt nicht existiert, verwenden wir eine Notlösung
        const rankingPromise = fetchUserRanking(apartmentId);
        
        // Aktivitäten laden
        // Falls der API-Endpunkt nicht existiert, verwenden wir eine Notlösung
        const activitiesPromise = fetchRecentActivities(apartmentId);
        
        // Warten auf alle Daten
        const [tasks, ranking, recentActivities] = await Promise.all([
          tasksPromise, rankingPromise, activitiesPromise
        ]);
        
        // Daten aktualisieren
        setUpcomingTasks(tasks);
        setUserRanking(ranking);
        setActivities(recentActivities);
      } catch (error) {
        console.error('Fehler beim Laden der Dashboard-Daten:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDashboardData();
  }, [selectedApartment]);
  
  // Hilfsfunktion zum Öffnen des Apartment-Menüs
  const openApartmentMenu = () => {
    setShowApartmentMenu(true);
  };
  
  // Hilfsfunktion: Benutzerdaten mit Punkten laden
  const fetchUserRanking = async (apartmentId) => {
    try {
      // Versuche zuerst, die offizielle API zu verwenden
      return await dashboardService.getUserRanking(apartmentId);
    } catch (error) {
      console.warn('Fallback für Benutzer-Rangliste:', error);
      
      // Fallback: Task-Instanzen laden und Punkte pro Benutzer berechnen
      try {
        const taskInstances = await taskService.getTaskInstances(apartmentId);
        const completedTasks = taskInstances.filter(task => task.status === 'erledigt');
        
        // Punkte pro Benutzer aggregieren
        const userPoints = {};
        completedTasks.forEach(task => {
          if (task.completedByUserId && task.pointsAwarded) {
            const userId = task.completedByUserId;
            userPoints[userId] = (userPoints[userId] || 0) + task.pointsAwarded;
          }
        });
        
        // Aktuellen Benutzer identifizieren
        const currentUserRaw = localStorage.getItem('currentUser');
        const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
        
        // Benutzer-Array erstellen
        return Object.entries(userPoints).map(([userId, points]) => ({
          id: parseInt(userId),
          name: completedTasks.find(t => t.completedByUserId === parseInt(userId))?.completedByName || 'Unbekannt',
          points,
          isCurrentUser: currentUser && currentUser.id === parseInt(userId)
        })).sort((a, b) => b.points - a.points); // Nach Punkten absteigend sortieren
      } catch (fallbackError) {
        console.error('Auch Fallback fehlgeschlagen:', fallbackError);
        return []; // Leeres Array im Fehlerfall
      }
    }
  };
  
  // Hilfsfunktion: Aktivitäten laden
  const fetchRecentActivities = async (apartmentId) => {
    try {
      // Versuche zuerst, die offizielle API zu verwenden
      return await dashboardService.getRecentActivities(apartmentId);
    } catch (error) {
      console.warn('Fallback für Aktivitäten-Feed:', error);
      
      // Fallback: Generiere Aktivitäten basierend auf den Task-Instanzen
      try {
        const taskInstances = await taskService.getTaskInstances(apartmentId);
        const completedTasks = taskInstances.filter(task => task.status === 'erledigt' && task.completedAt)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 10); // Neueste 10 Aktivitäten
        
        return completedTasks.map((task, index) => ({
          id: task.id || index,
          type: 'task_completed',
          user: task.completedByName || 'Jemand',
          content: `hat "${task.title}" erledigt (+${task.pointsAwarded} Punkte)`,
          timestamp: task.completedAt,
          time: formatRelativeTime(new Date(task.completedAt)),
          icon: { type: 'task_completed', color: '#4CAF50' }
        }));
      } catch (fallbackError) {
        console.error('Auch Fallback fehlgeschlagen:', fallbackError);
        return []; // Leeres Array im Fehlerfall
      }
    }
  };
  
  // Hilfsfunktion: Formatiert einen Zeitstempel relativ zur aktuellen Zeit
  const formatRelativeTime = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'gerade eben';
    if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Minuten`;
    if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Stunden`;
    if (diffInSeconds < 172800) return 'gestern';
    if (diffInSeconds < 604800) return `vor ${Math.floor(diffInSeconds / 86400)} Tagen`;
    
    // Für ältere Einträge ein konkretes Datum zurückgeben
    return date.toLocaleDateString('de-DE');
  };

  // Service Worker und Benachrichtigungen registrieren
  useEffect(() => {
    // Service Worker registrieren
    const registerSW = async () => {
      try {
        // Service Worker für Push Notifications registrieren
        const registration = await registerServiceWorker();
        console.log('Service Worker erfolgreich registriert:', registration);
        
        // Benachrichtigungsstatus aktualisieren
        if ('Notification' in window) {
          setNotificationStatus(Notification.permission);
        }
      } catch (error) {
        console.error('Fehler bei der Service Worker Registrierung:', error);
      }
    };
    
    registerSW();
  }, []);

  return (
    <div className="container fadeIn">
      {/* Header mit Haupttitel - nur auf dem Dashboard */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>Household</h1>
        </div>
      </div>
      
      {/* Dialoge für Wohnungsverwaltung */}
      <CreateApartment
        isOpen={showApartmentMenu}
        onClose={() => setShowApartmentMenu(false)}
        onCreateApartment={async (name, address) => {
          try {
            await handleAddApartment(name, address);
            setShowApartmentMenu(false);
          } catch (error) {
            console.error('Fehler beim Erstellen der Wohnung:', error);
            throw error;
          }
        }}
      />
      
      <JoinApartment
        isOpen={showJoinApartmentModal}
        onClose={() => setShowJoinApartmentModal(false)}
        onJoinApartment={async (code) => {
          try {
            const joinedApartment = await handleJoinApartment(code);
            setShowJoinApartmentModal(false);
            await loadUserApartments();
            return joinedApartment;
          } catch (error) {
            throw error;
          }
        }}
      />
      
      
      {/* Dashboard-Inhalt */}
      {/* Keine Wohnung vorhanden */}
      {apartments.length === 0 ? (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <h2 style={{ marginBottom: '20px' }}>Willkommen in deiner Haushaltsverwaltung</h2>
              <p style={{ marginBottom: '25px', color: 'var(--text-secondary)' }}>
                Erstelle eine Wohnung oder tritt einer bestehenden Wohnung bei.
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <button
                  className="button primary"
                  onClick={openApartmentMenu}
                  style={{ padding: '10px 20px' }}
                >
                  <FiPlus size={18} style={{ marginRight: '8px' }} />
                  Neue Wohnung
                </button>
                
                <button
                  className="button secondary"
                  onClick={() => {
                    setInviteCode('');
                    setShowJoinApartmentModal(true);
                  }}
                  style={{ padding: '10px 20px' }}
                >
                  <FiUsers size={18} style={{ marginRight: '8px' }} />
                  Wohnung beitreten
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Wohnung vorhanden - Dashboard anzeigen */
          <>
            {/* Wohnungsinfo */}
            <div className="card">
              <h2 style={{ marginBottom: '8px' }}>{selectedApartment?.name || 'Keine Wohnung ausgewählt'}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{selectedApartment?.address || ''}</p>
            </div>
            
            <h2 style={{ marginBottom: '16px', fontSize: 'clamp(1.2rem, 3vw, 1.8rem)' }}>Übersicht</h2>
            
            {/* Hauptinhalt des Dashboards in einem Grid-Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '16px' }}>
              {/* Linke Spalte - Rangliste und bevorstehende Aufgaben */}
              <div className="dashboard-column">
                {/* Rangliste der Mitbewohner mit Punkten */}
                <div className="card" style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3><FiAward style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)', lineHeight: '0' }} /> Rangliste</h3>
                  </div>
                  
                  <div className="ranking-list">
                    {userRanking.length > 0 ? (
                      userRanking.map((user, index) => (
                        <div key={user.id} className="ranking-item" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          backgroundColor: user.isCurrentUser ? 'var(--bg-hover)' : 'transparent',
                          transition: 'all 0.2s ease',
                          cursor: 'default',
                          boxShadow: user.isCurrentUser ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                          transform: user.isCurrentUser ? 'translateY(-1px)' : 'none'
                        }}>
                          <div style={{ 
                            borderRadius: '50%', 
                            width: '24px', 
                            height: '24px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'var(--bg-secondary)',
                            marginRight: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: index <= 2 ? '#333' : 'var(--text-secondary)'
                          }}>
                            {index + 1}
                          </div>
                          <span style={{ flex: 1, fontWeight: user.isCurrentUser ? 'bold' : 'normal' }}>{user.name}</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{user.points} <FiStar size={14} style={{ verticalAlign: 'middle' }} /></span>
                        </div>
                      ))
                    ) : isLoading ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                        <p>Lade Daten...</p>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>
                        <p>Noch keine Mitbewohner in dieser Wohnung.</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Bevorstehende Aufgaben */}
                <div className="card" style={{ marginBottom: '0px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3><FiClock style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)', lineHeight: '0' }} /> Aufgaben</h3>
                    <Link to="/cleaning" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>Alle anzeigen</Link>
                  </div>
                  
                  <div className="upcoming-tasks">
                    {upcomingTasks.length > 0 ? (
                      upcomingTasks.map(task => {
                        // Prüfen, ob die Aufgabe dem aktuellen Benutzer zugewiesen ist
                        const currentUserRaw = localStorage.getItem('currentUser');
                        const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
                        const isAssignedToCurrentUser = currentUser && task.assignedToId === currentUser.id;
                        
                        // Relatives Datum berechnen (Heute, Morgen, etc.)
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const dayAfterTomorrow = new Date(today);
                        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
                        
                        const dueDate = new Date(task.dueDate);
                        dueDate.setHours(0, 0, 0, 0);
                        
                        let dateText = '';
                        if (dueDate.getTime() === today.getTime()) {
                          dateText = 'Heute';
                        } else if (dueDate.getTime() === tomorrow.getTime()) {
                          dateText = 'Morgen';
                        } else if (dueDate.getTime() === dayAfterTomorrow.getTime()) {
                          dateText = 'Übermorgen';
                        } else {
                          dateText = dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                        }
                        
                        // Anzeigename für die Zuweisung
                        const assignedToText = isAssignedToCurrentUser ? 'Du' : (task.assignedTo || 'Nicht zugewiesen');
                        
                        return (
                          <div 
                            key={task.id} 
                            className="task-item" 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              padding: '16px',
                              borderRadius: '8px',
                              marginBottom: '8px',
                              backgroundColor: 'var(--bg-secondary)',
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                            onClick={() => navigate('/cleaning')}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 3px 5px rgba(0,0,0,0.08)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                            }}
                          >
                            <div style={{ 
                              minWidth: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: isAssignedToCurrentUser ? 'var(--primary)' : 'var(--text-secondary)',
                              opacity: isAssignedToCurrentUser ? 1 : 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: '12px'
                            }}>
                              <FiCheckSquare size={16} color="white" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: isAssignedToCurrentUser ? 'bold' : 'normal' }}>{task.title}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {dateText} • {assignedToText} • {task.points} Punkte
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : isLoading ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                        <p>Lade Aufgaben...</p>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>
                        <p>Keine bevorstehenden Aufgaben in den nächsten 3 Tagen.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Rechte Spalte - Pinnwand und Aktivitäten-Feed */}
              <div className="dashboard-column">
                {/* Aktivitäten-Feed */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3><FiTrendingUp style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)', lineHeight: '0' }} /> Aktivitäten</h3>
                  </div>
                  
                  <div className="activity-feed" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {activities.length > 0 ? (
                      activities.map(activity => {
                        // Icon basierend auf dem Aktivitätstyp bestimmen
                        let icon;
                        console.log('Aktivitätstyp:', activity.type);
                        
                        switch (activity.type) {
                          case 'task_completed':
                            icon = <FiCheckCircle color='#4CAF50' />;
                            break;
                          case 'task_created':
                          case 'task_assigned':
                          case 'task_edited':
                            icon = <FiEdit color='#9C7CF4' />;
                            break;
                          case 'shopping_item_added': // Angepasst an unseren tatsächlichen Typ
                          case 'item_added': // Backward compatibility
                          case 'item_checked':
                          case 'shopping_list_created': // Angepasst an unseren tatsächlichen Typ
                          case 'list_completed':
                            icon = <FiShoppingCart color='#64CFF6' />;
                            break;
                          case 'financial_transaction_added': // Angepasst an unseren tatsächlichen Typ
                          case 'expense_added':
                          case 'payment_received':
                            icon = <FiDollarSign color='#4CAF50' />;
                            break;
                          case 'message':
                            icon = <FiMessageCircle color='#FF9554' />;
                            break;
                          default:
                            icon = <FiBookmark color='#9E9E9E' />;
                            console.log('Unbekannter Aktivitätstyp:', activity.type);
                        }

                        return (
                          <div 
                            key={activity.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              marginBottom: '16px',
                              padding: '8px',
                              borderRadius: '8px',
                              transition: 'background-color 0.2s ease',
                              cursor: 'default',
                              ':hover': { backgroundColor: 'var(--bg-hover)' }
                            }}
                          >
                            <div style={{ 
                              minWidth: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--bg-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: '12px'
                            }}>
                              {icon}
                            </div>
                            <div>
                              <div>
                                <span style={{ fontWeight: 'bold' }}>{activity.user}</span> {activity.content}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{activity.time}</div>
                            </div>
                          </div>
                        );
                      })
                    ) : isLoading ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                        <p>Lade Aktivitäten...</p>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>
                        <p>Noch keine Aktivitäten vorhanden.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      {/* Zusätzlicher Div am Ende des Containers für Abstand zur Navbar */}
      <div style={{ marginBottom: '96px' }}></div>
    </div>
  );
};

export default Dashboard;
