import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { FiEye, FiEyeOff, FiMail, FiLock, FiUser } from 'react-icons/fi';

const Login = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Testdaten für die Entwicklung - zum einfachen Ausfüllen des Formulars
  const fillWithTestData = () => {
    setFormData({
      email: 'test@example.com',
      password: 'password'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({...formData, [name]: value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); // Fehler zurücksetzen bei jedem Versuch
    
    try {
      // Validierung
      if (!formData.email.trim()) {
        throw new Error('Bitte geben Sie Ihre E-Mail-Adresse ein');
      }
      if (!formData.password) {
        throw new Error('Bitte geben Sie Ihr Passwort ein');
      }
      
      // Zeige Debug-Info in der Konsole
      console.log('%c[LOGIN] Sende Login-Anfrage an Backend', 'color: #4CAF50; font-weight: bold;', {
        email: formData.email,
        // Passwort aus Sicherheitsgründen nicht loggen
      });
      
      // Echte API-Anfrage an das Backend
      const response = await authService.login({
        email: formData.email,
        password: formData.password
      });
      
      if (response && response.token) {
        // Alle Daten im localStorage löschen, um einen sauberen Start zu haben
        console.log('%c[LOGIN] Lösche alles aus localStorage vor Login', 'color: #ff9800;');
        localStorage.clear();
        
        // Token in localStorage speichern
        localStorage.setItem('token', response.token);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Speichere Benutzerinfos - mit detailliertem Logging
        if (response.user) {
          console.log('%c[LOGIN] Speichere Benutzerdaten im localStorage:', 'color: #4CAF50; font-weight: bold;', response.user);
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          
          // Verifiziere, dass die Daten korrekt gespeichert wurden
          const storedData = localStorage.getItem('currentUser');
          console.log('%c[LOGIN] Verifiziere gespeicherte Daten:', 'color: #e91e63;', storedData);
        } else {
          console.warn('%c[LOGIN] Keine Benutzerdaten in response.user!', 'color: #f44336;');
        }
        
        console.log('%c[LOGIN] Login erfolgreich', 'color: #4CAF50; font-weight: bold;', response);
        // Login erfolgreich
        onLoginSuccess();
      } else {
        throw new Error('Anmeldung fehlgeschlagen: Ungültige Antwort vom Server');
      }
    } catch (error) {
      console.error('Login fehlgeschlagen:', error);
      setError(error.message || 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es später erneut.');
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
          <h1 style={{ marginBottom: '24px', textAlign: 'center', fontSize: '1.8rem' }}>Anmelden</h1>
          
          <form onSubmit={handleLogin}>
            <div className="mb-3" style={{ marginBottom: '0' }}>
              <label htmlFor="email" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiMail style={{ marginRight: '8px' }} />
                E-Mail
              </label>
              <input 
                id="email"
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
              <label htmlFor="password" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                <FiLock style={{ marginRight: '8px' }} />
                Passwort
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  id="password"
                  type={showPassword ? 'text' : 'password'} 
                  name="password" 
                  placeholder="Dein Passwort" 
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
              disabled={loading}
              style={{ width: '100%', marginTop: '24px' }}
            >
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>

            {/* Seperator */}
            <div style={{ 
                textAlign: 'center', 
                marginTop: '24px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <hr style={{ 
                  position: 'absolute', 
                  width: '100%', 
                  border: 'none', 
                  borderBottom: '1px solid var(--border-color)',
                  margin: 0
                }} />
              </div>

            {/* Soziale Login-Buttons */}
            <div style={{ marginTop: '24px', position: 'relative' }}>
              <div style={{ 
                textAlign: 'center',
                marginBottom: '16px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ 
                  background: 'var(--card-bg)', 
                  padding: '0 16px', 
                  color: 'var(--text-secondary)',
                  position: 'relative',
                  fontSize: '14px'
                }}>
                  Oder anmelden mit
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                {/* Microsoft Button */}
                <button
                  type="button"
                  onClick={() => {
                    setError('Microsoft-Anmeldung wird später implementiert');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    color: '#00a4ef',
                    height: '50px',
                    width: '50px',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48">
<path fill="#ff5722" d="M6 6H22V22H6z" transform="rotate(-180 14 14)"></path><path fill="#4caf50" d="M26 6H42V22H26z" transform="rotate(-180 34 14)"></path><path fill="#ffc107" d="M26 26H42V42H26z" transform="rotate(-180 34 34)"></path><path fill="#03a9f4" d="M6 26H22V42H6z" transform="rotate(-180 14 34)"></path>
</svg>
                </button>

                {/* Google Button */}
                <button
                  type="button"
                  onClick={() => {
                    setError('Google-Anmeldung wird später implementiert');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    color: '#4285F4',
                    height: '50px',
                    width: '50px',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48">
<path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12	s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20	s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039	l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36	c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571	c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
</svg>
                </button>
                
                {/* Discord Button */}
                <button
                  type="button"
                  onClick={() => {
                    setError('Discord-Anmeldung wird später implementiert');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    color: '#5865F2',
                    height: '50px',
                    width: '50px',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                  }}
                >
                  <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                  </svg>
                </button>
              </div>
            </div>
          </form>

          {/* Seperator */}
          <div style={{ 
                textAlign: 'center', 
                marginTop: '24px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <hr style={{ 
                  position: 'absolute', 
                  width: '100%', 
                  border: 'none', 
                  borderBottom: '1px solid var(--border-color)',
                  margin: 0
                }} />
              </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Noch kein Konto?</p>
            <p 
              onClick={onSwitchToRegister} 
              style={{ textDecoration: 'underline', marginTop: '10px', width: '100%', fontSize: '14px', color: 'var(--text-secondary)' }}
            >
              Registrieren
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
