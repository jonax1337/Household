import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiPlus, FiCheck, FiTrash2, FiEdit, FiShoppingCart, FiX, FiChevronRight, FiArrowLeft, FiArchive, FiFilter } from 'react-icons/fi';
import { shoppingService } from '../services/api';
import NoApartmentSelected from './NoApartmentSelected';

// CSS-Stile für die ShoppingList-Komponente
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
  titleWithBack: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '16px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '5px'
  },
  quickAddItem: {
    marginTop: '15px',
    borderTop: '1px dashed var(--border)',
    paddingTop: '15px'
  },
  quickAddInputGroup: {
    display: 'flex',
    gap: '8px',
    width: '100%'
  },
  quickAddName: {
    flex: '2',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    fontSize: '14px',
    color: 'var(--text-primary)'
  },
  quickAddQuantity: {
    flex: '1',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    fontSize: '14px',
    maxWidth: '80px',
    color: 'var(--text-primary)'
  },
  listCard: {
    padding: '12px 15px',
    backgroundColor: 'var(--card-background)',
    borderRadius: 'var(--button-radius)',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    transition: 'all 0.2s ease',
    border: '1px solid var(--border-color)'
  },
  listCardHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 3px 5px rgba(0,0,0,0.08)'
  },
  listCardActive: {
    borderColor: 'var(--primary)',
    backgroundColor: 'var(--bg-highlight)'
  },
  listCardLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  listCardTitle: {
    fontWeight: 'bold',
    color: 'var(--text-primary)'
  },
  listCardMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '5px',
    color: 'var(--text)',
    cursor: 'pointer',
    marginLeft: '-5px' // Stärker nach links verschieben
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '50%',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    transition: 'all 0.2s ease'
  },
  iconButtonHover: {
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--primary)'
  },
  categoryHeader: {
    fontSize: '14px', 
    color: 'var(--text-secondary)', 
    marginBottom: '8px',
    paddingBottom: '5px',
    borderBottom: '1px solid var(--border)'
  },
  categorySelect: {
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    fontSize: '14px',
    color: 'var(--text-primary)'
  },
  sortButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '5px 8px',
    borderRadius: '5px',
    transition: 'all 0.2s ease'
  },
  sortButtonActive: {
    backgroundColor: 'var(--bg-highlight)',
    color: 'var(--primary)'
  }
};

