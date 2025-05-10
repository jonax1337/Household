import React, { useState } from 'react';
import { FiLock, FiMail, FiUser, FiEye, FiEyeOff } from 'react-icons/fi';
import { authService } from '../services/api';

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '',
    name: '' 
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Testdaten für die Entwicklung - zum einfachen Ausfüllen des Formulars
  const fillWithTestData = () => {
    setFormData({
      name: 'Test Benutzer',
      email: 'neu@example.com',
      password: 'passwort123',
      confirmPassword: 'passwort123'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({...formData, [name]: value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); // Fehler zurücksetzen bei jedem Versuch
    
    try {
      // Validierung
      if (!formData.name.trim()) {
        throw new Error('Bitte geben Sie Ihren Namen ein');
      }
      if (!formData.email.trim()) {
        throw new Error('Bitte geben Sie Ihre E-Mail-Adresse ein');
      }
      if (!formData.password) {
        throw new Error('Bitte geben Sie ein Passwort ein');
      }
      if (formData.password.length < 6) {
        throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein');
      }
      
      // Passwörter prüfen
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Die Passwörter stimmen nicht überein');
      }
      
      console.log('%c[REGISTER] Sende Registrierungs-Anfrage an Backend', 'color: #2196F3; font-weight: bold;', {
        name: formData.name,
        email: formData.email,
        // Passwort aus Sicherheitsgründen nicht loggen
      });
      
      // Registrierung durchführen
      const response = await authService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      
      // Die Server-Antwort prüfen (Backend sendet keinen success-Wert, aber ein message und token Feld)
      if (response && (response.token || response.message)) {
        console.log('%c[REGISTER] Registrierung erfolgreich', 'color: #2196F3; font-weight: bold;', response);
        
        // NICHT mehr automatisch anmelden!
        // Stattdessen zur Login-Seite weiterleiten
        alert('Registrierung erfolgreich! Bitte melden Sie sich jetzt an.');
        
        // Erfolgsmeldung anzeigen
        setError('');
        
        // Zur Login-Seite weiterleiten statt automatischem Login
        onSwitchToLogin();
      } else {
        throw new Error('Registrierung fehlgeschlagen: Ungültige Antwort vom Server');
      }
    } catch (error) {
      console.error('Registrierung fehlgeschlagen:', error);
      setError(error.message || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container fadeIn">
      {/* Glasmorphismus Hintergrund-Formen - gleiche wie im Dashboard */}
      <div className="bg-shape bg-shape-1" data-speed="0.03"></div>
      <div className="bg-shape bg-shape-2" data-speed="0.05"></div>
      <div className="bg-shape bg-shape-3" data-speed="0.02"></div>
      
      <div className="card fadeIn" style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingTop: '0', paddingBottom: '0' }}>
        <div style={{ padding: '30px' }}>
          <h1 style={{ marginBottom: '30px', textAlign: 'center' }}>Registrieren</h1>
          
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label htmlFor="name" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiUser style={{ marginRight: '8px' }} />
                Name
              </label>
              <input 
                id="name"
                type="text" 
                name="name" 
                placeholder="Dein Name" 
                className="input"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="registerEmail" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiMail style={{ marginRight: '8px' }} />
                E-Mail
              </label>
              <input 
                id="registerEmail"
                type="email" 
                name="email" 
                placeholder="deine@email.de" 
                className="input"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="registerPassword" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiLock style={{ marginRight: '8px' }} />
                Passwort
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  id="registerPassword"
                  type={showPassword ? 'text' : 'password'} 
                  name="password" 
                  placeholder="Sicheres Passwort" 
                  className="input"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  style={{ paddingRight: '40px' }}
                />
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="confirmPassword" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiLock style={{ marginRight: '8px' }} />
                Passwort bestätigen
              </label>
              <input 
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'} 
                name="confirmPassword" 
                placeholder="Passwort wiederholen" 
                className="input"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p style={{ color: 'var(--error)', fontSize: '12px', marginTop: '4px' }}>
                  Die Passwörter stimmen nicht überein.
                </p>
              )}
            </div>
            
            <button 
              type="submit" 
              className="button" 
              style={{ width: '100%' }}
              disabled={loading || (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword)}
            >
              {loading ? 
                'Registrieren...' : 
                <>
                  <FiUser /> Registrieren
                </>
              }
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Bereits registriert? 
              <button 
                onClick={onSwitchToLogin} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--primary)', 
                  cursor: 'pointer',
                  padding: '0 5px',
                  fontWeight: '500'
                }}
              >
                Anmelden
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
