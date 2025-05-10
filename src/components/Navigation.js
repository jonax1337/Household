import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiClipboard, FiShoppingCart, FiUsers, FiDollarSign, FiSettings, FiMessageCircle } from 'react-icons/fi';

// Eine komplett neu implementierte, einfachere Bottom-Navigation
const BottomNavigation = ({ onTabChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Aktuelle Route
  const currentPath = location.pathname;
  
  // Nicht anzeigen bei Login/Register
  if (currentPath.includes('/login') || currentPath.includes('/register')) {
    return null;
  }
  
  // Navigationselemente - mit größeren Feather Icons
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome size={24} /> },
    { path: '/cleaning', label: 'Putzplan', icon: <FiClipboard size={24} /> },
    { path: '/shopping', label: 'Einkauf', icon: <FiShoppingCart size={24} /> },
    { path: '/chat', label: 'Chat', icon: <FiMessageCircle size={24} /> },
    { path: '/finances', label: 'Finanzen', icon: <FiDollarSign size={24} /> },
    { path: '/settings', label: 'Einst.', icon: <FiSettings size={24} /> }
  ];
  
  // Klick-Handler für Navigation
  const handleNavClick = (path) => {
    if (onTabChange) {
      onTabChange(path);
    } else {
      navigate(path);
    }
  };
  
  return (
    <div className="bottom-nav-container">
      <div className="bottom-nav-card card">
        <div className="bottom-nav-items">
          {navItems.map((item) => {
            // Die Startseite kann verschiedene Pfade haben (/, /dashboard)
            const path = item.path === '/dashboard' ? ['/', '/dashboard'] : [item.path];
            const isActive = path.some(p => currentPath === p || (currentPath.startsWith(p) && p !== '/'));
            
            return (
              <div 
                key={item.path}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.path)}
              >
                <div className="bottom-nav-icon">
                  {item.icon}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;
