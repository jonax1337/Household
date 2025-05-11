import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiSun, FiBell, FiCheckCircle, FiMoon, FiRefreshCw, FiHome, FiLogOut, FiEdit, FiTrash2, FiX, FiShare2, FiCopy, FiHeart, FiUser, FiSettings as FiGear, FiUsers, FiAward, FiUserX } from 'react-icons/fi';
import AddressPicker from './AddressPicker';
import { useTheme } from '../context/ThemeContext';
import { authService, apartmentService, roommateService } from '../services/api';
import NotificationPrompt from './NotificationPrompt';

const Settings = ({ handleLogout, currentUser: propCurrentUser, selectedApartment, setSelectedApartment, apartments, setApartments }) => {
  // Eigenen lokalen State für currentUser, falls der Prop nicht gesetzt ist
  const [localCurrentUser, setLocalCurrentUser] = useState(null);
  
  // Effektiver currentUser - entweder aus Props oder lokal
  const currentUser = propCurrentUser || localCurrentUser;
  
  console.log('%c[SETTINGS] currentUser aus Props:', 'color: #ff5722; font-weight: bold;', propCurrentUser);
  console.log('%c[SETTINGS] localStorage currentUser:', 'color: #ff9800;', localStorage.getItem('currentUser'));
  
  // Wenn kein currentUser über Props kommt, aus localStorage laden
  useEffect(() => {
    if (!propCurrentUser) {
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log('%c[SETTINGS] Lade Benutzerdaten aus localStorage:', 'color: #4CAF50;', userData);
          setLocalCurrentUser(userData);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten aus localStorage:', error);
      }
    }
  }, [propCurrentUser]);
  
  // Funktion zum Abrufen des Einladungscodes
  const fetchInviteCode = async (apartmentId) => {
    if (!apartmentId) return;
    
    try {
      // Verwende den zentralen roommateService statt direkter API-Aufrufe
      console.log(`%c[SETTINGS] Lade Einladungscode für Apartment ${apartmentId} über roommateService`, 'color: #0066aa;');
      
      const inviteCode = await roommateService.getInviteCode(apartmentId);
      console.log('%c[SETTINGS] Einladungscode erfolgreich geladen:', 'color: #00aa66;', inviteCode);
      
      // Strukturiere Daten so, dass sie mit dem vorherigen Format kompatibel sind
      const data = { inviteCode };
      
      if (data && (data.code || data.inviteCode)) {
        // Setze den Einladungscode zum ausgewählten Apartment
        setSelectedApartment(prev => {
          if (!prev) return prev; // Sicherheitsprüfung
          
          return {
            ...prev,
            inviteCode: data.code || data.inviteCode
          };
        });
      } else {
        console.warn('Kein Einladungscode in der Antwort gefunden');
      }
    } catch (error) {
      console.error('Fehler beim Abrufen des Einladungscodes:', error);
    }
  };
  
  // Einladungscode abrufen, wenn sich das ausgewählte Apartment ändert
  useEffect(() => {
    if (selectedApartment && selectedApartment.id) {
      fetchInviteCode(selectedApartment.id);
      loadRoommates(selectedApartment.id);
    }
  }, [selectedApartment?.id]);
  
  // Mitbewohner einer Wohnung laden
  const loadRoommates = async (apartmentId) => {
    try {
      setLoadingRoommates(true);
      
      // Verwende den zentralen roommateService statt direkter API-Aufrufe
      console.log(`%c[SETTINGS] Lade Mitbewohner für Apartment ${apartmentId} über roommateService`, 'color: #0066aa;');
      
      const data = await roommateService.getAll(apartmentId);
      console.log('%c[SETTINGS] Mitbewohner erfolgreich geladen:', 'color: #00aa66;', data);
      setRoommates(data);
    } catch (error) {
      console.error('Fehler beim Laden der Mitbewohner:', error);
      setRoommates([]);
    } finally {
      setLoadingRoommates(false);
    }
  };
  
  // Ownership an einen anderen Mitbewohner übertragen
  const transferOwnership = async (newOwnerId) => {
    if (!selectedApartment || !selectedApartment.id || !newOwnerId) return;
    
    try {
      setTransferring(true);
      setTransferError('');
      setTransferSuccess('');
      
      // Nutze den zentralen roommateService statt direkter API-Aufrufe
      console.log(`%c[SETTINGS] Übertrage Eigentum von Apartment ${selectedApartment.id} an Mitbewohner ${newOwnerId} über roommateService`, 'color: #0066aa;');
      
      // Aufruf an den zentralen Service, der die korrekte URL unabhängig vom Gerät verwendet
      const data = await roommateService.transferOwnership(selectedApartment.id, newOwnerId);
      console.log('%c[SETTINGS] Eigentum erfolgreich übertragen:', 'color: #00aa66;', data);
      
      // Aktualisiere die lokalen Daten
      setTransferSuccess(data.message || 'Eigentum erfolgreich übertragen');
      setShowConfirmTransfer(false);
      
      // Mitbewohnerliste aktualisieren
      const updatedRoommates = roommates.map(roommate => ({
        ...roommate,
        is_owner: roommate.id === newOwnerId ? 1 : 0
      }));
      setRoommates(updatedRoommates);
      
      // Warten und dann Apartment-Daten neu laden
      setTimeout(() => {
        window.location.reload(); // Einfache Lösung: Seite neu laden, um aktualisierte Daten zu erhalten
      }, 1500);
    } catch (error) {
      console.error('Fehler beim Übertragen des Eigentums:', error);
      setTransferError(error.message);
    } finally {
      setTransferring(false);
    }
  };
  
  // Eigentumsübertragung bestätigen
  const confirmTransferOwnership = (roommate) => {
    setSelectedNewOwner(roommate);
    setShowConfirmTransfer(true);
  };
  
  // Mitbewohner kicken
  const kickRoommate = async (userId) => {
    if (!selectedApartment || !selectedApartment.id || !userId) return;
    
    try {
      setKicking(true);
      setKickError('');
      setKickSuccess('');
      
      // API-Aufruf zum Kicken des Mitbewohners
      const apiUrl = `http://localhost:5000/api/roommates/${selectedApartment.id}/kick/${userId}`;
      console.log('API-Aufruf an:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('token')
        }
      });
      
      // Verbesserte Fehlerbehandlung
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Die API-Route wurde nicht gefunden. Bitte überprüfe die Backend-Route.`);
        }
        
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Fehler beim Entfernen des Mitbewohners: ${response.status}`);
        } catch (jsonError) {
          // Wenn die Antwort kein gültiges JSON ist
          throw new Error(`Fehler beim Entfernen des Mitbewohners: Der Server hat mit Status ${response.status} geantwortet.`);
        }
      }
      
      // Parse JSON-Antwort mit Fehlerbehandlung
      let data;
      try {
        data = await response.json();
        console.log('Mitbewohner erfolgreich entfernt:', data);
      } catch (jsonError) {
        console.warn('Warnung: Konnte Server-Antwort nicht als JSON parsen:', jsonError);
        data = { message: 'Mitbewohner wurde entfernt, aber die Server-Antwort war nicht im erwarteten Format.' };
      }
      
      // Aktualisiere die lokalen Daten
      setKickSuccess(data.message || 'Mitbewohner erfolgreich entfernt');
      setShowConfirmKick(false);
      
      // Aktualisiere die Mitbewohnerliste
      const updatedRoommates = roommates.filter(roommate => roommate.id !== userId);
      setRoommates(updatedRoommates);
    } catch (error) {
      console.error('Fehler beim Entfernen des Mitbewohners:', error);
      setKickError(error.message);
    } finally {
      setKicking(false);
    }
  };
  
  // Kick-Bestätigung anzeigen
  const confirmKickRoommate = (roommate) => {
    setSelectedUserToKick(roommate);
    setShowConfirmKick(true);
  };
  
  const { theme, changeThemePreference } = useTheme();
  
  // Zustandsvariablen für Wohnungsaktionen
  const [showEditApartmentModal, setShowEditApartmentModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [loadingInviteCode, setLoadingInviteCode] = useState(false);
  const [codeAnimated, setCodeAnimated] = useState(false);
  const [apartmentFormData, setApartmentFormData] = useState({
    name: selectedApartment?.name || '',
    address: selectedApartment?.address || ''
  });
  
  // Zustände für Mitbewohner-Übersicht
  const [roommates, setRoommates] = useState([]);
  const [loadingRoommates, setLoadingRoommates] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [showConfirmTransfer, setShowConfirmTransfer] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState(null);
  
  // Zustände für das Kicken von Mitbewohnern
  const [kicking, setKicking] = useState(false);
  const [kickError, setKickError] = useState('');
  const [kickSuccess, setKickSuccess] = useState('');
  const [showConfirmKick, setShowConfirmKick] = useState(false);
  const [selectedUserToKick, setSelectedUserToKick] = useState(null);
  
  // Für kontext-spezifische Meldungen verwenden wir dedizierte States pro Kontext
  // statt einer globalen Notification
  
  // Funktion zum Verlassen einer Wohnung
  const handleLeaveApartment = async () => {
    try {
      if (!selectedApartment || !selectedApartment.id) {
        alert('Keine Wohnung ausgewählt');
        return;
      }

      console.log('Verlasse Wohnung', selectedApartment.id);
      
      // API-Aufruf zum Verlassen der Wohnung
      const apiUrl = `http://localhost:5000/api/roommates/leave/${selectedApartment.id}`;
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('token')
        }
      });
      
      // Wenn der Server einen 400-Fehler zurückgibt, könnte es bedeuten, dass der Owner
      // der letzte Benutzer ist und die Wohnung löschen sollte
      if (response.status === 400) {
        const data = await response.json();
        
        if (data.shouldDelete) {
          alert(data.message);
          setShowLeaveConfirmation(false);
          // Optional: Löschbestätigung anzeigen
          setShowDeleteConfirmation(true);
          return;
        } else {
          throw new Error(data.message || 'Unbekannter Fehler');
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP-Fehler: ${response.status}`);
      }
      
      // Erfolgreich - jetzt UI aktualisieren
      
      // Subtile Animation hinzufügen (Fade-out mit leichter Verschiebung)
      if (selectedApartment) {
        const apartmentElement = document.querySelector('.apartment-info');
        if (apartmentElement) {
          apartmentElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          apartmentElement.style.opacity = '0';
          apartmentElement.style.transform = 'translateY(-10px)';
        }
      }
      
      // Kurz warten, um die Animation zu sehen
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Entferne die aktuelle Wohnung aus der Auswahlliste
      if (apartments) {
        const updatedApartments = apartments.filter(apt => apt.id !== selectedApartment.id);
        setApartments(updatedApartments);
      }
      
      // Setze die ausgewählte Wohnung zurück
      setSelectedApartment(null);
      
      setShowLeaveConfirmation(false);
      
      // Bestätigung anzeigen
      alert('Wohnung erfolgreich verlassen');
    } catch (error) {
      console.error('Fehler beim Verlassen der Wohnung:', error);
      alert(`Fehler beim Verlassen der Wohnung: ${error.message}`);
    }
  };

  
  // Funktion zum Bearbeiten einer Wohnung
  const handleEditApartment = async () => {
    try {
      if (!apartmentFormData.name || !apartmentFormData.address) {
        alert('Bitte fülle alle Felder aus');
        return;
      }
      
      // API-Aufruf zum Aktualisieren der Wohnung (Hier Mocking)
      console.log('Bearbeite Wohnung', selectedApartment.id, apartmentFormData);
      
      // Aktualisiere die aktuelle Wohnung
      const updatedApartment = {
        ...selectedApartment,
        name: apartmentFormData.name,
        address: apartmentFormData.address
      };
      
      // Aktualisiere die ausgewählte Wohnung
      setSelectedApartment(updatedApartment);
      
      // Aktualisiere die Wohnung in der Wohnungsliste
      if (apartments) {
        const updatedApartments = apartments.map(apt => 
          apt.id === selectedApartment.id ? updatedApartment : apt
        );
        setApartments(updatedApartments);
      }
      
      setShowEditApartmentModal(false);
    } catch (error) {
      console.error('Fehler beim Bearbeiten der Wohnung:', error);
      alert('Fehler beim Bearbeiten der Wohnung. Bitte versuche es später noch einmal.');
    }
  };

  // Funktion zum Löschen einer Wohnung
  const handleDeleteApartment = async () => {
    try {
      if (!selectedApartment || !selectedApartment.id) {
        alert('Keine Wohnung ausgewählt');
        return;
      }

      console.log('Lösche Wohnung', selectedApartment.id);
      
      // API-Aufruf zum Löschen der Wohnung
      const apiUrl = `http://localhost:5000/api/apartments/${selectedApartment.id}`;
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('token')
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP-Fehler: ${response.status}`);
      }
      
      // Subtile Animation hinzufügen (Fade-out mit leichter Verschiebung)
      if (selectedApartment) {
        const apartmentElement = document.querySelector('.apartment-info');
        if (apartmentElement) {
          apartmentElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          apartmentElement.style.opacity = '0';
          apartmentElement.style.transform = 'translateY(-10px)';
        }
      }
      
      // Kurz warten, um die Animation zu sehen
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Entferne die aktuelle Wohnung aus der Auswahlliste
      if (apartments) {
        const updatedApartments = apartments.filter(apt => apt.id !== selectedApartment.id);
        setApartments(updatedApartments);
        
        // WICHTIG: Aktualisiere auch den localStorage
        localStorage.setItem('apartments', JSON.stringify(updatedApartments));
      }
      
      // Setze die ausgewählte Wohnung zurück
      setSelectedApartment(null);
      setShowDeleteConfirmation(false);
      
      // Bestätigung anzeigen
      alert('Wohnung wurde erfolgreich gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen der Wohnung:', error);
      alert(`Fehler beim Löschen der Wohnung: ${error.message}`);
    }
  };

  // Funktion zum Kopieren des Einladungscodes in die Zwischenablage
  const copyInviteCode = async (wasRegenerated = false) => {
    try {
      if (!selectedApartment?.inviteCode) return;
      
      // Kopieren in die Zwischenablage
      await navigator.clipboard.writeText(selectedApartment.inviteCode);
      
      // Bei bereits erfolgter Regenerierung keine Animation auslösen
      if (!wasRegenerated) {
        setCodeAnimated(true);
        setTimeout(() => setCodeAnimated(false), 1500);
      }
      
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 3000);
    } catch (error) {
      console.error('Fehler beim Kopieren des Codes:', error);
    }
  };

  // Die Zustandsvariable für die Animation des neuen Codes wurde bereits oben deklariert

  // Funktion zum Regenerieren des Einladungscodes
  const regenerateInviteCode = async () => {
    try {
      if (!selectedApartment?.id) return;
      
      setLoadingInviteCode(true);
      
      // API-Aufruf zum Regenerieren des Einladungscodes
      const apiUrl = `http://localhost:5000/api/roommates/code/${selectedApartment.id}`;
      console.log('API-Aufruf an:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': localStorage.getItem('token')
        }
      });
      
      if (!response.ok) {
        // Text-Antwort für Debugging auslesen
        const errorText = await response.text();
        console.error('API-Fehler:', errorText);
        throw new Error(`Fehler beim Regenerieren des Einladungscodes: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API-Antwort Daten:', data);
      
      if (data && data.code) {
        // Setze den Einladungscode zum ausgewählten Apartment
        setSelectedApartment(prev => {
          if (!prev) return prev; // Sicherheitsprüfung
          
          return {
            ...prev,
            inviteCode: data.code
          };
        });
        
        // Animation auslösen
        setCodeAnimated(true);
        setTimeout(() => setCodeAnimated(false), 1500);
        
        // Direkt den neuen Code in die Zwischenablage kopieren, da wir jetzt sicher sind, dass der neue Code verfügbar ist
        await navigator.clipboard.writeText(data.code);
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 3000);
      } else {
        alert('Konnte keinen neuen Einladungscode generieren');
      }
    } catch (error) {
      console.error('Fehler beim Regenerieren des Einladungscodes:', error);
      alert(`Fehler beim Regenerieren des Einladungscodes: ${error.message}`);
    } finally {
      setLoadingInviteCode(false);
    }
  };

  return (
    <div className="container fadeIn">
      {/* Keine globale Benachrichtigungskomponente mehr, wir verwenden kontext-spezifische Meldungen */}
      
      {/* Modals für Wohnungsaktionen */}
      {showEditApartmentModal && selectedApartment && createPortal(
        <div className="fullscreen-menu fadeIn">
          <div className="fullscreen-menu-content dialog-medium">
            <div>
              <h2>Wohnung bearbeiten</h2>
              <button 
                className="icon-button" 
                onClick={() => setShowEditApartmentModal(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <div className="form-group">
              <label htmlFor="apartmentName">Name der Wohnung</label>
              <input
                id="apartmentName"
                type="text"
                className="input"
                placeholder="z.B. Meine WG"
                value={apartmentFormData.name}
                onChange={(e) => setApartmentFormData({...apartmentFormData, name: e.target.value})}
                style={{ width: '100%', marginBottom: '20px' }}
              />
              
              <AddressPicker
                label="Adresse"
                placeholder="z.B. Musterstraße 123, 12345 Berlin"
                value={apartmentFormData.address}
                onChange={(address, suggestion) => {
                  // Setze die formatierte Adresse und speichere die vollständigen Details, falls vorhanden
                  const newFormData = {
                    ...apartmentFormData,
                    address,
                    // Speichere die Geocoding-Daten, falls sie später benötigt werden
                    location: suggestion ? {
                      lat: suggestion.lat,
                      lon: suggestion.lon,
                      details: suggestion
                    } : undefined
                  };
                  setApartmentFormData(newFormData);
                }}
                required
                style={{ marginBottom: '20px' }}
              />
              
              <button 
                className="button primary"
                onClick={handleEditApartment}
                disabled={!apartmentFormData.name.trim() || !apartmentFormData.address.trim()}
                style={{ width: '100%', opacity: (!apartmentFormData.name.trim() || !apartmentFormData.address.trim()) ? '0.7' : '1' }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Bestätigungsdialog zum Verlassen der Wohnung */}
      {showLeaveConfirmation && selectedApartment && createPortal(
        <div className="fullscreen-menu fadeIn">
          <div className="fullscreen-menu-content dialog-small">
            <div>
              <h2>Wohnung verlassen</h2>
              <button 
                className="icon-button" 
                onClick={() => setShowLeaveConfirmation(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '20px' }}>
              Bist du sicher, dass du die Wohnung <strong>{selectedApartment.name}</strong> verlassen möchtest? Du wirst alle deine Daten in dieser Wohnung verlieren.
            </p>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="button secondary"
                onClick={() => setShowLeaveConfirmation(false)}
              >
                Abbrechen
              </button>
              <button 
                className="button danger"
                onClick={handleLeaveApartment}
              >
                Wohnung verlassen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Bestätigungsdialog zum Löschen der Wohnung */}
      {showDeleteConfirmation && selectedApartment && createPortal(
        <div className="fullscreen-menu fadeIn">
          <div className="fullscreen-menu-content dialog-small">
            <div>
              <h2>Wohnung löschen</h2>
              <button 
                className="icon-button" 
                onClick={() => setShowDeleteConfirmation(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '20px' }}>
              Bist du sicher, dass du die Wohnung <strong>{selectedApartment.name}</strong> löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden und alle Daten werden dauerhaft gelöscht.
            </p>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="button secondary"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                Abbrechen
              </button>
              <button 
                className="button danger"
                onClick={handleDeleteApartment}
                style={{ backgroundColor: 'var(--error)', boxShadow: '0 4px 12px rgba(255, 100, 124, 0.3)' }}
              >
                Wohnung löschen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal für Einladungscode */}
      {showInviteCodeModal && selectedApartment && createPortal(
        <div className="fullscreen-menu fadeIn">
          <div className="fullscreen-menu-content dialog-small">
            <div>
              <h2>Einladungscode teilen</h2>
              <button 
                className="icon-button" 
                onClick={() => setShowInviteCodeModal(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '15px' }}>
              Mit diesem Code können andere Benutzer deiner Wohnung <strong>{selectedApartment.name}</strong> beitreten:
            </p>
            
            <div style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              padding: '15px', 
              borderRadius: '8px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px',
              border: '2px dashed var(--border)'
            }}>
              <code style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                animation: codeAnimated ? 'highlight 1.5s ease-out' : 'none',
                display: 'block'
              }}>
                {selectedApartment.inviteCode || 'Kein Code verfügbar'}
              </code>
              
              {/* Stylesheet für die Animation */}
              <style jsx>{`
                @keyframes highlight {
                  0% { background-color: transparent; transform: scale(1); }
                  30% { background-color: var(--highlight, rgba(46, 204, 113, 0.3)); transform: scale(1.1); }
                  100% { background-color: transparent; transform: scale(1); }
                }
              `}</style>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="icon-button" 
                  onClick={copyInviteCode}
                  disabled={!selectedApartment.inviteCode}
                  title="Code kopieren"
                >
                  <FiCopy size={20} />
                </button>
                {selectedApartment.isOwner && (
                  <button 
                    className="icon-button" 
                    onClick={regenerateInviteCode}
                    title="Neuen Code generieren"
                  >
                    <FiRefreshCw size={20} />
                  </button>
                )}
              </div>
            </div>
            
            {selectedApartment.isOwner && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Als Besitzer kannst du einen neuen Code generieren, wenn der aktuelle Code nicht mehr funktionieren soll.
              </p>
            )}
            
            {showCopiedMessage && (
              <div style={{ 
                backgroundColor: 'var(--success)', 
                color: 'white', 
                padding: '10px', 
                borderRadius: '8px', 
                textAlign: 'center',
                marginBottom: '20px'
              }}>
                Code in die Zwischenablage kopiert!
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="button primary"
                onClick={() => setShowInviteCodeModal(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Modal für Eigentümerwechsel */}
      {showConfirmTransfer && selectedNewOwner && createPortal(
        <div className="fullscreen-menu fadeIn">
          <div className="fullscreen-menu-content dialog-small">
            <div>
              <h2>Eigentum übertragen</h2>
              <button 
                className="icon-button" 
                onClick={() => setShowConfirmTransfer(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '20px' }}>
              Bist du sicher, dass du <strong>{selectedApartment.name}</strong> an <strong>{selectedNewOwner.name}</strong> übergeben willst? 
              Du wirst dann normaler Mitbewohner und verlierst die Besitzerrechte.
            </p>
            
            {transferError && (
              <div style={{ 
                backgroundColor: 'var(--error-light)', 
                color: 'var(--error)', 
                padding: '10px', 
                borderRadius: '8px', 
                marginBottom: '15px'
              }}>
                {transferError}
              </div>
            )}

            {transferSuccess && (
              <div style={{ 
                backgroundColor: 'var(--success-light)', 
                color: 'var(--success)', 
                padding: '10px', 
                borderRadius: '8px', 
                marginBottom: '15px'
              }}>
                {transferSuccess}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="button secondary"
                onClick={() => setShowConfirmTransfer(false)}
                disabled={transferring}
              >
                Abbrechen
              </button>
              <button 
                className="button primary"
                onClick={() => transferOwnership(selectedNewOwner.id)}
                disabled={transferring}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                {transferring ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                    Übertrage...
                  </>
                ) : (
                  'Eigentum übertragen'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal für Mitbewohner kicken */}
      {showConfirmKick && selectedUserToKick && createPortal(
        <div className="fullscreen-menu fadeIn">
          <div className="fullscreen-menu-content dialog-small">
            <div>
              <h2>Mitbewohner entfernen</h2>
              <button 
                className="icon-button" 
                onClick={() => setShowConfirmKick(false)}
              >
                <FiX size={20} />
              </button>
            </div>
            
            <p style={{ marginBottom: '20px' }}>
              Bist du sicher, dass du <strong>{selectedUserToKick.name}</strong> aus der Wohnung <strong>{selectedApartment.name}</strong> entfernen möchtest?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            
            {kickError && (
              <div style={{ 
                backgroundColor: 'var(--error-light)', 
                color: 'var(--error)', 
                padding: '10px', 
                borderRadius: '8px', 
                marginBottom: '15px'
              }}>
                {kickError}
              </div>
            )}

            {kickSuccess && (
              <div style={{ 
                backgroundColor: 'var(--success-light)', 
                color: 'var(--success)', 
                padding: '10px', 
                borderRadius: '8px', 
                marginBottom: '15px'
              }}>
                {kickSuccess}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="button secondary"
                onClick={() => setShowConfirmKick(false)}
                disabled={kicking}
              >
                Abbrechen
              </button>
              <button 
                className="button danger"
                onClick={() => kickRoommate(selectedUserToKick.id)}
                disabled={kicking}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                {kicking ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                    Entferne...
                  </>
                ) : (
                  <>
                    <FiUserX size={16} />
                    Mitbewohner entfernen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <h1>Einstellungen</h1>
        
        {/* Wohnungsinfo */}
        {selectedApartment && (
          <div className="settings-section">
            <h3>Deine Wohnung</h3>
            <div className="apartment-info card">
              <h4>{selectedApartment.name}</h4>
              <p>{selectedApartment.address}</p>

              {/* Mitbewohner-Übersicht innerhalb der Wohnungs-Card */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <FiUsers size={18} />
                    <h4 style={{ margin: 0 }}>Mitbewohner</h4>
                  </div>
                  
                  {loadingRoommates ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                      <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                      <span style={{ marginLeft: '10px' }}>Lade Mitbewohner...</span>
                    </div>
                  ) : roommates.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                      Keine Mitbewohner gefunden
                    </p>
                  ) : (
                    <div>
                      {roommates.map(roommate => (
                        <div key={roommate.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '15px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-secondary)',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Avatar (Platzhalter) */}
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}>
                              {roommate.name.charAt(0).toUpperCase()}
                            </div>
                            
                            {/* Name mit Owner-Badge */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span>{roommate.name}</span>
                                {roommate.is_owner === 1 && (
                                  <span style={{
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem'
                                  }}>
                                    Besitzer
                                  </span>
                                )}
                                {roommate.id === currentUser.id && (
                                  <span style={{
                                    backgroundColor: 'var(--bg-primary)',
                                    color: 'var(--text-secondary)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    border: '1px solid var(--border)'
                                  }}>
                                    Du
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Aktions-Buttons nur für Owner anzeigen */}
                          {selectedApartment.isOwner && roommate.id !== currentUser.id && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {/* Icon-Button zum Besitzer machen (nur wenn der User nicht bereits Owner ist) */}
                              {roommate.is_owner !== 1 && (
                                <button
                                  className="icon-button"
                                  onClick={() => confirmTransferOwnership(roommate)}
                                  title="Zum Besitzer machen"
                                  style={{ color: 'var(--primary)' }}
                                >
                                  <FiAward size={18} />
                                </button>
                              )}
                              
                              {/* Icon-Button zum Entfernen (nur für nicht-Owner) */}
                              {roommate.is_owner !== 1 && (
                                <button
                                  className="icon-button"
                                  onClick={() => confirmKickRoommate(roommate)}
                                  title="Mitbewohner entfernen"
                                  style={{ color: 'var(--error)' }}
                                >
                                  <FiUserX size={18} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              
              {/* Apartment Management als Card-Buttons */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                <h4 style={{ margin: '0 0 15px 0' }}>Wohnungsverwaltung</h4>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  width: '100%'
                }}>
                  {/* Einladungscode teilen */}
                  <div 
                    onClick={() => setShowInviteCodeModal(true)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, background-color 0.2s ease',
                      gap: '10px',
                      width: '100%',
                      height: '80px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                  >
                    <FiShare2 size={24} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 'medium', color: 'var(--text-primary)' }}>Einladen</span>
                  </div>
                  
                  {/* Wohnung bearbeiten (nur für Owner) */}
                  <div 
                    onClick={() => selectedApartment.isOwner ? setShowEditApartmentModal(true) : null}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 8px',
                      borderRadius: '8px',
                      backgroundColor: selectedApartment.isOwner ? 'var(--bg-secondary)' : 'var(--bg-disabled)',
                      cursor: selectedApartment.isOwner ? 'pointer' : 'not-allowed',
                      transition: 'transform 0.2s ease, background-color 0.2s ease',
                      gap: '10px',
                      width: '100%',
                      height: '80px',
                      opacity: selectedApartment.isOwner ? 1 : 0.6
                    }}
                    onMouseOver={(e) => {
                      if (selectedApartment.isOwner) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedApartment.isOwner) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }
                    }}
                  >
                    <FiEdit size={24} style={{ color: selectedApartment.isOwner ? 'var(--text-primary)' : 'var(--text-disabled)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 'medium', color: selectedApartment.isOwner ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                      Bearbeiten
                    </span>
                  </div>
                  
                  {/* Wohnung löschen oder verlassen */}
                  <div 
                    onClick={() => selectedApartment.isOwner ? setShowDeleteConfirmation(true) : setShowLeaveConfirmation(true)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, background-color 0.2s ease',
                      gap: '10px',
                      width: '100%',
                      height: '80px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                  >
                    {selectedApartment.isOwner ? (
                      <>
                        <FiTrash2 size={24} style={{ color: 'var(--error)' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 'medium', color: 'var(--error)' }}>Löschen</span>
                      </>
                    ) : (
                      <>
                        <FiX size={24} style={{ color: 'var(--error)' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 'medium', color: 'var(--error)' }}>Verlassen</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Push-Benachrichtigungen Einstellungen - Opt-Out-Modell */}
        <div className="settings-section">
          <h3>Benachrichtigungen</h3>
          <div style={{ 
            backgroundColor: 'var(--bg-secondary)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '15px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <FiBell size={18} color="var(--primary)" />
              <span style={{ fontWeight: '500' }}>Push-Benachrichtigungen</span>
            </div>
            
            <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Du erhältst automatisch Benachrichtigungen bei wichtigen Ereignissen, wie erledigten Aufgaben. Die Einstellungen kannst du hier anpassen.
            </p>
            
            {selectedApartment ? (
              <>
                {/* Opt-Out-Steuerung für Benachrichtigungen */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '6px',
                  marginBottom: '15px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: '500', fontSize: '0.95rem' }}>
                      Status: {localStorage.getItem('notificationsOptOut') === 'true' ? 
                        'Deaktiviert' : 
                        (Notification.permission === 'granted' ? 'Aktiviert' : 'Nicht erlaubt')}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {localStorage.getItem('notificationsOptOut') === 'true' ? 
                        'Du erhältst keine automatischen Benachrichtigungen mehr.' : 
                        'Du wirst über alle wichtigen Ereignisse informiert.'}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (localStorage.getItem('notificationsOptOut') === 'true') {
                        // Benachrichtigungen wieder aktivieren
                        localStorage.removeItem('notificationsOptOut');
                        // Nach neu laden der Seite werden Benachrichtigungen automatisch aktiviert
                        window.location.reload();
                      } else {
                        // Benachrichtigungen deaktivieren
                        localStorage.setItem('notificationsOptOut', 'true');
                        alert('Benachrichtigungen wurden deaktiviert. Bestehende Subscriptions werden bei der nächsten Anmeldung entfernt.');
                      }
                    }}
                    style={{
                      backgroundColor: localStorage.getItem('notificationsOptOut') === 'true' ? 'var(--success)' : 'var(--error)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }}
                  >
                    {localStorage.getItem('notificationsOptOut') === 'true' ? 'Aktivieren' : 'Deaktivieren'}
                  </button>
                </div>
                
                {/* Tools für Diagnose und Reset */}
                <div style={{ 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '12px',
                  marginTop: '5px' 
                }}>
                  <details style={{ fontSize: '14px' }}>
                    <summary style={{ 
                      cursor: 'pointer', 
                      color: 'var(--text-secondary)',
                      padding: '6px 0',
                      fontWeight: '500'
                    }}>
                      Diagnose & Problembehandlung
                    </summary>
                    
                    <div style={{ 
                      padding: '10px 0 0 0', 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '10px' 
                    }}>
                      {/* Reset-Button von NotificationPrompt */}
                      <button
                        onClick={() => {
                          try {
                            localStorage.setItem('resetServiceWorker', 'true');
                            alert('Service Worker wurde zum Zurücksetzen markiert. Bitte lade die Seite neu.');
                          } catch (e) {
                            console.error('Fehler beim Zurücksetzen:', e);
                          }
                        }}
                        style={{
                          backgroundColor: 'var(--warning)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                      >
                        Service Worker zurücksetzen
                      </button>

                      {/* Test-Benachrichtigung Button */}
                      <button
                        onClick={() => {
                          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.controller.postMessage({
                              type: 'TEST_NOTIFICATION'
                            });
                          } else {
                            alert('Kein aktiver Service Worker gefunden');
                          }
                        }}
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                      >
                        Test-Benachrichtigung senden
                      </button>
                    </div>
                  </details>
                </div>
                
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Diese Buttons sind nur für Testzwecke und können verwendet werden, um Browser-Benachrichtigungs-Probleme zu diagnostizieren.
                </div>
              </>
            ) : (
              // Hinweis, wenn keine Wohnung ausgewählt ist
              <div style={{ 
                backgroundColor: 'var(--bg-hover)', 
                padding: '12px', 
                borderRadius: '6px', 
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                Wähle zuerst eine Wohnung aus, um Benachrichtigungen zu aktivieren.
              </div>
            )}
          </div>
        </div>
        
        {/* Benutzerinfo */}
        
        <div className="settings-section">
          <h3>Konto</h3>
          <div style={{ marginBottom: '20px' }}>
            <button 
              className="button danger"
              onClick={handleLogout}
              style={{ width: '100%' }}
            >
              <FiLogOut style={{ marginRight: '5px' }} /> Abmelden
            </button>
          </div>
        </div>
        
        {/* Theme-Einstellungen */}
        <div className="settings-section">
          <h3>Erscheinungsbild</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            width: '100%'
          }}>
            {/* Helles Theme */}
            <div 
              onClick={() => changeThemePreference('light')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                borderRadius: '8px',
                backgroundColor: theme.name === 'light' ? 'var(--primary-light)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, background-color 0.2s ease',
                gap: '10px',
                width: '100%',
                height: '80px',
                border: theme.name === 'light' ? '2px solid var(--primary)' : 'none'
              }}
              onMouseOver={(e) => {
                if (theme.name !== 'light') {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }
              }}
              onMouseOut={(e) => {
                if (theme.name !== 'light') {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }
              }}
            >
              <FiSun size={24} style={{ color: theme.name === 'light' ? 'var(--primary)' : 'var(--text-primary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: theme.name === 'light' ? 'bold' : 'normal', color: theme.name === 'light' ? 'var(--primary)' : 'var(--text-primary)' }}>
                Hell
              </span>
            </div>
            
            {/* Dunkles Theme */}
            <div 
              onClick={() => changeThemePreference('dark')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                borderRadius: '8px',
                backgroundColor: theme.name === 'dark' ? 'var(--primary-light)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, background-color 0.2s ease',
                gap: '10px',
                width: '100%',
                height: '80px',
                border: theme.name === 'dark' ? '2px solid var(--primary)' : 'none'
              }}
              onMouseOver={(e) => {
                if (theme.name !== 'dark') {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }
              }}
              onMouseOut={(e) => {
                if (theme.name !== 'dark') {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }
              }}
            >
              <FiMoon size={24} style={{ color: theme.name === 'dark' ? 'var(--primary)' : 'var(--text-primary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: theme.name === 'dark' ? 'bold' : 'normal', color: theme.name === 'dark' ? 'var(--primary)' : 'var(--text-primary)' }}>
                Dunkel
              </span>
            </div>
            
            {/* Niedliches Theme */}
            <div 
              onClick={() => changeThemePreference('cute')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                borderRadius: '8px',
                backgroundColor: theme.name === 'cute' ? 'var(--primary-light)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, background-color 0.2s ease',
                gap: '10px',
                width: '100%',
                height: '80px',
                border: theme.name === 'cute' ? '2px solid var(--primary)' : 'none'
              }}
              onMouseOver={(e) => {
                if (theme.name !== 'cute') {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }
              }}
              onMouseOut={(e) => {
                if (theme.name !== 'cute') {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }
              }}
            >
              <FiHeart size={24} style={{ color: theme.name === 'cute' ? 'var(--primary)' : 'var(--text-primary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: theme.name === 'cute' ? 'bold' : 'normal', color: theme.name === 'cute' ? 'var(--primary)' : 'var(--text-primary)' }}>
                Niedlich
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Zusätzlicher Div am Ende des Containers für Abstand zur Navbar */}
      <div style={{ marginBottom: '120px' }}></div>
    </div>
  );
};

export default Settings;
