const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');
const webpush = require('web-push');

// VAPID-Schlüssel für WebPush (sollten in einer .env-Datei gespeichert werden)
const VAPID_PUBLIC_KEY = 'BBw49gSTEPK0ucHMmyIqQ26aVPxcGfQp0xtfU7uDm9wZOz21afVNPQ0zaIafAJiusbwbYe9NOjunGk1Mxnug5yg';
const VAPID_PRIVATE_KEY = 'Yg1TAoo-tXB1Yaybx8zLe2xaGZRElMooNieJt5tr1z0';

// VAPID-Details für WebPush setzen
webpush.setVapidDetails(
  'mailto:jonas.laux@hotmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * @route   POST /api/notifications/subscribe
 * @desc    Push-Subscription speichern
 * @access  Private
 */
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription, userId, apartmentId } = req.body;
    
    if (!subscription || !userId) {
      return res.status(400).json({ 
        message: 'Subscription und userId sind erforderlich' 
      });
    }
    
    let finalApartmentId = apartmentId;
    
    // Minimale Debug-Information
    if (!finalApartmentId) {
      try {
        // Automatische Wohnungsauswahl - zuerst user_apartments prüfen
        const [userApartments] = await db.pool.query(
          'SELECT apartment_id FROM user_apartments WHERE user_id = ? LIMIT 1',
          [userId]
        );
        
        if (userApartments.length > 0) {
          finalApartmentId = userApartments[0].apartment_id;
        } else {
          // Fallback: Erste verfügbare Wohnung verwenden
          const [allApartments] = await db.pool.query('SELECT id FROM apartments LIMIT 1');
          if (allApartments.length > 0) {
            finalApartmentId = allApartments[0].id;
          }
        }
      } catch (error) {
        console.error('Fehler beim Ermitteln der Wohnung:', error.message);
      }
      
      // Wenn immer noch keine Wohnung gefunden wurde, Fehlermeldung zurückgeben
      if (!finalApartmentId) {
        return res.status(400).json({
          message: 'Keine Wohnung für den Benutzer gefunden oder verfügbar'
        });
      }
    }
    
    // Prüfen, ob der Benutzer zur Wohnung gehört
    const [apartmentMember] = await db.pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, finalApartmentId]
    );
    
    if (apartmentMember.length === 0) {
      return res.status(403).json({ 
        message: 'Kein Zugriff auf diese Wohnung' 
      });
    }
    
    // Subscription als JSON-String speichern
    const subscriptionJson = JSON.stringify(subscription);
    const endpoint = subscription.endpoint;
    
    // Prüfen, ob die Subscription bereits existiert
    const [existingSubscription] = await db.pool.query(
      'SELECT * FROM push_subscriptions WHERE endpoint = ?',
      [endpoint]
    );
    
    if (existingSubscription.length > 0) {
      // Aktualisieren der vorhandenen Subscription
      await db.pool.query(
        'UPDATE push_subscriptions SET subscription = ?, user_id = ?, apartment_id = ?, updated_at = NOW() WHERE endpoint = ?',
        [subscriptionJson, userId, finalApartmentId, endpoint]
      );
    } else {
      // Neue Subscription einfügen
      await db.pool.query(
        'INSERT INTO push_subscriptions (endpoint, subscription, user_id, apartment_id) VALUES (?, ?, ?, ?)',
        [endpoint, subscriptionJson, userId, finalApartmentId]
      );
    }
    
    res.status(201).json({ 
      message: 'Push-Subscription erfolgreich gespeichert',
      subscription: subscription 
    });
  } catch (error) {
    console.error('Fehler beim Speichern der Push-Subscription:', error);
    res.status(500).json({ 
      message: 'Serverfehler beim Speichern der Push-Subscription' 
    });
  }
});

/**
 * @route   POST /api/notifications/unsubscribe
 * @desc    Push-Subscription löschen
 * @access  Private
 */
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { userId, endpoint } = req.body;
    
    if (!userId || !endpoint) {
      return res.status(400).json({ 
        message: 'userId und endpoint sind erforderlich' 
      });
    }
    
    // Subscription löschen
    await db.pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
      [endpoint, userId]
    );
    
    res.json({ 
      message: 'Push-Subscription erfolgreich gelöscht' 
    });
  } catch (error) {
    console.error('Fehler beim Löschen der Push-Subscription:', error);
    res.status(500).json({ 
      message: 'Serverfehler beim Löschen der Push-Subscription' 
    });
  }
});

