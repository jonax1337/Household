import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chatService, authService } from '../services/api';
import { FiSend, FiCheck, FiMessageCircle, FiAlertCircle, FiLock, FiMoreVertical, FiEdit2, FiRadio, FiTrash2, FiX } from 'react-icons/fi';
import NoApartmentSelected from './NoApartmentSelected';

// CSS-Stile für die Chat-Komponente
const styles = {
    // Header Styles
    stickyHeaderCard: {
      position: 'sticky',
      top: 'max(16px, env(safe-area-inset-top) + 16px)', // Berücksichtigt Safe Area für Geräte mit Notches
      zIndex: 10,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 'var(--card-radius)',
      border: 'var(--glass-border)',
      background: 'var(--card-background)',
      boxShadow: 'var(--shadow)',
      transition: '0.3s',
    },
    headerContent: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      gap: '8px'
    },
    headerTitle: {
      margin: 0,
      fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
      fontWeight: 'bold',
      color: 'var(--text-primary)'
    },
  container: {
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
    // Containerbreite wird durch die übergeordnete 'card' Klasse gesteuert (mit max-width im globalen CSS)
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  titleIcon: {
    color: 'var(--primary)',
    marginRight: '8px'
  },
  messageContainer: {
    flex: 1, // Füllt den verfügbaren Platz im Card-Container aus
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--background-primary)',
    minHeight: '300px' // Erhöhte Mindesthhöhe für bessere Darstellung auf allen Geräten
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden', // Horizontales Scrollen verhindern
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-primary)',
    backgroundImage: 'linear-gradient(rgba(var(--background-rgb), 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--background-rgb), 0.03) 1px, transparent 1px)',
    backgroundSize: '20px 20px', // Subtiles Rastermuster fu00fcr mehr Chat-Feeling
    width: '100%'
  },
  // Gemeinsame Grundstile fu00fcr alle Nachrichtenblasen
  messageCard: {
    padding: '8px 16px',
    marginBottom: '16px', // Mehr Abstand zwischen Nachrichtengruppen
    maxWidth: '70%', // Etwas schmalere Blasen für mehr Platz
    width: 'auto', // Automatische Anpassung an den Inhalt
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
    transition: 'all 0.2s ease',
    position: 'relative', // Fu00fcr die Avatars
    wordBreak: 'break-word', // Verhindert Überlauf bei langen Wörtern
    overflowWrap: 'break-word'
  },
  myMessage: {
    marginLeft: 'auto',
    marginRight: '52px', // Platz für Avatar rechts
    backgroundColor: 'var(--primary-gradient, var(--primary))', // Gradient falls verfügbar, sonst normale Farbe
    color: 'white',
    borderRadius: '16px 16px 4px 16px', // Modernere Blasenform
    alignSelf: 'flex-end', // Rechtsbu00fcndig
    paddingRight: '8px', // Mehr Platz auf der rechten Seite der Blase
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)' // Subtiler Schatten für mehr Tiefe
  },
  otherMessage: {
    marginRight: 'auto',
    marginLeft: '48px', // Platz fu00fcr Avatar links
    backgroundColor: 'var(--primary-transparent, rgba(96, 92, 255, 0.08))', // Gleicher Hintergrund wie das Verschlüsselungs-Badge
    color: 'var(--text-primary)',
    borderRadius: '16px 16px 16px 4px', // Modernere Blasenform
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', // Noch subtilerer Schatten wie beim Badge
    alignSelf: 'flex-start', // Linksbu00fcndig
    border: 'none' // Keine Rahmen mehr, da wir jetzt den subtilen Hintergrund haben
  },
  // Avatar-Styling
  avatar: {
    width: '36px', // Etwas kleiner
    height: '36px', // Etwas kleiner
    borderRadius: '50%',
    position: 'absolute',
    bottom: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px', // Etwas kleinere Schrift
    fontWeight: 'bold',
    color: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: 10 // Damit der Avatar über anderen Elementen liegt
  },
  myAvatar: {
    right: '-45px', // Rechts neben der Nachricht, symmetrisch zur linken Seite
  },
  otherAvatar: {
    left: '-45px', // Links neben der Nachricht
  },
  messageSender: {
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '3px',
    color: 'var(--text-secondary)'
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '1.4',
    wordBreak: 'break-word',
    maxWidth: '100%' // Verhindert Overflow
  },
  messageMeta: {
    fontSize: '10.5px', // Noch etwas kleinere Schrift
    color: 'var(--text-secondary)',
    marginTop: '4px', // Etwas weniger Abstand zum Inhalt
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end' // Rechtsbündig für eigene Nachrichten
  },
  inputContainer: {
    padding: '8px 16px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    position: 'sticky',
    bottom: 0,
    zIndex: 10
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
    width: '100%'
  },
  input: {
    flex: 1,
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none', // Entferne die Border
    backgroundColor: 'var(--bg-secondary)',
    fontSize: '14px',
    color: 'var(--text-primary)'
  },
  sendButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease'
  },
  dateHeader: {
    textAlign: 'center',
    margin: '15px 0',
    position: 'relative'
  },
  dateHeaderContent: {
    display: 'inline-block',
    backgroundColor: 'var(--bg-secondary)',
    padding: '5px 15px',
    borderRadius: '15px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginRight: '8px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '5px'
  },
  actionButton: {
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease'
  },
  actionButtonHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 3px 5px rgba(0,0,0,0.15)'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px 20px',
    textAlign: 'center'
  },
  // 'User tippt...' Anzeige
  typingIndicator: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    padding: '5px 10px',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  typingDots: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px'
  },
  typingDot: {
    width: '4px',
    height: '4px',
    backgroundColor: 'var(--text-secondary)',
    borderRadius: '50%',
    opacity: 0.7,
    animation: 'typingAnimation 1.4s infinite ease-in-out'
  }
};

