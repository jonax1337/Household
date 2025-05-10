import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiPlus, FiCheck, FiTrash2, FiEdit, FiShoppingCart, FiX, FiChevronRight, FiArrowLeft, FiArchive, FiList, FiGrid } from 'react-icons/fi';
import { FaSortAlphaDown, FaListUl } from 'react-icons/fa';
import { shoppingService } from '../services/api';
import NoApartmentSelected from './NoApartmentSelected';

// CSS-Stile für die ShoppingList-Komponente
const styles = {
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
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '5px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    marginBottom: '15px',
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
        
        // Trennen von aktiven und archivierten Items
        const active = listItems.filter(item => !item.completed);
        const archived = listItems.filter(item => item.completed);
        
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

  // Status eines Items umschalten (erledigt/nicht erledigt)
  const toggleItemStatus = async (itemId) => {
    try {
      // Finde das Item in unseren Listen
      const itemToToggle = [...items, ...archivedItems].find(item => item.id === itemId);
      if (!itemToToggle) {
        console.warn('Item mit ID nicht gefunden:', itemId);
        return;
      }
      
      // Bestimme den neuen Status
      const updatedStatus = !itemToToggle.completed;
      
      // Optimistische UI-Aktualisierung - temporäre Kopien der aktuellen States
      const currentItems = [...items];
      const currentArchivedItems = [...archivedItems];
      
      // API-Aufruf vor der State-Aktualisierung
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
      // Hier könnte man die Anzeige wieder auf den ursprünglichen Zustand zurücksetzen
      // und dem Benutzer eine Fehlermeldung anzeigen
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
      const createItemData = {
        name: currentItemData.name,
        quantity: currentItemData.quantity || '1',
        category: finalCategory,
        completed: false
      };
      
      // Warten auf API-Antwort bevor wir den State aktualisieren
      const createdItem = await shoppingService.addItem(apartmentId, activeList, createItemData);
      
      // Nur nach erfolgreicher API-Antwort den State aktualisieren
      // mit dem vom Server zurückgegebenen Objekt (inkl. korrekter ID)
      if (createdItem && createdItem.id) {
        setItems(currentItems => [...currentItems, createdItem]);
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Items:', error);
      // Hier könnte man eine Fehlermeldung für den Benutzer anzeigen
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
      <div className="card" style={{ marginBottom: '20px' }}>
        {/* Header mit Titel und Plus-Button in einer Linie */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>Einkaufslisten</h1>
          
          <button 
            className="icon-button-add" 
            onClick={() => setShowAddListForm(true)}
            title="Neue Liste erstellen"
            style={{ marginLeft: 'auto' }}
          >
            <FiPlus size={24} />
          </button>
        </div>

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
            <div style={{ marginBottom: '15px' }}>
              <button 
                onClick={() => setShowListsView(true)} 
                style={styles.backButton}
              >
                <FiArrowLeft size={18} /> Zurück zu allen Listen
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              {isEditingListName ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  flex: '1'
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
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: 'var(--text-primary)',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      outline: 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveListName();
                      } else if (e.key === 'Escape') {
                        setIsEditingListName(false);
                      }
                    }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className="icon-button"
                      onClick={saveListName}
                      disabled={updatingListName}
                      title="Speichern"
                      style={{
                        backgroundColor: 'var(--success-light)',
                        color: 'var(--success)',
                        width: '36px',
                        height: '36px'
                      }}
                    >
                      {updatingListName ? (
                        <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                      ) : (
                        <FiCheck size={18} />
                      )}
                    </button>
                    <button 
                      className="icon-button"
                      onClick={() => setIsEditingListName(false)}
                      disabled={updatingListName}
                      title="Abbrechen"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        width: '36px',
                        height: '36px'
                      }}
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px'
                }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {lists.find(list => list.id === activeList)?.name || 'Einkaufsliste'}
                  </h3>
                  <button 
                    className="icon-button"
                    onClick={startEditingListName}
                    title="Listennamen bearbeiten"
                    style={{
                      padding: '5px',
                      backgroundColor: 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <FiEdit size={16} color="var(--text-secondary)" />
                  </button>
                </div>
              )}
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
                    {sortOrder === 'category' ? <FaListUl size={20} /> : <FaSortAlphaDown size={20} />}
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
                {/* Schnelles Hinzufügen am Ende der Liste */}
                <button type="submit" className="icon-button-add" onClick={() => setShowAddItemForm(true)}>
                  <FiPlus size={20} />
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
                  {archivedItems.map(item => (
                    <div key={item.id} className={`shopping-item completed`} style={{ marginBottom: '10px' }}>
                      <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                        <FiCheck />
                      </div>
                      <div className="item-content" onClick={() => toggleItemStatus(item.id)}>
                        <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                        <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                      </div>
                      <button className="item-delete" onClick={() => deleteItem(item.id)}>
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  ))}
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
                              
                              {categoryItems.map(item => (
                                <div key={item.id} className={`shopping-item ${item.completed ? 'completed' : ''}`} style={{ marginBottom: '10px' }}>
                                  <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                                    {item.completed ? <FiCheck /> : null}
                                  </div>
                                  <div className="item-content" onClick={() => toggleItemStatus(item.id)}>
                                    <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                                    <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                                  </div>
                                  <button className="item-delete" onClick={() => deleteItem(item.id)}>
                                    <FiTrash2 size={16} />
                                  </button>
                                </div>
                              ))}
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
                              
                              {categoryItems.map(item => (
                                <div key={item.id} className={`shopping-item ${item.completed ? 'completed' : ''}`} style={{ marginBottom: '10px' }}>
                                  <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                                    {item.completed ? <FiCheck /> : null}
                                  </div>
                                  <div className="item-content" onClick={() => toggleItemStatus(item.id)}>
                                    <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                                    <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                                  </div>
                                  <button className="item-delete" onClick={() => deleteItem(item.id)}>
                                    <FiTrash2 size={16} />
                                  </button>
                                </div>
                              ))}
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
                      {items.sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                        <div key={item.id} className={`shopping-item ${item.completed ? 'completed' : ''}`} style={{ marginBottom: '10px' }}>
                          <div className="item-checkbox" onClick={() => toggleItemStatus(item.id)}>
                            {item.completed ? <FiCheck /> : null}
                          </div>
                          <div className="item-content" onClick={() => toggleItemStatus(item.id)}>
                            <div className="item-name" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                            <div className="item-quantity" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</div>
                          </div>
                          <button className="item-delete" onClick={() => deleteItem(item.id)}>
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      ))}
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
      </div>
      {/* Zusätzlicher Div am Ende des Containers für Abstand zur Navbar */}
      <div style={{ marginBottom: '120px' }}></div>
    </div>
  );
};

export default ShoppingList;