/**
 * @route   POST /api/notifications/send
 * @desc    Push-Benachrichtigung an Apartment-Mitglieder senden
 * @access  Private
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { apartmentId, notification, excludeUserId } = req.body;
    
    if (!apartmentId || !notification) {
      return res.status(400).json({ 
        message: 'apartmentId und notification sind erforderlich' 
      });
    }
    
    // Prüfen, ob der Benutzer zur Wohnung gehört
    const userId = req.user.id;
    const [apartmentMember] = await db.pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );
    
    if (apartmentMember.length === 0) {
      return res.status(403).json({ 
        message: 'Kein Zugriff auf diese Wohnung' 
      });
    }
    
    // Alle Subscriptions für das Apartment abrufen, außer für den ausgeschlossenen Benutzer
    const [subscriptions] = await db.pool.query(
      'SELECT * FROM push_subscriptions WHERE apartment_id = ? AND user_id != ?',
      [apartmentId, excludeUserId || userId]
    );
    
    console.log(`Sende Benachrichtigung an ${subscriptions.length} Empfänger in Apartment ${apartmentId}`);
    
    // Benachrichtigungen an alle Subscriptions senden
    const notificationPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = JSON.parse(sub.subscription);
        
        // Füge Standardwerte hinzu, falls nicht vorhanden
        const notificationPayload = {
          title: notification.title || 'Neue Benachrichtigung',
          body: notification.body || 'Keine weiteren Details',
          icon: notification.icon || '/icons/android-chrome-192x192.png',
          badge: notification.badge || '/icons/android-chrome-192x192.png',
          vibrate: notification.vibrate || [100, 50, 100],
          data: notification.data || {
            dateOfArrival: Date.now(),
            url: '/'
          },
          actions: notification.actions || [
            {
              action: 'view',
              title: 'Ansehen'
            },
            {
              action: 'close',
              title: 'Schließen'
            }
          ]
        };
        
        try {
          // Klarere Debug-Informationen vor dem Senden
          console.log(`Sende an Benutzer ${sub.user_id}, Endpoint: ${sub.endpoint.substring(0, 30)}...`);
          
          await webpush.sendNotification(pushSubscription, JSON.stringify(notificationPayload));
          console.log(`✔ Erfolgreich gesendet an Benutzer ${sub.user_id}`);
          return { success: true, userId: sub.user_id };
        } catch (pushError) {
          // Detaillierte Fehleranalyse
          const errorInfo = {
            statusCode: pushError.statusCode,
            headers: pushError.headers ? {
              errorDescription: pushError.headers['x-wns-error-description'] || null,
              status: pushError.headers['x-wns-status'] || null
            } : null,
            message: pushError.message,
            body: pushError.body || null
          };
          
          console.error(`❌ Fehler beim Senden an Benutzer ${sub.user_id}:`, JSON.stringify(errorInfo, null, 2));
          
          // Empfehlung basierend auf dem Fehler
          // 404-Fehler - ungültiger Endpunkt
          if (errorInfo.statusCode === 404) {
            console.log('⚠ Ungültiger Subscription-Endpunkt: Die Subscription ist nicht mehr gültig');
            // Detaillierte Debug-Informationen für Firebase-Fehler
            if (errorInfo.body && errorInfo.body.includes('fcm.googleapis.com')) {
              console.log('Firebase Cloud Messaging (FCM) Fehler:', errorInfo.body);
            }
            
            console.log('Lösungsvorschlag: Ungültige Subscription löschen und neu abonnieren');
            
            // Lösche automatisch ungültige Subscriptions
            await db.pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
            return { 
              success: false, 
              userId: sub.user_id, 
              reason: 'Ungültiger Endpunkt - Subscription wurde gelöscht' 
            };
          }
          
          if (errorInfo.headers) {
            // VAPID-Key-Konflikt
            if (errorInfo.headers.errorDescription === 'The public key used to sign JWT does not match with the one included in channel Url.') {
              console.log('⚠ VAPID-Key-Konflikt: Die Subscription wurde mit einem anderen Key erstellt');
              console.log('Lösungsvorschlag: Veraltete Subscription löschen und erneut abonnieren');
              
              // Lösche automatisch veraltete Subscriptions mit VAPID-Key-Problemen
              await db.pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
              return { 
                success: false, 
                userId: sub.user_id, 
                reason: 'VAPID-Key-Konflikt - Subscription wurde gelöscht' 
              };
            } 
            // Zurückgezogener Channel
            else if (errorInfo.headers.errorDescription === 'Revoked channel URL' || errorInfo.headers.status === 'revoked') {
              console.log('⚠ Zurückgezogener Channel: Die Subscription wurde vom Browser/Betriebssystem zurückgezogen');
              console.log('Lösungsvorschlag: Veraltete Subscription löschen und erneut abonnieren');
              
              // Lösche automatisch zurückgezogene Subscriptions
              await db.pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
              return { 
                success: false, 
                userId: sub.user_id, 
                reason: 'Zurückgezogener Channel - Subscription wurde gelöscht' 
              };
            }
          }
          
          return { success: false, userId: sub.user_id, reason: errorInfo.message };
        }
      } catch (error) {
        console.error(`Fehler beim Senden an Subscription ${sub.endpoint}:`, error);
        
        // Wenn die Subscription abgelaufen ist oder ungültig ist, löschen
        if (error.statusCode === 404 || error.statusCode === 410) {
          await db.pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
          return { success: false, userId: sub.user_id, reason: 'Subscription abgelaufen' };
        }
        
        return { success: false, userId: sub.user_id, reason: error.message };
      }
    });
    
    const results = await Promise.all(notificationPromises);
    
    res.json({ 
      message: 'Benachrichtigungen versendet', 
      results: results,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
  } catch (error) {
    console.error('Fehler beim Senden der Push-Benachrichtigungen:', error);
    res.status(500).json({ 
      message: 'Serverfehler beim Senden der Push-Benachrichtigungen' 
    });
  }
});

module.exports = router;