const Chat = ({ apartmentId }) => {
  // Refs für Tooltip-Handling
  const encryptionBadgeRef = useRef(null);
  const tooltipMountedRef = useRef(false);
  
  // State mit explizitem Initialwert false
  const [tooltipVisible, setTooltipVisible] = useState(false);
  
  // State für Nachrichten
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const animatingMessagesRef = useRef({});
  
  // States fu00fcr Nachrichtenbearbeitung und -lu00f6schung
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  
  // State fu00fcr Touch-Events (Long Press auf Mobilgeru00e4ten)
  const [touchTimer, setTouchTimer] = useState(null);
  const [isTouching, setIsTouching] = useState(false);
  
  // Event-Listener zum Schließen des Menüs beim Klicken außerhalb
  useEffect(() => {
    // Handler, der das aktive Menü schließt, wenn irgendwo auf das Dokument geklickt wird
    const handleClickOutside = () => {
      if (activeMessageMenu !== null) {
        setActiveMessageMenu(null);
      }
    };
    
    // Event-Listener zum Dokument hinzufügen
    document.addEventListener('click', handleClickOutside);
    
    // Aufräumen beim Unmounten der Komponente
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeMessageMenu]); // Nur neu einrichten, wenn sich activeMessageMenu ändert

  // Socket.io für Live-Messaging verwenden
  useEffect(() => {
    if (apartmentId) {
      // Socket-Verbindung überwachen
      const socket = chatService.getSocket();
      
      // Verbindungsstatus aktualisieren
      const handleConnect = () => setSocketConnected(true);
      const handleDisconnect = () => setSocketConnected(false);
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      
      // Status beim Start setzen
      setSocketConnected(socket.connected);
      
      // Apartment-Chat beitreten
      chatService.joinApartmentChat(apartmentId);
      
      // Event-Listener für 'User tippt...'
      const onUserTyping = (data) => {
        if (parseInt(data.userId) !== parseInt(currentUser?.id || 0)) {
          // Setze den Benutzer als tippend und starte einen Timeout
          setTypingUsers(prev => ({
            ...prev,
            [data.userId]: {
              name: data.userName || `Benutzer ${data.userId}`,
              timestamp: Date.now()
            }
          }));
          
          // Entferne den 'tippend'-Status nach 3 Sekunden
          setTimeout(() => {
            setTypingUsers(prev => {
              const newState = { ...prev };
              delete newState[data.userId];
              return newState;
            });
          }, 3000);
        }
      };
      
      // Socket.io-Event für 'User tippt' registrieren
      chatService.onUserTyping(onUserTyping);
      
      // Event-Listener für neue Nachrichten
      const unsubscribe = chatService.onNewMessage((newMessage) => {
        setMessages(prevMessages => {
          // Vereinfachte Duplikatprüfung: Nur ID-basiert
          // Ermöglicht identische Nachrichten, solange sie unterschiedliche IDs haben
          const messageExists = prevMessages.some(msg => 
            // Vergleich von numerischer und String-ID, um Typkonvertierungsprobleme zu vermeiden
            msg.id === newMessage.id || String(msg.id) === String(newMessage.id)
          );
          
          if (messageExists) {
            console.log(`%c[CHAT] Nachricht mit ID ${newMessage.id} existiert bereits, wird nicht hinzugefügt`, 'color: #aa6600;');
            return prevMessages;
          }
          
          // Log für neue Nachricht hinzufügen
          console.log(`%c[CHAT] Neue Nachricht empfangen:`, 'color: #00aa66;', newMessage);
          
          // Neue Nachricht hinzufügen und nach Datum sortieren
          const updatedMessages = [...prevMessages, newMessage].sort((a, b) => 
            new Date(a.created_at || 0) - new Date(b.created_at || 0)
          );
          
          setLastUpdate(new Date());
          return updatedMessages;
        });
      });
      
      // Event-Listener für Fehler
      const unsubscribeError = chatService.onError((error) => {
        console.error('Chat-Fehler:', error);
        // Hier könntest du eine Fehleranzeige implementieren
      });
      
      // Event-Listener für gelöschte Nachrichten (mit Animation)
      const unsubscribeMessageDeleted = chatService.onMessageDeleted((data) => {
        if (data && data.messageId) {
          console.log(`%c[CHAT] Nachricht ${data.messageId} wurde gelöscht`, 'color: #ff6600;');
          
          // Finde die zu löschende Nachricht in der aktuellen Liste
          const messageToDelete = document.getElementById(`message-${data.messageId}`);
          
          if (messageToDelete) {
            // Nachricht gefunden - Animation starten
            console.log(`%c[CHAT] Starte Lösch-Animation für Nachricht ${data.messageId}`, 'color: #ff6600;');
            
            // Markiere diese Nachricht als "wird animiert"
            animatingMessagesRef.current[data.messageId] = true;
            
            // Sanfte Animation für das Löschen
            messageToDelete.style.transition = 'all 0.4s ease-out';
            messageToDelete.style.overflow = 'hidden';
            messageToDelete.style.opacity = '0';
            messageToDelete.style.maxHeight = `${messageToDelete.offsetHeight}px`;
            messageToDelete.style.transform = 'translateX(-10px)';
            
            // Nach kurzer Verzögerung die Höhe auf 0 animieren
            setTimeout(() => {
              if (messageToDelete) {
                messageToDelete.style.maxHeight = '0';
                messageToDelete.style.marginTop = '0';
                messageToDelete.style.marginBottom = '0';
                messageToDelete.style.paddingTop = '0';
                messageToDelete.style.paddingBottom = '0';
              }
            }, 50);
            
            // Nachricht aus dem State entfernen, nachdem die Animation abgeschlossen ist
            setTimeout(() => {
              delete animatingMessagesRef.current[data.messageId];
              
              setMessages(prevMessages => {
                const filteredMessages = prevMessages.filter(msg => {
                  // Prüfe auf numerische und String-ID-Gleichheit
                  return msg.id !== data.messageId && String(msg.id) !== String(data.messageId);
                });
                
                const removedCount = prevMessages.length - filteredMessages.length;
                if (removedCount > 0) {
                  console.log(`%c[CHAT] ${removedCount} Nachricht(en) aus dem State entfernt`, 'color: #ff6600;');
                }
                
                return filteredMessages;
              });
            }, 400); // Etwas länger als die Animations-Dauer
          } else {
            // Nachricht nicht im DOM gefunden - direkt aus dem State entfernen
            console.log(`%c[CHAT] Nachricht ${data.messageId} nicht im DOM gefunden, entferne direkt`, 'color: #ff6600;');
            
            setMessages(prevMessages => prevMessages.filter(msg => 
              msg.id !== data.messageId && String(msg.id) !== String(data.messageId)
            ));
          }
        }
      });
      
      // Cleanup-Funktion
      return () => {
        // Socket-Listeners entfernen
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        unsubscribe();
        unsubscribeError();
        unsubscribeMessageDeleted();
        // Typing listener entfernen
        chatService.offUserTyping(onUserTyping);
      };
    }
  }, [apartmentId]);
  
  // Initialen Nachrichten laden
  useEffect(() => {
    if (apartmentId) {
      loadMessages();
    }
  }, [apartmentId]);
  
  // Aktuellen Benutzer laden
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Erst versuchen, den Benutzer aus dem localStorage zu holen
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            console.log('Benutzer aus localStorage geladen:', user);
          } catch (e) {
            console.error('Fehler beim Parsen des gespeicherten Benutzers:', e);
          }
        } else {
          // Fallback: Benutzer von der API holen
          const user = await authService.getCurrentUser();
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Fehler beim Abrufen des aktuellen Benutzers:', error);
      }
    };
    
    fetchCurrentUser();
  }, []);
  
  // State für Paging und Scroll-Position
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [userScrollPosition, setUserScrollPosition] = useState(0);
  const messagesContainerRef = useRef(null);
  
  // Scroll zum Ende der Nachrichten - nur wenn nötig
  const scrollToBottom = (force = false) => {
    if (shouldScrollToBottom || force) {
      messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
    }
  };
  
  // Beim ersten Laden und bei neuen Nachrichten automatisch scrollen
  useEffect(() => {
    // Beim ersten Laden oder wenn explizit gefordert: komplett ans Ende scrollen
    if (isInitialLoad && messages.length > 0) {
      // Mit kurzer Verzögerung scrollen, damit das Rendern abgeschlossen ist
      setTimeout(() => {
        scrollToBottom(true); // Force-Parameter = true für sofortiges Scrollen
        setIsInitialLoad(false);
      }, 100);
    } 
    // Bei neuen Nachrichten nur scrollen, wenn der Nutzer bereits unten war
    else if (shouldScrollToBottom && !isInitialLoad) {
      scrollToBottom();
    }
  }, [messages.length, isInitialLoad]);
  
  // Scroll-Handler zum Nachladen von Nachrichten
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    
    // Aktuelle Scroll-Position speichern
    setUserScrollPosition(scrollTop);
    
    // Prüfen, ob wir am Ende des Chats sind (oder nahe dran)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldScrollToBottom(isNearBottom);
    
    // Nachladen, wenn wir nahe am Anfang sind (nach oben scrollen)
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  };
  
  // Mehr Nachrichten laden, wenn der Nutzer nach oben scrollt
  const loadMoreMessages = async () => {
    if (!hasMoreMessages || isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      // Speichere die aktuelle Scroll-Position und Höhe
      const scrollContainer = messagesContainerRef.current;
      const scrollHeight = scrollContainer?.scrollHeight || 0;
      
      // Hole mehr Nachrichten vom Server
      const olderMessages = await chatService.getMessagesByPage(apartmentId, currentPage + 1);
      
      if (olderMessages && olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setCurrentPage(prev => prev + 1);
        
        // Nach dem Rendern Scroll-Position wiederherstellen
        setTimeout(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const scrollDiff = newScrollHeight - scrollHeight;
            scrollContainer.scrollTop = scrollDiff;
          }
          setIsLoadingMore(false);
        }, 50);
      } else {
        setHasMoreMessages(false);
        setIsLoadingMore(false);
      }
    } catch (error) {
      console.error('Fehler beim Laden weiterer Nachrichten:', error);
      setIsLoadingMore(false);
    }
  };
  
  // Formatiere Zeit seit letztem Update
  const formatTimeSinceLastUpdate = () => {
    if (!socketConnected) return 'Keine Live-Verbindung';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - lastUpdate) / 1000);
    
    if (diffInSeconds < 5) return 'Live - Gerade aktualisiert';
    if (diffInSeconds < 60) return `Live - Letzte Nachricht vor ${diffInSeconds} Sekunden`;
    
    const minutes = Math.floor(diffInSeconds / 60);
    return `Live - Letzte Nachricht vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
  };
  
  // Nachrichten laden
  const loadMessages = async () => {
    try {
      const data = await chatService.getMessages(apartmentId);
      if (JSON.stringify(data) !== JSON.stringify(messages)) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Nachrichten:', error);
      // Keine Aktion bei Fehler notwendig, da wir Socket.io verwenden
      // und keine Polling-Mechanismen mehr 
    }
  };
  
  // Socket.io-Verbindung manuell neu verbinden
  const reconnectSocket = () => {
    const socket = chatService.getSocket();
    if (!socket.connected) {
      socket.connect();
      loadMessages(); // Nachrichten neu laden
    }
  };
  
  // Beim Tippen ein Ereignis auslösen
  const handleTyping = () => {
    if (!socketConnected) return;
    
    // Throttle-Mechanismus: nur alle 2 Sekunden ein Typing-Event senden
    if (typingTimeoutRef.current) return;
    
    // Sende Typing-Event
    chatService.sendTyping(apartmentId, currentUser?.id, currentUser?.name);
    
    // Setze einen Timeout, damit nicht zu viele Events gesendet werden
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };
  
  // Nachricht senden - ohne temporäre Vorschau-Nachrichten
  const handleSendMessage = async () => {
    try {
      if (!newMessage.trim()) return;
      
      // UI-Feedback: Nachrichtenfeld leeren und ggf. Ladeindikator anzeigen
      const messageToSend = newMessage.trim();
      setNewMessage('');
      
      // Status-Anzeige für das Senden
      console.log('%c[CHAT] Sende Nachricht...', 'color: #0066aa;');
      
      // Auf Bestätigung vom Server warten, um die tatsächliche Nachricht anzuzeigen
      const confirmedMessage = await chatService.sendMessage(apartmentId, messageToSend);
      
      console.log('%c[CHAT] Nachricht bestätigt vom Server:', 'color: #00aa66;', confirmedMessage);
      
      // Wir müssen die Nachricht NICHT manuell zur Liste hinzufügen,
      // da der Socket.io-Event-Handler im useEffect sie bereits hinzugefügt hat
      // während das Promise aufgelöst wurde
      
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
      // Hier könnte eine Fehleranzeige oder Wiederherstellung der Nachricht im Eingabefeld erfolgen
      setNewMessage(messageToSend); // Eingabe wiederherstellen bei Fehler
    }
  };
  
  // Formatiere Datum
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Prüfe, ob das Datum gültig ist
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Gerade eben';
    }
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const options = { hour: '2-digit', minute: '2-digit' };
    
    if (isToday) {
      return date.toLocaleTimeString('de-DE', options);
    } else if (isYesterday) {
      return `Gestern, ${date.toLocaleTimeString('de-DE', options)}`;
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };
  
  // Handler für Long Press (für Mobilgeräte)
  const handleTouchStart = (message) => {
    // Nur eigene Nachrichten können bearbeitet/gelöscht werden
    if (parseInt(message.user_id) !== parseInt(currentUser?.id || 0)) return;
    
    const timer = setTimeout(() => {
      setIsTouching(false);
      setActiveMessageMenu(message.id);
    }, 500); // 500ms für Long Press
    
    setTouchTimer(timer);
    setIsTouching(true);
  };
  
  const handleTouchEnd = () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }
    setIsTouching(false);
  };
  
  const handleTouchMove = () => {
    // Cancel Long Press wenn der Finger bewegt wird
    handleTouchEnd();
  };
  
  // Nachrichten-Aktionen
  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditContent(message.content);
    setActiveMessageMenu(null);
  };
  
  const handleSaveEdit = () => {
    if (!editingMessage || !editContent.trim()) return;
    
    // Optimistische UI-Aktualisierung
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === editingMessage.id 
          ? { ...msg, content: editContent, edited: true } 
          : msg
      )
    );
    
    // TODO: API-Call zum Speichern der Änderung implementieren
    // chatService.updateMessage(editingMessage.id, editContent)...
    
    setEditingMessage(null);
    setEditContent('');
  };
  
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };
  
  // Funktion zum Animieren des Löschvorgangs (für alle Clients)
  const animateMessageDeletion = (messageId) => {
    // Finde das DOM-Element der zu löschenden Nachricht
    const domMessageToDelete = document.getElementById(`message-${messageId}`);
    
    if (domMessageToDelete) {
      // Nachricht gefunden - Animation starten
      console.log(`%c[CHAT] Starte Lösch-Animation für Nachricht ${messageId}`, 'color: #ff6600;');
      
      // Markiere diese Nachricht als "wird animiert"
      animatingMessagesRef.current[messageId] = true;
      
      // Sanfte Animation für das Löschen
      domMessageToDelete.style.transition = 'all 0.4s ease-out';
      domMessageToDelete.style.overflow = 'hidden';
      domMessageToDelete.style.opacity = '0';
      domMessageToDelete.style.maxHeight = `${domMessageToDelete.offsetHeight}px`;
      domMessageToDelete.style.transform = 'translateX(-10px)';
      
      // Nach kurzer Verzögerung die Höhe auf 0 animieren
      setTimeout(() => {
        if (domMessageToDelete) {
          domMessageToDelete.style.maxHeight = '0';
          domMessageToDelete.style.marginTop = '0';
          domMessageToDelete.style.marginBottom = '0';
          domMessageToDelete.style.paddingTop = '0';
          domMessageToDelete.style.paddingBottom = '0';
        }
      }, 50);
      
      // Nachricht aus dem State entfernen, nachdem die Animation abgeschlossen ist
      setTimeout(() => {
        delete animatingMessagesRef.current[messageId];
        
        setMessages(prevMessages => prevMessages.filter(msg => 
          msg.id !== messageId && String(msg.id) !== String(messageId)
        ));
        
      }, 400); // Etwas länger als die Animations-Dauer
      
      return true; // Animation wurde gestartet
    }
    
    return false; // Keine Animation möglich
  };
  
  const handleDeleteMessage = (messageId) => {
    setActiveMessageMenu(null);
    
    // Nachricht finden, um Apartment-ID zu erhalten
    const messageToDelete = messages.find(msg => msg.id === messageId);
    
    // Pru00fcfen, ob es sich um eine temporäre Vorschau-Nachricht handelt
    const isPreviewMessage = typeof messageId === 'string' && messageId.startsWith('preview-');
    
    if (isPreviewMessage) {
      // Bei Vorschau-Nachrichten keine Server-Aktion notwendig
      console.log(`%c[CHAT] Lokale Vorschau-Nachricht gelöscht: ${messageId}`, 'color: #00aaff;');
      
      // Auch für lokale Vorschau-Nachrichten eine Animation abspielen
      if (!animateMessageDeletion(messageId)) {
        // Fallback, wenn keine Animation möglich ist
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      }
      return;
    }
    
    // Bei normalen Nachrichten: Animation starten und über Socket.io löschen
    try {
      console.log(`%c[CHAT] Lösche Nachricht auf dem Server: ${messageId}`, 'color: #aa0066;');
      
      // Animation starten
      const animationStarted = animateMessageDeletion(messageId);
      
      // ApartmentId aus der Nachricht oder aus dem State verwenden
      const messageApartmentId = messageToDelete?.apartment_id || apartmentId;
      
      // Konsolen-Information zur Nachverfolgung
      console.log(`%c[CHAT] Verwende Apartment-ID: ${messageApartmentId} für Löschung`, 'color: #aa0066;');
      
      // Mit ApartmentId löschen, damit Socket.io den korrekten Raum verwenden kann
      chatService.deleteMessage(messageId, messageApartmentId);
      
      // Falls keine Animation gestartet werden konnte, sofort aus dem State entfernen
      if (!animationStarted) {
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Fehler beim Löschen der Nachricht:', error);
    }
  };
  
  // Formatiere Datum für die Datumsanzeige im Chat
  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return 'Heute';
    } else if (isYesterday) {
      return 'Gestern';
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };
  
  // Gruppiere Nachrichten nach Tag für übersichtlichere Anzeige
  const groupMessagesByDate = (messages) => {
    const groups = {};
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };
  
  if (!apartmentId) {
    return <NoApartmentSelected message="Bitte wähle eine Wohnung aus, um den Chat zu nutzen" />;
  }
  
  // Berechne die optimale Höhe unter Berücksichtigung der Navigation
  return (
    <div className="container"> {/* Standard-Container ohne spezielle Höhe */}
      {/* Hauptkarte für den Chat mit Abstand zur Navbar */}
      {/* Sticky Header */}
      <div className="card card-header" style={styles.stickyHeaderCard}>
        <div style={styles.headerContent}>
          <h1 style={styles.headerTitle}>Chat</h1>
          {/* Verschlüsselungs-Badge mit Tooltip */}
          <div 
                className='encryption-badge'
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--primary-transparent, rgba(96, 92, 255, 0.08))',
                  color: 'var(--primary)',
                  padding: '3px 6px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '500',
                  marginLeft: '4px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  tooltipMountedRef.current = true; // Markiere, dass Tooltip bewusst angezeigt wurde
                  setTooltipVisible(!tooltipVisible);
                }}
                onMouseEnter={() => {
                  tooltipMountedRef.current = true; // Markiere, dass Tooltip bewusst angezeigt wurde
                  setTooltipVisible(true);
                }}
                onMouseLeave={() => setTooltipVisible(false)}
                ref={encryptionBadgeRef}
              >
                <FiLock size={10} style={{marginRight: '3px'}} />
                <span>Verschlüsselt</span>
              </div>
            </div>
            {/* Rechte Seite mit Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                color: socketConnected ? 'var(--success)' : 'var(--error)',
              }}
              >
                <div style={{
                  marginRight: '4px',
                  lineHeight: 0,
                  color: socketConnected ? 'var(--success)' : 'var(--error)',
                }}>
                  {socketConnected ? <FiRadio size={16} className='radio-live'/> : <FiAlertCircle size={16}/>}
                </div>
                <span>
                  {socketConnected ? '' : 'Offline'}</span>
              </div>
            </div>
          </div>
          
      {/* Tooltip-Animation definieren */}
      <style>
        {`
          @keyframes radioPulse {
            0% { opacity: 0.85; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
            100% { opacity: 0.85; transform: scale(1); }
          }
          
          @keyframes subtleGlow {
            0% { filter: drop-shadow(0 0 1px var(--success)); }
            50% { filter: drop-shadow(0 0 2px var(--success)); }
            100% { filter: drop-shadow(0 0 1px var(--success)); }
          }
          
          .radio-live {
            animation: radioPulse 2s ease-in-out infinite, subtleGlow 2s ease-in-out infinite;
          }
          
          @keyframes tooltipFadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes tooltipFadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-8px); }
          }
          
          .tooltip-enter {
            animation: tooltipFadeIn 0.2s ease-out forwards;
          }
          
          .tooltip-exit {
            animation: tooltipFadeOut 0.2s ease-in forwards;
          }
        `}
      </style>
      
      {/* Tooltip außerhalb des Headers als Portal - nur rendern wenn es explizit aktiviert wurde */}
      {tooltipMountedRef.current && encryptionBadgeRef.current && createPortal(
        <div 
          className={`container fadeIn encryption-tooltip ${tooltipVisible ? 'tooltip-enter' : 'tooltip-exit'}`} 
          style={{
            position: 'fixed',
            zIndex: 9999,
            backgroundColor: 'var(--background)',
            color: 'var(--text-primary)',
            padding: '12px 16px',
            borderRadius: 'var(--card-radius)',
            boxShadow: 'var(--shadow)',
            width: 'calc(100% - 32px)', // Volle Breite minus Rand
            maxWidth: '1200px',
            fontSize: '11px',
            textAlign: 'left',
            lineHeight: '1.5',
            border: 'var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            opacity: tooltipVisible ? 1 : 0,
            pointerEvents: tooltipVisible ? 'auto' : 'none',
            top: (() => {
              const rect = encryptionBadgeRef.current.getBoundingClientRect();
              return rect.bottom + 16 + 'px';
            })(),
            left: '16px', // Gleicher Abstand wie Header-Card
            right: '16px', // Gleicher Abstand wie Header-Card
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <FiLock size={12} style={{marginRight: '8px', color: 'var(--primary)'}} />
            <strong style={{fontSize: '12px'}}>Verschlüsselte Kommunikation</strong>
          </div>
          <p style={{margin: '0', opacity: 0.9, fontSize: '12px'}}>
            Alle Nachrichten werden verschlüsselt gespeichert und können nur von Mitgliedern der Wohnung entschlüsselt werden.
          </p>
        </div>,
        document.body
      )}
      
      <div className="card" style={{
        display: 'flex', 
        flexDirection: 'column', 
        height: (() => {
          // Responsive Höhenberechnung basierend auf Bildschirmgröße
          const width = window.innerWidth;
          const isMobile = width <= 768;
          const isTablet = width > 768 && width <= 1024;
          
          if (isMobile) {
            return 'calc(100vh - env(safe-area-inset-bottom) - 257px)'; // Beibehalten des perfekten Mobile-Stylings
          } else if (isTablet) {
            return 'calc(100vh - env(safe-area-inset-bottom) - 250px)'; // Etwas mehr Platz auf Tablets
          } else {
            // Für größere Bildschirme: Deutlich mehr Platz, aber noch mit Abstand zur Navigationsleiste
            return 'calc(100vh - env(safe-area-inset-bottom) - 250px)';
          }
        })(),
        overflowY: 'hidden', // Verhindert doppeltes Scrollen
        maxWidth: window.innerWidth > 1024 ? '1200px' : '100%', // Breitenbegrenzung für sehr große Bildschirme
        margin: window.innerWidth > 1024 ? '0 auto' : '0' // Zentrieren auf großen Bildschirmen
      }}>
        <div style={styles.messageContainer}>
          <div 
            className="messageList" 
            style={styles.messageList}
            ref={messagesContainerRef}
            onScroll={handleScroll}
          >
            {isLoadingMore && (
              <div style={{
                padding: '10px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}>
                <div style={{
                  display: 'inline-block',
                  width: '15px',
                  height: '15px',
                  border: '2px solid var(--primary)',
                  borderRadius: '50%',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px',
                  verticalAlign: 'middle'
                }}></div>
                Lade weitere Nachrichten...
              </div>
            )}
            {!hasMoreMessages && messages.length > 0 && (
              <div style={{
                padding: '10px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}>
                Keine weiteren Nachrichten
              </div>
            )}
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <FiMessageCircle size={40} style={{color: 'var(--text-secondary)', marginBottom: '10px', opacity: 0.5}} />
                <p style={{color: 'var(--text-secondary)'}}>Noch keine Nachrichten. Schreibe die erste!</p>
              </div>
            ) : (
              <>
                {Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
                  <div key={date}>
                    <div style={styles.dateHeader}>
                      <span style={styles.dateHeaderContent}>{formatDateHeader(date)}</span>
                    </div>
                    
                    {msgs.map(message => (
                      <div 
                        key={message.id}
                        id={`message-${message.id}`}
                        style={{
                          ...styles.messageCard,
                          ...(parseInt(message.user_id) === parseInt(currentUser?.id || 0) ? styles.myMessage : styles.otherMessage),
                          ...(isTouching && touchTimer && activeMessageMenu === message.id ? {opacity: 0.8} : {}),
                          transition: 'opacity 0.4s ease-out, transform 0.4s ease-out, max-height 0.4s ease-out, margin 0.3s ease-out, padding 0.3s ease-out'
                        }}
                        onTouchStart={() => handleTouchStart(message)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                        onTouchCancel={handleTouchEnd}
                      >
                        {/* Absender anzeigen */}
                        {/* Absendername anzeigen bei fremden Nachrichten */}
                        {parseInt(message.user_id) !== parseInt(currentUser?.id || 0) && (
                          <div key={`sender-${message.id}`} style={styles.messageSender}>
                            {message.user?.name || `Benutzer ${message.user_id}`}
                          </div>
                        )}
                        
                        {/* Avatar fu00fcr die Nachricht */}
                        {parseInt(message.user_id) === parseInt(currentUser?.id || 0) ? (
                          <div 
                            key={`avatar-${message.id}`}
                            style={{
                              ...styles.avatar,
                              ...styles.myAvatar,
                              backgroundColor: currentUser?.profile_color || `hsl(200, 70%, 50%)` // Verwende benutzerdefinierte Farbe oder Fallback
                            }}
                          >
                            {(currentUser?.initials || (currentUser?.name || 'Ich').charAt(0)).toUpperCase()}
                          </div>
                        ) : (
                          <div 
                            key={`avatar-${message.id}`}
                            style={{
                              ...styles.avatar, 
                              ...styles.otherAvatar,
                              backgroundColor: message.user?.profile_color || `hsl(${(parseInt(message.user_id) * 40) % 360}, 70%, 60%)` // Verwende benutzerdefinierte Farbe oder Fallback
                            }}
                          >
                            {(message.user?.initials || (message.user?.name || 'U').charAt(0)).toUpperCase()}
                          </div>
                        )}
                        
                        {/* Wenn die Nachricht bearbeitet wird, zeige Bearbeitungsformular */}
                        {editingMessage && editingMessage.id === message.id ? (
                          <div style={{width: '100%'}}>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '60px',
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--background)',
                                color: 'var(--text-primary)',
                                resize: 'none',
                                marginBottom: '6px',
                                fontSize: '14px'
                              }}
                              autoFocus
                            />
                            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px'}}>
                              <button 
                                onClick={handleCancelEdit} 
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                  color: 'var(--text-primary)'
                                }}
                              >
                                <FiX size={14} style={{marginRight: '4px'}} />
                                Abbrechen
                              </button>
                              <button 
                                onClick={handleSaveEdit} 
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  backgroundColor: 'var(--primary)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: 'white'
                                }}
                              >
                                <FiCheck size={14} style={{marginRight: '4px'}} />
                                Speichern
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div key={`content-${message.id}`} style={styles.messageContent}>
                              {message.content}
                              {message.edited && 
                                <span style={{fontSize: '10px', opacity: 0.7, marginLeft: '4px', fontStyle: 'italic'}}>
                                  (bearbeitet)
                                </span>
                              }
                            </div>
                            
                            <div key={`meta-${message.id}`} style={{...styles.messageMeta, textAlign: parseInt(message.user_id) === parseInt(currentUser?.id || 0) ? 'right' : 'left'}}>
                              {/* Bei eigenen Nachrichten: Zuerst Häkchen, dann Datum, dann 3-Punkte */}
                              {parseInt(message.user_id) === parseInt(currentUser?.id || 0) && (
                                <span key={`check-container-${message.id}`} style={{marginRight: '4px', color: 'white', display: 'inline-flex', alignItems: 'center'}}>
                                  <FiCheck key={`check1-${message.id}`} size={10} style={{marginRight: '-6px'}} />
                                  <FiCheck key={`check2-${message.id}`} size={10} />
                                </span>
                              )}
                              <span key={`date-${message.id}`} style={{color: parseInt(message.user_id) === parseInt(currentUser?.id || 0) ? 'rgba(255, 255, 255, 0.9)' : 'inherit'}}>{formatDate(message.created_at)}</span>
                              
                              {/* Nur bei eigenen Nachrichten: 3-Punkte-Menu00fc rechts neben der Uhrzeit */}
                              {parseInt(message.user_id) === parseInt(currentUser?.id || 0) && (
                                <div style={{position: 'relative', display: 'inline-block', marginLeft: '4px'}}>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation(); // Verhindert Bubble-Up zum Dokument-Listener
                                      setActiveMessageMenu(activeMessageMenu === message.id ? null : message.id);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'rgba(255, 255, 255, 0.7)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      fontSize: '8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'color 0.2s ease'
                                    }}
                                  >
                                    <FiMoreVertical size={12} />
                                  </button>
                                  
                                  {/* Dropdown-Menu00fc */}
                                  {activeMessageMenu === message.id && (
                                    <div style={{
                                      position: 'absolute',
                                      right: '0',
                                      top: '-40px',
                                      backgroundColor: 'var(--background)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '8px',
                                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                                      zIndex: 10,
                                      minWidth: '100px',
                                      overflow: 'hidden'
                                    }}>
                                      <button 
                                        onClick={() => handleDeleteMessage(message.id)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '8px 12px',
                                          width: '100%',
                                          textAlign: 'left',
                                          backgroundColor: 'transparent',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: 'var(--error)',
                                          fontSize: '12px'
                                        }}
                                      >
                                        <FiTrash2 size={12} style={{marginRight: '8px'}} />
                                        Löschen
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              

                            </div>
                          </>
                        )}

                      </div>
                    ))}
                  </div>
                ))}
                {/* 'User tippt...' Anzeige */}
                {Object.keys(typingUsers).length > 0 && (
                  <div style={styles.typingIndicator}>
                    <span>
                      {Object.values(typingUsers).map(user => user.name).join(', ')} tippt
                      {Object.keys(typingUsers).length > 1 ? 'en' : ''}...
                    </span>
                    <span style={styles.typingDots}>
                      <span style={{...styles.typingDot, animationDelay: '0s'}}></span>
                      <span style={{...styles.typingDot, animationDelay: '0.2s'}}></span>
                      <span style={{...styles.typingDot, animationDelay: '0.4s'}}></span>
                    </span>
                  </div>
                )}
                <div key='messagesEnd' ref={messagesEndRef} />
              </>
            )}
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} style={styles.inputContainer}>
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="Nachricht schreiben..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  // Beim Tippen ein Event auslösen
                  if (e.target.value.trim()) {
                    handleTyping();
                  }
                }}
                style={styles.input}
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()}
                style={{
                  ...styles.sendButton,
                  opacity: newMessage.trim() ? 1 : 0.6,
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed'
                }}
                onMouseEnter={(e) => {
                  if (newMessage.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <FiSend size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
