/**
 * Hilfsfunktionen zur Geräteerkennung und Plattformspezifischen Anpassungen
 */

/**
 * Erkennt, ob das aktuell verwendete Gerät ein iOS-Gerät ist
 * @returns {boolean} true wenn iOS erkannt wurde, sonst false
 */
export const isIOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || 
         // Neuere iPad-Modelle nutzen MacOS-ähnliche User Agents
         (userAgent.includes('mac') && 'ontouchend' in document);
};

/**
 * Erkennt, ob die App als PWA auf den Homescreen installiert wurde
 * @returns {boolean} true wenn als PWA installiert
 */
export const isInstalledPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone || // Für ältere iOS
         document.referrer.includes('android-app://');
};

/**
 * Prüft, ob Push-Notifications auf diesem Gerät unterstützt werden
 * @returns {boolean} true wenn Push unterstützt wird
 */
export const isPushSupported = () => {
  // Basis-Überprüfung
  const basicSupport = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window;
  
  if (!basicSupport) return false;
  
  // iOS spezifische Überprüfung
  if (isIOS()) {
    // iOS unterstützt Web Push erst ab Version 16.4
    // und nur in installierten PWAs
    const iOSVersion = getIOSVersion();
    return iOSVersion >= 16.4 && isInstalledPWA();
  }
  
  return true;
};

/**
 * Versucht die iOS-Version zu ermitteln
 * @returns {number} iOS-Version als Zahl oder 0 wenn nicht ermittelbar
 */
export const getIOSVersion = () => {
  const userAgent = window.navigator.userAgent;
  const matches = userAgent.match(/OS (\d+)_(\d+)_(\d+)/);
  
  if (matches && matches.length >= 4) {
    return parseFloat(`${matches[1]}.${matches[2]}`);
  }
  
  // Fallback für neuere iPads mit Desktop Safari
  if (isIOS() && /Version\/([0-9.]+)/.test(userAgent)) {
    return 15.0; // Annahme einer neueren Version, könnte ungenau sein
  }
  
  return 0;
};

/**
 * Gibt eine Nachricht zurück, die erklärt, warum Push nicht verfügbar ist
 * @returns {string} Erklärung für den Benutzer
 */
export const getPushSupportMessage = () => {
  if (!('serviceWorker' in navigator)) {
    return 'Dein Browser unterstützt keine Service Worker, die für Push-Benachrichtigungen notwendig sind.';
  }
  
  if (!('PushManager' in window)) {
    return 'Dein Browser unterstützt keine Push-Benachrichtigungen.';
  }
  
  if (!('Notification' in window)) {
    return 'Dein Browser unterstützt keine Benachrichtigungen.';
  }
  
  if (isIOS()) {
    const iOSVersion = getIOSVersion();
    
    if (iOSVersion < 16.4) {
      return 'Push-Benachrichtigungen werden auf iOS erst ab Version 16.4 unterstützt. Bitte aktualisiere dein Gerät.';
    }
    
    if (!isInstalledPWA()) {
      return 'Auf iOS müssen Web-Apps zum Homescreen hinzugefügt werden, um Push-Benachrichtigungen zu erhalten. Bitte füge diese App zu deinem Homescreen hinzu (über das Teilen-Menü → "Zum Homescreen hinzufügen").';
    }
  }
  
  return 'Aus unbekannten Gründen werden Push-Benachrichtigungen auf deinem Gerät nicht unterstützt.';
};
