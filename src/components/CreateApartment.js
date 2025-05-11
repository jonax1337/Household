import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiHome, FiMapPin, FiPlus, FiLoader, FiX } from 'react-icons/fi';
import AddressPicker from './AddressPicker';

const CreateApartment = ({ isOpen, onClose, onCreateApartment }) => {
  const [apartmentData, setApartmentData] = useState({ name: '', address: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Debugging
  useEffect(() => {
    console.log('CreateApartment: isOpen =', isOpen);
  }, [isOpen]);

  // Formular zurücksetzen, wenn das Modal geöffnet/geschlossen wird
  useEffect(() => {
    if (isOpen) {
      setApartmentData({ name: '', address: '' });
      setError('');
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Funktion zum Generieren eines zufälligen Einladungscodes
  const generateInviteCode = () => {
    // Erzeugt einen 8-stelligen alphanumerischen Code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const handleSubmit = async () => {
    console.log('Erstelle Wohnung mit:', apartmentData.name, apartmentData.address);
    
    // Validierung
    if (!apartmentData.name.trim() || !apartmentData.address.trim()) {
      setError('Bitte gib sowohl einen Namen als auch eine Adresse für die Wohnung ein!');
      return;
    }
    
    // Loading-Status setzen
    setIsLoading(true);
    setError('');
    
    try {
      // Generiere einen Einladungscode
      const inviteCode = generateInviteCode();
      console.log('Generierter Einladungscode:', inviteCode);
      
      // Rufe die übergebene onCreateApartment-Funktion mit den erforderlichen Parametern auf
      // Füge den Einladungscode hinzu
      await onCreateApartment(apartmentData.name, apartmentData.address, inviteCode);
      
      // Setze die Eingabefelder zurück
      setApartmentData({ name: '', address: '' });
      
      // Schließe das Modal
      onClose();
    } catch (err) {
      setError(err.message || 'Fehler beim Erstellen der Wohnung');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fullscreen-menu fadeIn">
      <div className="fullscreen-menu-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Neue Wohnung erstellen</h2>
          <button 
            className="icon-button" 
            onClick={onClose}
            disabled={isLoading}
          >
            <FiX size={20} />
          </button>
        </div>
        
        {error && (
          <div style={{ color: 'var(--danger-color)', marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(var(--danger-rgb), 0.1)', borderRadius: 'var(--border-radius)' }}>
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="apartmentName">
            <FiHome style={{ marginRight: '5px' }} />
            Name der Wohnung
          </label>
          <input 
            id="apartmentName"
            type="text" 
            className="input"
            placeholder="z.B. Meine WG" 
            value={apartmentData.name}
            onChange={(e) => setApartmentData({...apartmentData, name: e.target.value})}
            disabled={isLoading}
            style={{ width: '100%', marginBottom: '20px' }}
            autoFocus
          />
          
          <label>Adresse</label>
          <AddressPicker
            placeholder="z.B. Musterstraße 123, 12345 Berlin" 
            value={apartmentData.address}
            onChange={(address, suggestion) => {
              // Setze die formatierte Adresse und speichere die vollständigen Details
              const newData = {
                ...apartmentData,
                address,
                location: suggestion ? {
                  lat: suggestion.lat,
                  lon: suggestion.lon,
                  details: suggestion
                } : undefined
              };
              setApartmentData(newData);
            }}
            disabled={isLoading}
            required
            style={{ marginBottom: '25px' }}
          />
          
          <button 
            className="button primary" 
            disabled={!apartmentData.name.trim() || !apartmentData.address.trim() || isLoading}
            onClick={handleSubmit}
            style={{ width: '100%', opacity: (!apartmentData.name.trim() || !apartmentData.address.trim() || isLoading) ? '0.7' : '1' }}
          >
            {isLoading ? (
              <>
                <FiLoader size={18} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                Wird erstellt...
              </>
            ) : (
              <>
                <FiPlus size={18} style={{ marginRight: '8px' }} />
                Erstellen
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// CSS für den Spinner
const spinnerStyle = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

// Füge den Spinner-Style zum Dokument hinzu
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.innerHTML = spinnerStyle;
  document.head.appendChild(styleTag);
}

export default CreateApartment;