const ShoppingList = ({ selectedApartment }) => {
  // Extrahiere apartmentId aus selectedApartment mit Fallback-Wert
  const apartmentId = selectedApartment?.id || 0;
  
  // Animations-CSS direkt in der Komponente definieren mit keyframes
  const animationStyles = `
    @keyframes strikethrough {
      0% { transform: scaleX(0); }
      100% { transform: scaleX(1); }
    }
    
    @keyframes bounce {
      0%, 20% { transform: scale(0); }
      40% { transform: scale(1.3); }
      60% { transform: scale(0.9); }
      80% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    
    @keyframes pulse {
      0% { background-color: var(--card-background); }
      50% { background-color: rgba(96, 92, 255, 0.1); }
      100% { background-color: var(--card-background); }
    }
    
    .shopping-item.checking {
      animation: pulse 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .shopping-item.checking .item-checkbox {
      transform: scale(1.2);
      border-color: #605CFF;
      box-shadow: 0 0 0 4px rgba(96, 92, 255, 0.15);
    }
    
    .shopping-item.completed .item-checkbox svg {
      animation: bounce 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
  `;
  
  // Debug-Info ausgeben
  console.log('ShoppingList mit Animation gerendert, apartmentId:', apartmentId);
  
  // Style-Element ins DOM einfu00fcgen mit useEffect
  useEffect(() => {
    // Style-Element erstellen
    const styleElement = document.createElement('style');
    styleElement.id = 'shopping-list-animations';
    styleElement.textContent = animationStyles;
    
    // Pru00fcfen, ob das Style-Element bereits existiert
    const existingStyle = document.getElementById('shopping-list-animations');
    if (existingStyle) {
      // Falls es existiert, aktualisieren
      existingStyle.textContent = animationStyles;
      console.log('Animation-Styles aktualisiert');
    } else {
      // Sonst neu hinzufu00fcgen
      document.head.appendChild(styleElement);
      console.log('Animation-Styles ins DOM eingefu00fcgt');
    }
    
    // Aufräumen beim Unmount der Komponente
    return () => {
      const styleToRemove = document.getElementById('shopping-list-animations');
      if (styleToRemove) {
        styleToRemove.remove();
        console.log('Animation-Styles entfernt');
      }
    };
  }, [animationStyles]);
  
  const [showAddListForm, setShowAddListForm] = useState(false);
  const [showAddItemForm, setShowAddItemForm] = useState(false); // Neuer State für das Artikelformular-Modal
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState(null);
  const [items, setItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [newList, setNewList] = useState({ name: '' });
  const [newItem, setNewItem] = useState({ name: '', quantity: '1', category: 'sonstiges', customCategory: '' });
  const [loading, setLoading] = useState(true);
  const [showListsView, setShowListsView] = useState(true); // State für die Ansichtssteuerung
  const [sortOrder, setSortOrder] = useState('category'); // 'category' oder 'alphabetical'
  const [showDeleteListConfirm, setShowDeleteListConfirm] = useState(false); // State für den Lösche-Bestätigungsdialog
  const [listToDelete, setListToDelete] = useState(null); // ID der zu löschenden Liste
  
  // State für die Bearbeitung des Listennamens
  const [isEditingListName, setIsEditingListName] = useState(false);
  const [editedListName, setEditedListName] = useState('');
  const [updatingListName, setUpdatingListName] = useState(false);
  const [editingListId, setEditingListId] = useState(null); // Fu00fcr die Bearbeitung in der U00fcbersicht

  // States fu00fcr die Item-Bearbeitung via Long-Press
  const [showEditItemForm, setShowEditItemForm] = useState(false);
  const [currentEditItem, setCurrentEditItem] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  
  // Kategorien für Einkaufsartikel
  const categories = [
    { id: 'lebensmittel', name: 'Lebensmittel' },
    { id: 'getraenke', name: 'Getränke' },
    { id: 'drogerie', name: 'Drogerie' },
    { id: 'haushalt', name: 'Haushalt' },
    { id: 'sonstiges', name: 'Sonstiges' },
    { id: 'custom', name: 'Benutzerdefiniert' }
  ];

  // Listen laden
  useEffect(() => {
    const loadLists = async () => {
      try {
        setLoading(true);
        const shoppingLists = await shoppingService.getAllLists(apartmentId);
        setLists(shoppingLists);
        
        // Aktiviere automatisch die erste Liste, wenn vorhanden
        if (shoppingLists.length > 0 && !activeList) {
          setActiveList(shoppingLists[0].id);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Einkaufslisten:', error);
        setLists([]);
        setActiveList(null);
      } finally {
        setLoading(false);
      }
    };

    if (apartmentId) {
      loadLists();
    }
  }, [apartmentId]);

  // Items der aktiven Liste laden und zwischen aktiven und archivierten Items trennen
  useEffect(() => {
    const loadItems = async () => {
      if (!activeList) return;
      
      try {
        setLoading(true);
        const listItems = await shoppingService.getListItems(apartmentId, activeList);
        
        console.log('Geladene Items vom Server:', listItems);
        
        // Eindeutige Client-Indizes hinzufu00fcgen, um React-Rendering zu stabilisieren
        const itemsWithClientIndex = listItems.map((item, index) => ({
          ...item,
          _clientIndex: index  // Jedes Item bekommt einen eindeutigen Index
        }));
        
        // Trennen von aktiven und archivierten Items
        const active = itemsWithClientIndex.filter(item => !item.completed);
        const archived = itemsWithClientIndex.filter(item => item.completed);
        
        console.log('Aktive Items mit clientIndex:', active);
        
        setItems(active);
        setArchivedItems(archived);
      } catch (error) {
        console.error('Fehler beim Laden der Items:', error);
        setItems([]);
        setArchivedItems([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadItems();
  }, [apartmentId, activeList]);

  // State zum Verfolgen von Items, die gerade übergangsweise markiert werden
  const [checkingItems, setCheckingItems] = useState({});

  // Long-Press-Funktionen für mobiles Bearbeiten
  const handleItemTouchStart = (item) => {
    // Starte den Timer für Long-Press (500ms)
    const timer = setTimeout(() => {
      // Long-Press erkannt - Öffne Bearbeitungsformular
      if ('vibrate' in navigator) {
        navigator.vibrate(100); // Längere Vibration für Long-Press
      }
      setCurrentEditItem(item);
      setShowEditItemForm(true);
    }, 500);
    
    setLongPressTimer(timer);
  };
  
  const handleItemTouchEnd = () => {
    // Wenn der Finger losgelassen wird, breche den Timer ab
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  const handleItemTouchMove = () => {
    // Wenn der Finger bewegt wird, breche den Timer ab
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  // Artikel aktualisieren
  const handleUpdateItem = async () => {
    if (!currentEditItem) return;
    
    try {
      // Spezieller Fall für benutzerdefinierte Kategorie
      const categoryToUse = currentEditItem.category === 'custom' && currentEditItem.customCategory 
        ? currentEditItem.customCategory 
        : currentEditItem.category;
        
      const updatedItem = {
        ...currentEditItem,
        category: categoryToUse,
      };
      
      delete updatedItem.customCategory; // Entferne das Hilfsfeld vor dem API-Aufruf
      
      // API-Aufruf zum Aktualisieren
      const result = await shoppingService.updateItem(
        apartmentId, 
        activeList,
        currentEditItem.id,
        {
          name: updatedItem.name,
          quantity: updatedItem.quantity,
          category: updatedItem.category
        }
      );
      
      if (result) {
        // Update der lokalen Daten
        if (updatedItem.completed) {
          // Aktualisiere das archivierte Item
          setArchivedItems(archivedItems.map(item => 
            item.id === currentEditItem.id ? updatedItem : item
          ));
        } else {
          // Aktualisiere das aktive Item
          setItems(items.map(item => 
            item.id === currentEditItem.id ? updatedItem : item
          ));
        }
        
        // Schließe das Formular
        setShowEditItemForm(false);
        setCurrentEditItem(null);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Items:', error);
      // Hier könnte eine Fehlerbehandlung eingefügt werden
    }
  };

  // Status eines Items umschalten (erledigt/nicht erledigt)
  const toggleItemStatus = async (itemId) => {
    try {
      // Finde das Item in unseren Listen
      const itemToToggle = [...items, ...archivedItems].find(item => item.id === itemId);
      if (!itemToToggle) {
        console.warn('Item mit ID nicht gefunden:', itemId);
        return;
      }

      // Setze zuerst den Item-Status auf 'checking' für die Animation
      console.log('Item wird auf checking gesetzt:', itemId);
      setCheckingItems(prev => {
        const updated = { ...prev, [itemId]: true };
        console.log('Aktualisierter checkingItems-State:', updated);
        return updated;
      });

      // Vibration auslo00fcsen - kreative Muster für besseres haptisches Feedback
      if ('vibrate' in navigator) {
        if (itemToToggle.completed) {
          // Uncheck-Pattern: Ein kurzer Puls
          navigator.vibrate(40);
        } else {
          // Check-Pattern: Zwei kurze Pulse für ein angenehmeres Feedback
          navigator.vibrate([40, 30, 70]);
        }
      }
      
      // Bestimme den neuen Status
      const updatedStatus = !itemToToggle.completed;
      
      // Optimistische UI-Aktualisierung - temporäre Kopien der aktuellen States
      const currentItems = [...items];
      const currentArchivedItems = [...archivedItems];
      
      // Wir warten kurz mit der Statusaktualisierung, um die Animation anzuzeigen
      setTimeout(async () => {
        try {
          // API-Aufruf nach einer kleinen Verzo00fcgerung
          const updatedItem = await shoppingService.updateItemStatus(apartmentId, activeList, itemId, updatedStatus);
          
          // Prüfe, ob die API-Antwort erfolgreich war und das aktualisierte Item zurückgegeben hat
          if (updatedItem) {
            // State aktualisieren basierend auf dem Ergebnis der API
            if (updatedItem.completed) {
              // Item vom Server wurde als erledigt markiert
              setItems(currentItems.filter(item => item.id !== itemId));
              setArchivedItems([...currentArchivedItems, updatedItem]);
            } else {
              // Item vom Server wurde als nicht erledigt markiert
              setArchivedItems(currentArchivedItems.filter(item => item.id !== itemId));
              setItems([...currentItems.filter(item => item.id !== itemId), updatedItem]);
            }
          }
        } catch (error) {
          console.error('Fehler beim Umschalten des Item-Status:', error);
        } finally {
          // Nach Animation und API-Aufruf, entferne den checking-Status 
          setTimeout(() => {
            setCheckingItems(prev => {
              const updated = { ...prev };
              delete updated[itemId];
              return updated;
            });
          }, 400); // Animation etwas länger laufen lassen
        }
      }, 150); // Kurze Verzo00fcgerung für die Animations-Darstellung
      
    } catch (error) {
      console.error('Fehler beim Umschalten des Item-Status:', error);
      setCheckingItems(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    }
  };

  // Neue Liste erstellen
  const handleCreateList = async () => {
    if (!newList.name.trim()) return;
    
    try {
      const createdList = await shoppingService.createList(apartmentId, newList);
      setLists([...lists, createdList]);
      setActiveList(createdList.id);
      setShowListsView(false); // Direkt zur neuen Liste wechseln
      setNewList({ name: '' });
    } catch (error) {
      console.error('Fehler beim Erstellen der Liste:', error);
    }
  };

  // Neues Item hinzufügen
  const handleAddItem = async () => {
    if (!newItem.name.trim()) return;
    
    // Bestimme die tatsächliche Kategorie (benutzerdefiniert oder standard)
    let finalCategory = newItem.category;
    
    // Wenn 'benutzerdefiniert' ausgewählt ist und ein Text eingegeben wurde, verwende diesen Text als Kategorie
    if (newItem.category === 'custom' && newItem.customCategory.trim()) {
      finalCategory = newItem.customCategory.trim();
    }
    
    // UI-Feedback - Eingabefelder zurücksetzen für bessere User Experience
    const currentItemData = { ...newItem, category: finalCategory };
    setNewItem({ name: '', quantity: '1', category: newItem.category, customCategory: '' });
    
    try {
      // Debugging-Info: Log vorhandene Items
      console.log('Vorhandene Items:', items.map(item => ({ name: item.name, id: item.id })));
      
      // Erstelle das neue Item ohne Namenänderungen
      const createItemData = {
        name: currentItemData.name,  // Name unverändert übernehmen
        quantity: currentItemData.quantity || '1',
        category: finalCategory,
        completed: false
      };
      
      console.log('Neues Item wird erstellt:', createItemData);
      
      // Generiere eine eindeutige temporäre ID für die optimistische UI-Aktualisierung
      const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Optimistische UI-Aktualisierung mit temporärer ID
      const tempItem = {
        ...createItemData,
        id: tempId,
        _clientIndex: items.length  // Hinzufügen eines internen Index für Stabilität der Keys
      };
      
      // Sofortige UI-Aktualisierung mit temporärer ID für bessere User Experience
      setItems(currentItems => [...currentItems, tempItem]);
      
      // API-Aufruf ausführen
      const createdItem = await shoppingService.addItem(apartmentId, activeList, createItemData);
      console.log('Vom Server erstelltes Item:', createdItem);
      
      // Nach erfolgreicher API-Antwort den State mit der korrekten Server-ID aktualisieren
      if (createdItem && createdItem.id) {
        setItems(currentItems => {
          // Ersetze das temporäre Item mit dem vom Server zurückgegebenen,
          // aber behalte den clientIndex bei
          return currentItems.map(item => 
            item.id === tempId ? {...createdItem, _clientIndex: item._clientIndex} : item
          );
        });
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Items:', error);
      // Bei Fehler das temporäre Item entfernen
      setItems(currentItems => currentItems.filter(item => !item.id.startsWith('temp-')));
    }
  };

  // Artikel löschen
  const deleteItem = async (itemId) => {
    try {
      await shoppingService.deleteItem(apartmentId, activeList, itemId);
      
      // Optimistische UI-Aktualisierung
      if (showArchive) {
        setArchivedItems(archivedItems.filter(item => item.id !== itemId));
      } else {
        setItems(items.filter(item => item.id !== itemId));
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Items:', error);
      // Hier könnte man eine Fehlermeldung anzeigen
    }
  };

  // Liste löschen
  const handleDeleteList = async () => {
    if (!listToDelete) return;
    
    try {
      await shoppingService.deleteList(apartmentId, listToDelete);
      
      // UI aktualisieren
      setLists(lists.filter(list => list.id !== listToDelete));
      
      // Wenn die gerade aktive Liste gelöscht wurde, zur Listenu00fcbersicht wechseln
      if (activeList === listToDelete) {
        setActiveList(null);
        setShowListsView(true);
      }
      
      // Dialog schliessen
      setShowDeleteListConfirm(false);
      setListToDelete(null);
    } catch (error) {
      console.error('Fehler beim Löschen der Liste:', error);
      // Hier könnte man eine Fehlermeldung anzeigen
    }
  };
  
  // Listenname bearbeiten starten (in der Detailansicht)
  const startEditingListName = () => {
    const currentListName = lists.find(list => list.id === activeList)?.name || '';
    setEditedListName(currentListName);
    setIsEditingListName(true);
  };
  
  // Listenname bearbeiten starten (in der U00fcbersicht)
  const startEditingListNameInOverview = (listId, event) => {
    // Verhindere, dass der Klick die Liste o00f6ffnet
    event.stopPropagation();
    
    const currentListName = lists.find(list => list.id === listId)?.name || '';
    setEditedListName(currentListName);
    setEditingListId(listId);
  };
  
  // Listenname speichern (funktioniert sowohl fu00fcr Detail- als auch fu00fcr U00fcbersichtsansicht)
  const saveListName = async () => {
    // Bestimme, welche Liste bearbeitet wird (entweder aus der U00fcbersicht oder aus der Detailansicht)
    const listId = editingListId || activeList;
    
    if (!editedListName.trim() || !listId) return;
    
    try {
      setUpdatingListName(true);
      
      // API-Aufruf u00fcber den Service
      const updatedList = await shoppingService.updateListName(apartmentId, listId, editedListName.trim());
      
      // Listen-Array aktualisieren mit dem neuen Namen
      setLists(lists.map(list => 
        list.id === listId
          ? { ...list, name: updatedList.name } 
          : list
      ));
      
      // Bearbeitungsmodus beenden
      setIsEditingListName(false);
      setEditingListId(null);
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Listennamens:', error);
      // Zeige eine temporäre Fehlermeldung in der UI
      alert('Der Listenname konnte nicht aktualisiert werden. Bitte versuche es später erneut.');
    } finally {
      setUpdatingListName(false);
    }
  };
  
  // Listenname-Bearbeitung abbrechen
  const cancelEditingListName = () => {
    setIsEditingListName(false);
    setEditingListId(null);
    setEditedListName('');
  };

  // Wenn keine Wohnung ausgewählt ist, zeige die NoApartmentSelected-Komponente
  if (!selectedApartment || !selectedApartment.id) {
    return <NoApartmentSelected component="shoppingList" />;
  }

  if (loading && lists.length === 0) {
    return <div className="centered-content">Lade Einkaufslisten...</div>;
  }

  return (
    <div className="container fadeIn">
      {/* Sticky Header */}
      <div className="card" style={styles.stickyHeaderCard}>
        <div style={styles.headerContent}>
          {showListsView ? (
            /* Header für Listenübersicht */
            <>
              <h1 style={styles.headerTitle}>Einkaufslisten</h1>
              <button
                className="icon-button-add"
                onClick={() => setShowAddListForm(true)}
                title="Neue Liste erstellen"
              >
                <FiPlus size={24} />
              </button>
            </>
          ) : (
            /* Header für Listendetails mit Titel und Zurück-Button links daneben */
            <>
              <div style={styles.titleWithBack}>
                <button
                  style={styles.backButton}
                  onClick={() => {
                    setShowListsView(true);
                    setShowArchive(false);
                  }}
                  title="Zurück zur Übersicht"
                >
                  <FiArrowLeft size={20} />
                </button>
                
                {isEditingListName ? (
                  <input
                    type="text"
                    value={editedListName}
                    onChange={(e) => setEditedListName(e.target.value)}
                    onBlur={saveListName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveListName();
                      if (e.key === 'Escape') cancelEditingListName();
                    }}
                    autoFocus
                    style={{
                      fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                      fontWeight: 'bold',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      width: '200px'
                    }}
                  />
                ) : (
                  <h1
                    style={{...styles.headerTitle, cursor: 'pointer'}}
                    onClick={startEditingListName}
                    title="Klicken zum Bearbeiten"
                  >
                    {lists.find(list => list.id === activeList)?.name || 'Liste'}
                  </h1>
                )}
              </div>
              <button
                className="icon-button-add"
                onClick={() => setShowAddItemForm(true)}
                title="Artikel hinzufügen"
              >
                <FiPlus size={24} />
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        {/* Der Rest des Inhalts bleibt in einer Card */}

        {/* Toggle zwischen Listenübersicht und Detailansicht */}
        {showListsView ? (
          /* Listen-Übersicht */
          <div>

            {/* Formular zum Hinzufügen einer neuen Liste als Fullscreen-Modal */}
            {showAddListForm && createPortal(
              <div className="fullscreen-menu fadeIn">
                <div className="fullscreen-menu-content">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Neue Einkaufsliste</h2>
                    <button 
                      className="icon-button" 
                      onClick={() => setShowAddListForm(false)}
                    >
                      <FiX size={20} />
                    </button>
                  </div>
                  
                  <div className="form-group">
                    <label>Name der Liste</label>
                    <input 
                      type="text" 
                      className="input"
                      placeholder="z.B. Wocheneinkauf"
                      value={newList.name}
                      onChange={(e) => setNewList({...newList, name: e.target.value})}
                      style={{ width: '100%', marginBottom: '20px' }}
                      autoFocus
                    />
                    <button 
                      className="button primary"
                      onClick={() => {
                        handleCreateList();
                        setShowAddListForm(false);
                      }}
                      disabled={!newList.name.trim()}
                      style={{ width: '100%' }}
                    >
                      Liste erstellen
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Listenauswahl */}
            {lists.length === 0 ? (
              <div className="empty-state">
                <FiShoppingCart size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                <p>Noch keine Einkaufslisten</p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Erstelle deine erste Einkaufsliste</p>
                <button 
                  className="button primary"
                  onClick={() => setShowAddListForm(true)}
                  style={{ marginTop: '15px' }}
                >
                  <FiPlus size={16} style={{ marginRight: '5px' }} /> Liste erstellen
                </button>
              </div>
            ) : (
              <div>
                {lists.map(list => (
                  <div 
                    key={list.id} 
                    style={{
                      ...styles.listCard,
                      // Keine Hervorhebung in der Listenübersicht
                      ...(!showListsView && activeList === list.id ? styles.listCardActive : {})
                    }}
                    onClick={() => {
                      setActiveList(list.id);
                      setShowListsView(false); // Zur Einzelansicht wechseln
                      setShowArchive(false); // Reset archive view when selecting a list
                    }}
                    onMouseEnter={(e) => {
                      Object.assign(e.currentTarget.style, styles.listCardHover);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = styles.listCard.boxShadow;
                    }}
                  >
                    {editingListId === list.id ? (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        flex: '1',
                        gap: '8px' 
                      }}>
                        <input 
                          type="text"
                          value={editedListName}
                          onChange={(e) => setEditedListName(e.target.value)}
                          style={{
                            flex: '1',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-secondary)',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}
                          autoFocus
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveListName();
                            } else if (e.key === 'Escape') {
                              cancelEditingListName();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="icon-button"
                            onClick={saveListName}
                            disabled={updatingListName}
                            title="Speichern"
                            style={{
                              backgroundColor: 'var(--success-light)',
                              color: 'var(--success)',
                              width: '32px',
                              height: '32px'
                            }}
                          >
                            {updatingListName ? (
                              <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
                            ) : (
                              <FiCheck size={16} />
                            )}
                          </button>
                          <button 
                            className="icon-button"
                            onClick={cancelEditingListName}
                            disabled={updatingListName}
                            title="Abbrechen"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              width: '32px',
                              height: '32px'
                            }}
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={styles.listCardLeft}>
                          <div style={styles.listCardTitle}>{list.name}</div>
                          {list.date && (
                            <div style={styles.listCardMeta}>Erstellt am {new Date(list.date).toLocaleDateString()}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button 
                            className="icon-button" 
                            onClick={(e) => startEditingListNameInOverview(list.id, e)}
                            style={{ padding: '5px' }}
                            title="Listen-Namen bearbeiten"
                          >
                            <FiEdit size={16} color="var(--text-secondary)" />
                          </button>
                          <button 
                            className="icon-button danger" 
                            onClick={(e) => {
                              e.stopPropagation(); // Verhindert, dass die Liste geo00f6ffnet wird
                              setListToDelete(list.id);
                              setShowDeleteListConfirm(true);
                            }}
                            style={{ padding: '5px' }}
                            title="Liste lo00f6schen"
                          >
                            <FiTrash2 size={16} />
                          </button>
                          <FiChevronRight size={18} color="var(--text-secondary)" />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Detailansicht einer Liste */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {!showArchive && items.length > 0 && (
                  <button 
                    className="icon-button" 
                    onClick={() => setSortOrder(sortOrder === 'category' ? 'alphabetical' : 'category')}
                    title={sortOrder === 'category' ? "Alphabetisch sortieren (A-Z)" : "Nach Kategorie sortieren"}
                    style={{
                      ...styles.sortButton,
                      ...(sortOrder === 'alphabetical' ? styles.sortButtonActive : {})
                    }}
                  >
                    {sortOrder === 'category' ? <FiAlignLeft size={20} /> : <FiFilter size={20} />}
                  </button>
                )}
                <button 
                  className="icon-button"
                  style={{
                    ...styles.iconButton,
                    backgroundColor: showArchive ? 'var(--bg-highlight)' : 'transparent',
                    color: showArchive ? 'var(--primary)' : 'var(--text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!showArchive) {
                      Object.assign(e.currentTarget.style, styles.iconButtonHover);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showArchive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                  onClick={() => setShowArchive(!showArchive)} 
                  title={showArchive ? "Aktive Items anzeigen" : "Archiv anzeigen"}
                >
                  {showArchive ? <FiShoppingCart size={20} /> : <FiArchive size={20} />}
                </button>
              </div>
            </div>
            
            {/* Umschalten zwischen aktiven Items und archivierten Items */}
            {showArchive ? (
              /* Archivierte Items */
              archivedItems.length === 0 ? (
                <div className="empty-state">
                  <FiShoppingCart size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                  <p>Keine archivierten Produkte</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Erledigte Produkte erscheinen hier</p>
                </div>
              ) : (
                <div className="shopping-items archived">
                  <h4 style={{ ...styles.categoryHeader, color: 'var(--text-secondary)' }}>
                    Erledigte Produkte
                  </h4>
                  {archivedItems.map((item, index) => {
                    // Verwende eine deterministische eindeutige ID basierend auf clientIndex oder array index
                    const uniqueKey = item._clientIndex !== undefined
                      ? `${item.id}-${item._clientIndex}` 
                      : `${item.id}-archived-${index}`;
                      
                    console.log(`Archiviertes Item: ${item.name}, ID: ${item.id}, uniqueKey: ${uniqueKey}`);
                      
                    return (
                      <div 
                        key={uniqueKey} 
                        className={`shopping-item completed ${checkingItems[item.id] ? 'checking' : ''}`} 
                        style={{ marginBottom: '10px' }}
                        onTouchStart={() => handleItemTouchStart(item)}
                        onTouchEnd={handleItemTouchEnd}
                        onTouchMove={handleItemTouchMove}
                      >
                        <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                          <FiCheck />
                        </div>
                        <div className="item-content">
                          <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                          <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                        </div>
                        <button className="item-delete" onClick={() => deleteItem(item.id)}>
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Aktive Items */
              items.length === 0 ? (
                <div>
                  <div className="empty-state">
                    <FiShoppingCart size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                    <p style={{ color: 'var(--text-primary)' }}>Keine Produkte in dieser Liste</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Füge dein erstes Produkt hinzu</p>
                  </div>
                  
                  {/* Button zum Öffnen des Fullscreen-Modals */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                    <button 
                      className="button primary" 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}
                      onClick={() => setShowAddItemForm(true)}
                    >
                      <FiPlus size={20} /> Produkt hinzufügen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="shopping-items">
                  {/* Sortiere und gruppiere Items nach gewählter Sortiermethode */}
                  {sortOrder === 'category' ? (
                    // Nach Kategorie gruppiert anzeigen
                    <div>
                      {(() => {
                        // Vorbereitung: Kategorisierung der Items
                        const standardCategoryItems = {}; // Standard-Kategorien
                        const customCategoryItems = {}; // Benutzerdefinierte Kategorien
                        
                        // Sortiere jedes Item in die richtige Kategorie
                        items.forEach(item => {
                          const categoryId = item.category || 'sonstiges';
                          
                          // Pru00fcfe, ob es eine Standard-Kategorie ist
                          const isStandardCategory = categories.some(cat => cat.id === categoryId);
                          
                          if (isStandardCategory) {
                            // Standard-Kategorie
                            if (!standardCategoryItems[categoryId]) {
                              standardCategoryItems[categoryId] = [];
                            }
                            standardCategoryItems[categoryId].push(item);
                          } else {
                            // Benutzerdefinierte Kategorie
                            if (!customCategoryItems[categoryId]) {
                              customCategoryItems[categoryId] = [];
                            }
                            customCategoryItems[categoryId].push(item);
                          }
                        });
                        
                        // Ausgabe fu00fcr die Darstellung vorbereiten
                        const output = [];
                        
                        // 1. Rendere Standard-Kategorien
                        categories.forEach(category => {
                          const categoryItems = standardCategoryItems[category.id];
                          if (!categoryItems || categoryItems.length === 0) return;
                          
                          output.push(
                            <div key={category.id} style={{ marginBottom: '15px' }}>
                              <h4 style={styles.categoryHeader}>
                                {category.name}
                              </h4>
                              
                              {categoryItems.map((item, index) => {
                                // Verwende den _clientIndex wenn vorhanden, sonst die Kombination aus category.id und index
                                const uniqueKey = item._clientIndex !== undefined 
                                  ? `${item.id}-${item._clientIndex}` 
                                  : `${item.id}-${category.id}-${index}`;
                                
                                return (
                                  <div 
                                    key={uniqueKey} 
                                    className={`shopping-item ${item.completed ? 'completed' : ''} ${checkingItems[item.id] ? 'checking' : ''}`} 
                                    style={{ marginBottom: '10px' }}
                                    onTouchStart={() => handleItemTouchStart(item)}
                                    onTouchEnd={handleItemTouchEnd}
                                    onTouchMove={handleItemTouchMove}
                                  >
                                    <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                                      {item.completed ? <FiCheck /> : null}
                                    </div>
                                    <div className="item-content">
                                      <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                                      <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                                    </div>
                                    <button className="item-delete" onClick={() => deleteItem(item.id)}>
                                      <FiTrash2 size={16} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                        
                        // 2. Rendere benutzerdefinierte Kategorien
                        Object.keys(customCategoryItems).forEach(categoryId => {
                          const categoryItems = customCategoryItems[categoryId];
                          
                          output.push(
                            <div key={`custom-${categoryId}`} style={{ marginBottom: '15px' }}>
                              <h4 style={styles.categoryHeader}>
                                {categoryId}
                              </h4>
                              
                              {categoryItems.map((item, index) => {
                                // Verwende den _clientIndex wenn vorhanden, sonst die Kombination aus categoryId und index
                                const uniqueKey = item._clientIndex !== undefined 
                                  ? `${item.id}-${item._clientIndex}` 
                                  : `${item.id}-custom-${categoryId}-${index}`;
                                  
                                return (
                                  <div 
                                    key={uniqueKey} 
                                    className={`shopping-item ${item.completed ? 'completed' : ''} ${checkingItems[item.id] ? 'checking' : ''}`} 
                                    style={{ marginBottom: '10px' }}
                                    onTouchStart={() => handleItemTouchStart(item)}
                                    onTouchEnd={handleItemTouchEnd}
                                    onTouchMove={handleItemTouchMove}
                                  >
                                    <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                                      {item.completed ? <FiCheck /> : null}
                                    </div>
                                    <div className="item-content">
                                      <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                                      <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                                    </div>
                                    <button className="item-delete" onClick={() => deleteItem(item.id)}>
                                      <FiTrash2 size={16} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                        
                        return output;
                      })()}
                    </div>
                  ) : (
                    // Alphabetisch sortiert anzeigen
                    <div>
                      <h4 style={styles.categoryHeader}>
                        Produkte (alphabetisch)
                      </h4>
                      {items.sort((a, b) => a.name.localeCompare(b.name)).map((item, index) => {
                        // Verwende eine deterministische eindeutige ID basierend auf clientIndex oder array index
                        const uniqueKey = item._clientIndex !== undefined
                          ? `${item.id}-${item._clientIndex}`
                          : `${item.id}-alpha-${index}`;
                          
                        // Debug-Info fu00fcr das React-Key-Problem
                        console.log(`Alphabetische Ansicht - Item: ${item.name}, ID: ${item.id}, uniqueKey: ${uniqueKey}`);
                        
                        return (
                          <div 
                            key={uniqueKey} 
                            className={`shopping-item ${item.completed ? 'completed' : ''} ${checkingItems[item.id] ? 'checking' : ''}`} 
                            style={{ marginBottom: '10px' }}
                            onTouchStart={() => handleItemTouchStart(item)}
                            onTouchEnd={handleItemTouchEnd}
                            onTouchMove={handleItemTouchMove}
                          >
                            <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                              {item.completed ? <FiCheck /> : null}
                            </div>
                            <div className="item-content">
                              <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                              <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                            </div>
                            <button className="item-delete" onClick={() => deleteItem(item.id)}>
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
        
        {/* Fullscreen-Modal zum Hinzufügen eines neuen Artikels */}
        {showAddItemForm && createPortal(
          <div className="fullscreen-menu fadeIn">
            <div className="fullscreen-menu-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Neuer Artikel</h2>
                <button 
                  className="icon-button" 
                  onClick={() => setShowAddItemForm(false)}
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="form-group">
                <label>Produktname</label>
                <input 
                  type="text" 
                  className="input"
                  placeholder="z.B. Milch"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  style={{ width: '100%', marginBottom: '15px' }}
                  autoFocus
                />
                
                <label>Menge</label>
                <input 
                  type="text" 
                  className="input"
                  placeholder="z.B. 1 Liter"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                  style={{ width: '100%', marginBottom: '15px' }}
                />
                
                <label>Kategorie</label>
                <select 
                  className="input"
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value, customCategory: e.target.value === 'custom' ? newItem.customCategory : ''})}
                  style={{ width: '100%', marginBottom: newItem.category === 'custom' ? '15px' : '25px' }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                
                {newItem.category === 'custom' && (
                  <div style={{ marginBottom: '25px' }}>
                    <label>Benutzerdefinierte Kategorie</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="z.B. Elektronik, Kleidung, etc."
                      value={newItem.customCategory}
                      onChange={(e) => setNewItem({...newItem, customCategory: e.target.value})}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                
                <button 
                  className="button primary"
                  onClick={() => {
                    handleAddItem();
                    setShowAddItemForm(false);
                  }}
                  disabled={!newItem.name.trim()}
                  style={{ width: '100%' }}
                >
                  Artikel hinzufügen
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        
        {/* Fullscreen-Bestätigungsdialog für das Löschen einer Liste */}
        {showDeleteListConfirm && createPortal(
          <div className="fullscreen-menu fadeIn">
            <div className="fullscreen-menu-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Liste löschen</h2>
                <button 
                  className="icon-button" 
                  onClick={() => {
                    setShowDeleteListConfirm(false);
                    setListToDelete(null);
                  }}
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="form-group">
                <p style={{ marginBottom: '20px' }}>
                  Bist du sicher, dass du die Liste "
                  <strong>{lists.find(list => list.id === listToDelete)?.name || ''}" </strong> 
                   löschen möchtest?
                </p>
                <p style={{ marginBottom: '20px', color: 'var(--warning)' }}>
                  Alle Elemente in dieser Liste werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button 
                    className="button secondary"
                    onClick={() => {
                      setShowDeleteListConfirm(false);
                      setListToDelete(null);
                    }}
                    style={{ flex: 1 }}
                  >
                    Abbrechen
                  </button>
                  <button 
                    className="button danger"
                    onClick={handleDeleteList}
                    style={{ flex: 1 }}
                  >
                    Liste löschen
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
        
        {/* Fullscreen-Modal zum Bearbeiten eines Artikels (über Long-Press) */}
        {showEditItemForm && currentEditItem && createPortal(
          <div className="fullscreen-menu fadeIn">
            <div className="fullscreen-menu-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Artikel bearbeiten</h2>
                <button 
                  className="icon-button" 
                  onClick={() => {
                    setShowEditItemForm(false);
                    setCurrentEditItem(null);
                  }}
                >
                  <FiX size={20} />
                </button>
              </div>
              
              <div className="form-group">
                <label>Produktname</label>
                <input 
                  type="text" 
                  className="input"
                  placeholder="z.B. Milch"
                  value={currentEditItem.name}
                  onChange={(e) => setCurrentEditItem({...currentEditItem, name: e.target.value})}
                  style={{ width: '100%', marginBottom: '15px' }}
                  autoFocus
                />
                
                <label>Menge</label>
                <input 
                  type="text" 
                  className="input"
                  placeholder="z.B. 1 Liter"
                  value={currentEditItem.quantity}
                  onChange={(e) => setCurrentEditItem({...currentEditItem, quantity: e.target.value})}
                  style={{ width: '100%', marginBottom: '15px' }}
                />
                
                <label>Kategorie</label>
                <select 
                  className="input"
                  value={currentEditItem.category}
                  onChange={(e) => setCurrentEditItem({
                    ...currentEditItem, 
                    category: e.target.value, 
                    customCategory: e.target.value === 'custom' ? currentEditItem.customCategory : ''
                  })}
                  style={{ width: '100%', marginBottom: currentEditItem.category === 'custom' ? '15px' : '25px' }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                
                {currentEditItem.category === 'custom' && (
                  <div style={{ marginBottom: '25px' }}>
                    <label>Benutzerdefinierte Kategorie</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="z.B. Elektronik, Kleidung, etc."
                      value={currentEditItem.customCategory || ''}
                      onChange={(e) => setCurrentEditItem({...currentEditItem, customCategory: e.target.value})}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button 
                    className="button primary"
                    onClick={handleUpdateItem}
                    disabled={!currentEditItem.name.trim()}
                    style={{ flex: 1 }}
                  >
                    Speichern
                  </button>
                  
                  <button 
                    className="button secondary"
                    onClick={() => {
                      setShowEditItemForm(false);
                      setCurrentEditItem(null);
                    }}
                    style={{ flex: 1 }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
        
      </div>
      {/* Zusätzlicher Div am Ende des Containers für Abstand zur Navbar */}
      <div style={{ marginBottom: '120px' }}></div>
    </div>
  );
};

export default ShoppingList;
