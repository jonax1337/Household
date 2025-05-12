import React, { useState, useEffect } from 'react';
import { FiLock, FiMail, FiUser, FiEye, FiEyeOff, FiCheck, FiX } from 'react-icons/fi';
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
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState({
    minLength: false,
    hasLetter: false,
    hasNumber: false,
    hasSpecial: false
  });
  
  // Testdaten für die Entwicklung - zum einfachen Ausfüllen des Formulars
  const fillWithTestData = () => {
    setFormData({
      name: 'Test Benutzer',
      email: 'neu@example.com',
      password: 'passwort123',
      confirmPassword: 'passwort123'
    });
  };

  // Prüft die Stärke des Passworts und aktualisiert Feedback
  const checkPasswordStrength = (password) => {
    // Passwort-Kriterien prüfen
    const criteria = {
      minLength: password.length >= 6,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^a-zA-Z0-9]/.test(password)
    };
    
    setPasswordFeedback(criteria);
    
    // Passwortstärke berechnen (0-100)
    let strength = 0;
    
    if (criteria.minLength) strength += 25;
    if (criteria.hasLetter) strength += 25;
    if (criteria.hasNumber) strength += 25;
    if (criteria.hasSpecial) strength += 25;
    
    // Zusätzliche Punkte für längere Passwörter
    if (password.length > 8) strength += 10;
    if (password.length > 12) strength += 10;
    
    // Maximal 100 Punkte
    setPasswordStrength(Math.min(100, strength));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({...formData, [name]: value });
    
    // Bei Änderung des Passworts die Stärke prüfen
    if (name === 'password') {
      checkPasswordStrength(value);
    }
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
      if (!passwordFeedback.minLength) {
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
      
      <div className="card login-card fadeIn" style={{ 
        maxWidth: '400px', 
        margin: '32px auto', 
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' 
      }}>
        <div style={{ padding: '24px' }}>
          <h1 style={{ marginBottom: '24px', textAlign: 'center', fontSize: '1.8rem' }}>Registrieren</h1>
          
          <form onSubmit={handleRegister}>
            <div className="mb-3" style={{ marginBottom: '0' }}>
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
            
            <div className="mb-3" style={{ marginBottom: '0' }}>
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
            
            <div className="mb-3" style={{ marginBottom: '0' }}>
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
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              
              {/* Passwort-Stärke-Anzeige */}
              {formData.password && (
                <div style={{ marginTop: '8px' }}>
                  {/* Fortschrittsbalken für Passwortstärke */}
                  <div style={{ 
                    height: '8px', 
                    borderRadius: '4px', 
                    background: '#e0e0e0', 
                    marginBottom: '8px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${passwordStrength}%`, 
                      background: passwordStrength < 40 ? '#f44336' : 
                               passwordStrength < 70 ? '#ff9800' : 
                               '#4caf50',
                      transition: 'width 0.3s, background 0.3s'
                    }} />
                  </div>
                  
                  {/* Textanzeige für Passwortstärke */}
                  <div style={{ 
                    fontSize: '12px', 
                    display: 'flex', 
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ 
                      color: passwordStrength < 40 ? '#f44336' : 
                             passwordStrength < 70 ? '#ff9800' : 
                             '#4caf50',
                      fontWeight: '500'
                    }}>
                      {passwordStrength < 40 ? 'Schwach' : 
                       passwordStrength < 70 ? 'Mittel' : 
                       'Stark'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {passwordStrength}%
                    </span>
                  </div>
                  
                  {/* Kriterien-Liste */}
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '8px',
                      color: passwordFeedback.minLength ? '#4caf50' : 'var(--text-secondary)'
                    }}>
                      {passwordFeedback.minLength ? 
                        <FiCheck style={{ marginRight: '8px', strokeWidth: 3 }} /> : 
                        <FiX style={{ marginRight: '8px', strokeWidth: 3 }} />
                      }
                      Mindestens 6 Zeichen
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '8px',
                      color: passwordFeedback.hasLetter ? '#4caf50' : 'var(--text-secondary)'
                    }}>
                      {passwordFeedback.hasLetter ? 
                        <FiCheck style={{ marginRight: '8px', strokeWidth: 3 }} /> : 
                        <FiX style={{ marginRight: '8px', strokeWidth: 3 }} />
                      }
                      Mindestens ein Buchstabe
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '8px',
                      color: passwordFeedback.hasNumber ? '#4caf50' : 'var(--text-secondary)'
                    }}>
                      {passwordFeedback.hasNumber ? 
                        <FiCheck style={{ marginRight: '8px', strokeWidth: 3 }} /> : 
                        <FiX style={{ marginRight: '8px', strokeWidth: 3 }} />
                      }
                      Mindestens eine Zahl
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      color: passwordFeedback.hasSpecial ? '#4caf50' : 'var(--text-secondary)'
                    }}>
                      {passwordFeedback.hasSpecial ? 
                        <FiCheck style={{ marginRight: '8px', strokeWidth: 3 }} /> : 
                        <FiX style={{ marginRight: '8px', strokeWidth: 3 }} />
                      }
                      Mindestens ein Sonderzeichen
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mb-3" style={{ marginBottom: '0' }}>
              <label htmlFor="confirmPassword" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiLock style={{ marginRight: '8px' }} />
                Passwort bestätigen
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'} 
                  name="confirmPassword" 
                  placeholder="Passwort wiederholen" 
                  className="input"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p style={{ color: 'var(--error)', fontSize: '12px', marginTop: '8px' }}>
                  Die Passwörter stimmen nicht überein.
                </p>
              )}
            </div>
            
            {/* Fehleranzeige */}
            {error && (
              <div style={{ 
                color: 'var(--color-error)', 
                background: 'rgba(255, 0, 0, 0.05)', 
                padding: '8px 16px', 
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="button primary full-width"
              style={{ width: '100%', marginTop: '24px' }}
              disabled={loading || (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword)}
            >
              {loading ? 'Registrieren...' : 'Registrieren'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Bereits registriert? 
            </p>
            <p 
              onClick={onSwitchToLogin}
              style={{ textDecoration: 'underline', marginTop: '8px', width: '100%', fontSize: '14px', color: 'var(--text-secondary)' }}
            >
              Anmelden
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;