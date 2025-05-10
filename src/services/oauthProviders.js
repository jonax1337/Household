// OAuth-Provider-Konfigurationen und Hilfsfunktionen

// Hilfsfunktion, um dynamische Callback-URLs zu erstellen
const getRedirectUri = (path = '/auth/callback') => {
  return `${window.location.origin}${path}`;
};

// Apple Sign-In Konfiguration
const appleConfig = {
  // Diese Werte werden von deinem Apple Developer Account kommen
  clientId: 'com.yourdomain.household', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'name email'
};

// Google Sign-In Konfiguration
const googleConfig = {
  clientId: 'YOUR_GOOGLE_CLIENT_ID', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'profile email'
};

// Microsoft Sign-In Konfiguration
const microsoftConfig = {
  clientId: 'YOUR_MICROSOFT_CLIENT_ID', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'User.Read'
};

// Discord Sign-In Konfiguration (neu hinzugefügt)
const discordConfig = {
  clientId: 'YOUR_DISCORD_CLIENT_ID', // Platzhalter
  redirectUri: getRedirectUri(),
  scope: 'identify email'
};

// Helper-Funktion zur Anpassung der Benutzerinfos an unser System
const normalizeUserData = (provider, userData) => {
  switch (provider) {
    case 'apple':
      return {
        providerId: userData.user?.id || '',
        email: userData.user?.email || '',
        name: userData.user?.name?.firstName ? 
              `${userData.user.name.firstName} ${userData.user.name.lastName || ''}`.trim() : 
              'Apple Nutzer',
        provider: 'apple'
      };
    // Weitere Provider hier hinzufu00fcgen
    default:
      return {
        providerId: '',
        email: '',
        name: '',
        provider
      };
  }
};

// OAuth-Login-Funktion (wird vom authService aufgerufen)
export const oauthLogin = async (provider) => {
  try {
    let authResult;
    
    switch (provider) {
      case 'apple':
        authResult = await startAppleSignIn();
        break;
      // Weitere Provider hier hinzufu00fcgen
      default:
        throw new Error(`OAuth-Provider ${provider} nicht unterstu00fctzt`);
    }
    
    if (!authResult) {
      throw new Error(`Anmeldung mit ${provider} fehlgeschlagen`);
    }
    
    // Hier wu00fcrden wir normalerweise einen API-Aufruf an den Server machen,
    // um das Token zu validieren und einen JWT zu erhalten
    
    // Fu00fcr Demo-Zwecke liefern wir ein Fake-Token zuru00fcck
    return {
      token: `mock_${provider}_token_${Date.now()}`,
      user: normalizeUserData(provider, authResult)
    };
  } catch (error) {
    console.error(`Fehler bei der Anmeldung mit ${provider}:`, error);
    throw error;
  }
};
