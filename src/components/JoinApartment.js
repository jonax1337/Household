import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiUsers, FiKey, FiLoader, FiX } from 'react-icons/fi';

const JoinApartment = ({ isOpen, onClose, onJoinApartment }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  // Debugging
  useEffect(() => {
    console.log('JoinApartment: isOpen =', isOpen);
  }, [isOpen]);
  
  // Formular zurücksetzen, wenn das Modal geöffnet/geschlossen wird
  useEffect(() => {
    if (isOpen) {
      setInviteCode('');
      setError('');
      setIsJoining(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Bitte gib einen Einladungscode ein');
      return;
    }

    setError('');
    setIsJoining(true);
    try {
      await onJoinApartment(inviteCode.trim());
      setInviteCode('');
      onClose();
    } catch (error) {
      console.error('Fehler beim Beitreten:', error);
      setError(error.message || 'Ungültiger Einladungscode');
    } finally {
      setIsJoining(false);
    }
  };
  
  return createPortal(
    <div className="fullscreen-menu fadeIn">
      <div className="fullscreen-menu-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Einer Wohnung beitreten</h2>
          <button 
            className="icon-button" 
            onClick={onClose}
            disabled={isJoining}
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
          <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
            Gib den Einladungscode ein, den du von einem Mitbewohner erhalten hast.
          </p>
          
          <label htmlFor="inviteCode">
            <FiKey style={{ marginRight: '5px' }} />
            Einladungscode
          </label>
          <input 
            id="inviteCode"
            type="text" 
            className="input"
            placeholder="z.B. ABC123" 
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={isJoining}
            style={{ width: '100%', marginBottom: '25px' }}
            autoFocus
          />
          
          <button 
            className="button primary" 
            disabled={!inviteCode.trim() || isJoining}
            onClick={handleJoin}
            style={{ width: '100%' }}
          >
            {isJoining ? (
              <>
                <FiLoader size={18} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                Wird beigetreten...
              </>
            ) : (
              <>
                <FiUsers size={18} style={{ marginRight: '8px' }} />
                Beitreten
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default JoinApartment;
