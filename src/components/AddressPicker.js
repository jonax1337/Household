import React, { useState, useEffect, useRef } from 'react';
import { FiMapPin, FiLoader, FiCheck, FiInfo } from 'react-icons/fi';

// Debounce-Funktion zur Verzögerung von API-Aufrufen
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const AddressPicker = ({ value, onChange, placeholder, label, disabled, required }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSelected, setIsSelected] = useState(Boolean(value)); // Status, ob eine Adresse ausgewu00e4hlt wurde
  const [selectedAddress, setSelectedAddress] = useState(null); // Speichert alle Details der ausgewählten Adresse
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  // Debounce die Eingabe, damit die API nicht bei jedem Tastenanschlag aufgerufen wird
  const debouncedInputValue = useDebounce(inputValue, 500); // 500ms Verzögerung
  
  // Initialize Google Places Autocomplete
  useEffect(() => {
    // Update inputValue when value prop changes
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Handle outside clicks to close the suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // API Key fu00fcr Geoapify
  const GEOAPIFY_API_KEY = '92c267d085b9475dac4144d0f1a3e2de';

  // Adressvorschlu00e4ge von Geoapify Geocoding API abrufen
  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Geoapify Geocoding API mit Autocomplete-Funktion verwenden - korrigierter Endpunkt und Parameter
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&filter=countrycode:de&lang=de&apiKey=${GEOAPIFY_API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Netzwerkfehler bei der Adresssuche');
      }
      
      const data = await response.json();
      
      // Überprüfe, ob die Antwort das erwartete Format hat
      const results = data.features || [];
      if (!Array.isArray(results)) {
        console.warn('Unerwartetes Antwortformat von Geoapify:', data);
        setSuggestions([]);
        return;
      }
      
      // Formatiere die Daten mit mehr Details
      const formattedSuggestions = results.map((item, index) => {
        // Extrahiere die wichtigsten Adresskomponenten aus der Geoapify-Antwort
        const properties = item.properties || {};
        const street = properties.street || '';
        const houseNumber = properties.housenumber || '';
        const postcode = properties.postcode || '';
        const city = properties.city || properties.town || properties.village || '';
        const state = properties.state || '';
        const country = properties.country || '';
        const formattedAddress = properties.formatted || '';
        
        // Log zur Fehlersuche
        console.log('Geoapify Ergebnis:', properties);

        // Erstelle ein strukturiertes Adressobjekt mit allen relevanten Daten
        return {
          id: index,
          text: formattedAddress,
          formattedAddress: formattedAddress,
          street,
          houseNumber,
          postcode,
          city,
          state,
          country,
          lat: properties.lat,
          lon: properties.lon,
          bbox: properties.bbox,
          rank: properties.rank,
          placeId: properties.place_id,
          category: properties.category,
          rawData: item
        };
      });
      
      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error('Fehler beim Abrufen der Adressvorschläge:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verwende die debounced Eingabe, um API-Anfragen zu verzu00f6gern
  useEffect(() => {
    if (debouncedInputValue && !isSelected) {
      fetchSuggestions(debouncedInputValue);
    }
  }, [debouncedInputValue]);
  
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setIsSelected(false); // Zurücksetzen des Auswahlstatus
    // Kein direkter API-Aufruf mehr hier - das wird nun durch den debounced Effect gemacht
  };
  
  const handleSuggestionClick = (suggestion) => {
    // Verwende die formattedAddress wenn vorhanden, ansonsten den vollstu00e4ndigen text
    const displayAddress = suggestion.formattedAddress || suggestion.text;
    setInputValue(displayAddress);
    // Gib die vollstu00e4ndige Suggestion zuru00fcck, damit mehr Informationen verfu00fcgbar sind
    onChange(displayAddress, suggestion); 
    setSelectedAddress(suggestion);
    setIsSelected(true);
    setSuggestions([]);
  };
  
  const handleFocus = () => {
    setIsFocused(true);
    if (inputValue) {
      fetchSuggestions(inputValue);
    }
  };

  return (
    <div className="address-picker-container" style={{ position: 'relative' }}>
      {label && (
        <label 
          htmlFor="address-input" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '8px', 
            fontSize: '14px'
          }}
        >
          <FiMapPin style={{ marginRight: '8px' }} />
          {label}
          {required && <span style={{ color: 'var(--danger-color)', marginLeft: '3px' }}>*</span>}
        </label>
      )}
      
      <div style={{ position: 'relative' }}>
        <input
          id="address-input"
          ref={inputRef}
          type="text"
          className={`input ${isFocused ? 'focus' : ''} ${isSelected ? 'valid' : ''}`}
          placeholder={placeholder || "Adresse eingeben..."}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          style={{ width: '100%' }}
        />
        
        {isLoading && (
          <div style={{ 
            position: 'absolute', 
            right: '8px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }}>
            <FiLoader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
        
        {isSelected && !isLoading && (
          <div style={{ 
            position: 'absolute', 
            right: '8px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--success)'
          }}>
            <FiCheck size={16} />
          </div>
        )}
      </div>
      
      {suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="address-suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'var(--card-background)', // Undurchsichtiger Hintergrund im Card-Stil
            backdropFilter: 'var(--glass-blur)', // Unschärfe-Effekt für Glasmorphismus
            WebkitBackdropFilter: 'var(--glass-blur)', // Für Safari
            border: 'var(--glass-border)',
            borderRadius: 'var(--button-radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginTop: '-12px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <FiMapPin style={{ marginRight: '8px', marginTop: '3px', flexShrink: 0, color: 'var(--primary-color)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: suggestion.formattedAddress ? 'bold' : 'normal' }}>
                    {suggestion.formattedAddress || suggestion.text.split(',')[0]}
                  </span>
                  {suggestion.formattedAddress && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {suggestion.city && suggestion.state ? `${suggestion.city}, ${suggestion.state}` : suggestion.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
  if (!document.getElementById('address-picker-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'address-picker-styles';
    styleTag.innerHTML = spinnerStyle;
    document.head.appendChild(styleTag);
  }
}

export default AddressPicker;
