import React, { useState, useEffect } from 'react';
import { FiCopy, FiCheck, FiUsers, FiUser, FiRefreshCw, FiMail, FiEdit2, FiPhone, FiPlus, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import { roommateService } from '../services/api';
import './styles.css';

const Roommates = ({ selectedApartment, currentUser }) => {
  // Extrahiere apartmentId und setze currentApartment auf selectedApartment
  const apartmentId = selectedApartment?.id || 0;
  const currentApartment = selectedApartment;
  const [roommates, setRoommates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadRoommates = async () => {
      if (!apartmentId) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await roommateService.getAll(apartmentId);
        setRoommates(data);
        
        // Lade den Einladungscode für die Wohnung
        if (currentApartment && currentApartment.inviteCode) {
          setInviteCode(currentApartment.inviteCode);
        } else {
          // Wenn kein Code existiert, lade einen neuen
          try {
            const code = await roommateService.getInviteCode(apartmentId);
            setInviteCode(code || '');
          } catch (codeError) {
            console.warn('Konnte Einladungscode nicht laden:', codeError);
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden der Mitbewohner:', error);
        
        // Detaillierte Fehlerinformationen für bessere Diagnose
        const statusCode = error.response ? error.response.status : 'Keine HTTP-Antwort';
        const errorType = error.message.includes('Network Error') ? 'Netzwerkfehler' : 'API-Fehler';
        const errorDetails = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        
        // Setze spezifischeren und hilfreicheren Fehlertext
        setError({
          message: `Fehler beim Laden der Mitbewohner (${errorType}, Status: ${statusCode})`,
          details: errorDetails,
          type: errorType,
          code: statusCode
        });
        
        // Logging für Debugging (auch mobil über RemoteDevTools möglich)
        console.group('%cRoommates Fehlerdiagnose', 'color: #cc0000; font-weight: bold;');
        console.log('API-Endpunkt:', `/roommates/${apartmentId}/members`);
        console.log('Fehlertyp:', errorType);
        console.log('HTTP-Status:', statusCode);
        console.log('Fehlermeldung:', error.message);
        console.log('Details:', errorDetails);
        console.groupEnd();
        
        // Fallback: Mock-Daten, wenn keine Verbindung zum Backend besteht
        if (error.message && error.message.includes('Network Error')) {
          console.info('%cVerwende Mock-Daten als Fallback', 'color: #0066aa;');
          setRoommates([
            { id: 1, name: 'Max Mustermann', email: 'max@example.com', isOwner: true, joinedAt: '2025-01-01T10:00:00Z' },
            { id: 2, name: 'Anna Schmidt', email: 'anna@example.com', isOwner: false, joinedAt: '2025-01-02T14:30:00Z' },
            { id: 3, name: 'Lisa Meyer', email: 'lisa@example.com', isOwner: false, joinedAt: '2025-02-15T09:15:00Z' }
          ]);
          
          // Mock-Einladungscode
          setInviteCode('ABC123');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRoommates();
  }, [apartmentId, currentApartment]);

  // Einladungscode in Zwischenablage kopieren
  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Fehler beim Kopieren in die Zwischenablage: ', err);
        alert('Code konnte nicht kopiert werden: ' + inviteCode);
      });
  };

  // Neuen Einladungscode generieren
  const generateNewInviteCode = async () => {
    try {
      setGenerating(true);
      setError(null);
      const newCode = await roommateService.generateInviteCode(apartmentId);
      setInviteCode(newCode);
    } catch (error) {
      console.error('Fehler beim Generieren eines neuen Einladungscodes:', error);
      setError('Der Einladungscode konnte nicht generiert werden. Bitte versuche es später erneut.');
      
      // Fallback: Mock-Einladungscode, wenn keine Verbindung zum Backend besteht
      if (error.message && error.message.includes('Network Error')) {
        const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        setInviteCode(mockCode);
      }
    } finally {
      setGenerating(false);
    }
  };

  // Hilfsfunktion zum Formatieren des Datums
  const formatDate = (dateString) => {
    if (!dateString) return 'Unbekannt';
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('de-DE', { 
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    } catch (error) {
      console.error('Fehler beim Formatieren des Datums:', error);
      return 'Ungültiges Datum';
    }
  };

  if (loading) {
    return (
      <div className="container fadeIn">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Lade Mitbewohner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container fadeIn">
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <FiUsers style={{ marginRight: '10px' }} /> Mitbewohner
        </h2>
        
        {error && (
          <div className="alert error" style={{ 
            marginBottom: '20px', 
            padding: '15px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FiAlertCircle style={{ marginRight: '8px', color: '#cc0000', flexShrink: 0 }} size={20} />
              <span style={{ fontWeight: '500' }}>
                {typeof error === 'string' ? error : error.message}
              </span>
            </div>
            
            {/* Details nur anzeigen, wenn error ein Objekt mit details ist */}
            {typeof error === 'object' && error.details && (
              <div style={{ 
                fontSize: '14px', 
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                padding: '10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                overflowX: 'auto'
              }}>
                <div style={{ marginBottom: '5px', color: '#666' }}>
                  <strong>Status:</strong> {error.code} | <strong>Typ:</strong> {error.type}
                </div>
                <div style={{ wordBreak: 'break-word' }}>{error.details}</div>
              </div>
            )}

            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: 'auto',
                marginTop: '5px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 0, 0, 0.3)',
                color: '#cc0000',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Ausblenden
            </button>
          </div>
        )}
        
        {/* Einladungscode */}
        <div className="roommate-section" style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'rgba(var(--primary-rgb), 0.05)', borderRadius: 'var(--card-radius)' }}>
          <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
            <FiMail style={{ marginRight: '8px' }} /> Einladungscode
          </h3>
          <p style={{ marginBottom: '15px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Teile diesen Code mit deinen Mitbewohnern, damit sie der Wohnung beitreten können.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <div 
              className="invite-code" 
              style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                padding: '10px 15px',
                backgroundColor: 'var(--card-background)',
                borderRadius: 'var(--button-radius)',
                marginRight: '10px',
                letterSpacing: '3px',
                flex: 1,
                textAlign: 'center',
                border: '2px dashed rgba(var(--primary-rgb), 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {inviteCode || 'KEIN CODE VERFÜGBAR'}
            </div>
            <button 
              className="button primary" 
              onClick={copyInviteCode}
              disabled={!inviteCode || generating}
              style={{ minWidth: '120px' }}
            >
              {copied ? <FiCheck /> : <FiCopy />}
              <span style={{ marginLeft: '5px' }}>{copied ? 'Kopiert!' : 'Kopieren'}</span>
            </button>
          </div>
          
          <button
            className="button secondary"
            onClick={generateNewInviteCode}
            disabled={generating}
            style={{ padding: '8px 12px', fontSize: '14px', display: 'flex', alignItems: 'center' }}
          >
            {generating ? (
              <>
                <div className="button-spinner" style={{ marginRight: '8px' }}></div>
                Generiere...
              </>
            ) : (
              <>
                <FiRefreshCw style={{ marginRight: '8px' }} />
                Neuen Einladungscode generieren
              </>
            )}
          </button>
          
          <div style={{ marginTop: '15px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <strong>Hinweis:</strong> Wenn du einen neuen Code generierst, wird der alte Code ungültig.
          </div>
        </div>
        
        {/* Mitbewohnerliste */}
        <div className="roommate-section" style={{ padding: '20px', backgroundColor: 'var(--card-background)', borderRadius: 'var(--card-radius)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <FiUsers style={{ marginRight: '8px' }} /> 
              Aktuelle Mitbewohner
            </span>
            <span className="roommate-count" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {roommates.length} {roommates.length === 1 ? 'Mitbewohner' : 'Mitbewohner'}
            </span>
          </h3>

          {roommates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
              <FiUsers size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
              <p>Es sind noch keine Mitbewohner in dieser Wohnung.</p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>Teile den Einladungscode, um Mitbewohner einzuladen.</p>
            </div>
          ) : (
            <div className="roommate-list">
              {roommates.map((roommate, index) => (
                <div
                  key={roommate.id}
                  className="roommate-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '15px',
                    marginBottom: index < roommates.length - 1 ? '10px' : 0,
                    backgroundColor: 'var(--background-secondary)',
                    borderRadius: 'var(--card-radius)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    className="roommate-avatar"
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: `hsl(${(roommate.id * 40) % 360}, 70%, 60%)`,
                      borderRadius: '50%',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '15px',
                      fontSize: '20px',
                      flexShrink: 0
                    }}
                  >
                    {roommate.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {roommate.name}
                      </span>
                      {roommate.isOwner && (
                        <span
                          style={{
                            backgroundColor: 'var(--primary-color)',
                            color: 'white',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Besitzer
                        </span>
                      )}
                      {currentUser && roommate.email === currentUser.email && (
                        <span
                          style={{
                            backgroundColor: '#4caf50',
                            color: 'white',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            marginLeft: '5px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Du
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '3px' }}>{roommate.email}</div>
                    {roommate.joinedAt && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                        Beigetreten: {formatDate(roommate.joinedAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Roommates;
