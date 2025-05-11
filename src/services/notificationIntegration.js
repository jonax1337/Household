import notificationService from './notificationService';
import { resolveUserName } from './userUtils';
import activityService from './activityService'; // Neu: Activity Service

/**
 * Integration von Benachrichtigungen für verschiedene Bereiche der App
 * Diese zentrale Datei erlaubt das einfache Senden von Benachrichtigungen
 * aus allen Services, ohne Mehrfachimplementierungen
 */
const notificationIntegration = {
  /**
   * Einkaufslisten-Benachrichtigungen
   */
  shopping: {
    // Neue Liste erstellt
    onListCreated: async (listName, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt übergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        // Aktivität im Activity Feed erstellen
        try {
          await activityService.shoppingListCreated(
            apartmentId,
            senderName,
            listName
          );
        } catch (activityError) {
          console.warn('Fehler beim Erstellen der ShoppingList-Activity:', activityError);
          // Fehler hier abfangen, aber weitermachen
        }
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Neue Einkaufsliste',
            body: `${senderName} hat die Liste "${listName}" erstellt.`,
            type: 'shopping',
            priority: 'low',
            url: '/shopping',
            data: {
              userId: userId,
              listName: listName,
              senderName: senderName
            }
          },
          userId // Den Ersteller ausschließen
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über neue Einkaufsliste:', error);
      }
    },

    // Neues Item hinzugefügt
    onItemAdded: async (itemName, listName, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt übergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        // Aktivität im Activity Feed erstellen
        try {
          await activityService.shoppingItemAdded(
            apartmentId,
            senderName,
            itemName
          );
        } catch (activityError) {
          console.warn('Fehler beim Erstellen der ShoppingItem-Activity:', activityError);
          // Fehler hier abfangen, aber weitermachen
        }
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: `Einkaufsliste "${listName}"`,
            body: `${senderName} hat "${itemName}" hinzugefügt.`,
            type: 'shopping_item',
            priority: 'low',
            url: '/shopping',
            data: {
              userId: userId,
              itemName: itemName,
              listName: listName,
              senderName: senderName
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über neues Einkaufslisten-Item:', error);
      }
    },

    // Item abgehakt
    onItemChecked: async (itemName, listName, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt u00fcbergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        // Leise Benachrichtigung, ohne Ton/Vibration
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Artikel abgehakt',
            body: `${senderName} hat "${itemName}" auf der Liste "${listName}" abgehakt.`,
            type: 'shopping',
            priority: 'low',
            silent: true,
            url: '/shopping',
            data: {
              userId: userId,
              itemName: itemName,
              listName: listName,
              senderName: senderName
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über abgehaktes Item:', error);
      }
    },

    // Liste vollständig abgehakt
    onListCompleted: async (listName, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt übergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Einkaufsliste erledigt',
            body: `${senderName} hat die Einkaufsliste "${listName}" erledigt! 🎉`,
            type: 'shopping',
            priority: 'normal',
            url: '/shopping',
            data: {
              userId: userId,
              listName: listName,
              senderName: senderName
            },
            useEmoji: true
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über erledigte Einkaufsliste:', error);
      }
    }
  },

  /**
   * Aufgaben-Benachrichtigungen
   */
  tasks: {
    // Neue Aufgabe erstellt
    onTaskCreated: async (taskTitle, dueDate, points, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt u00fcbergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        const formattedDate = new Date(dueDate).toLocaleDateString('de-DE');
        
        // Aktivität im Activity Feed erstellen
        try {
          await activityService.createActivity(
            apartmentId,
            'task_created',
            `hat "${taskTitle}" (${points} Punkte) erstellt`,
            {
              taskTitle,
              points,
              dueDate,
              formattedDate
            }
          );
        } catch (activityError) {
          console.warn('Fehler beim Erstellen der Activity:', activityError);
          // Fehler hier abfangen, aber weitermachen
        }
        
        // Notification wie bisher senden
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Neue Aufgabe erstellt',
            body: `${senderName} hat "${taskTitle}" (${points} Punkte) erstellt. Fällig am ${formattedDate}.`,
            type: 'task',
            priority: 'normal',
            url: '/cleaning',
            data: {
              userId: userId,
              taskTitle: taskTitle,
              dueDate: dueDate,
              points: points,
              senderName: senderName
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über neue Aufgabe:', error);
      }
    },

    // Aufgabe erledigt - konsistentes Format mit erweiterten Details
    onTaskCompleted: async (taskData, apartmentId, userId, userName = null) => {
      try {
        // Daten aus dem übergebenen Objekt extrahieren
        const taskTitle = taskData.title || 'Eine Aufgabe';
        const pointsAwarded = taskData.points_awarded || 0;
        const taskColor = taskData.color || '#4a90e2';
        const instanceId = taskData.instanceId;
        
        // Benutzeridentifikation bestimmen: completed_by_user_id hat Vorrang, danach userId
        const effectiveUserId = taskData.completed_by_user_id || userId;
        
        // Prioritu00e4tsreihenfolge: 1. Direkt u00fcbergebener Name, 2. Name aus Daten, 3. Auflösung
        let senderName;
        if (userName) {
          // Wenn direkt ein Name u00fcbergeben wurde, diesen verwenden
          senderName = userName;
        } else if (taskData.completed_by_user_name) {
          // Bei vorhandenem Namen diesen nutzen
          senderName = taskData.completed_by_user_name;
        } else {
          // Ansonsten den Namen aus der ID auflösen (nicht-asynchron)
          senderName = resolveUserName(effectiveUserId, apartmentId);
        }
        
        // Aktivität im Activity Feed erstellen
        try {
          await activityService.taskCompleted(
            apartmentId,
            senderName,
            taskTitle,
            pointsAwarded
          );
        } catch (activityError) {
          console.warn('Fehler beim Erstellen der TaskCompleted-Activity:', activityError);
          // Fehler hier abfangen, aber weitermachen
        }
        
        // Emoji basierend auf der Punktzahl bestimmen
        let pointsEmoji = '⭐'; // Stern-Emoji Standard
        if (pointsAwarded >= 10) pointsEmoji = '🌟'; // Funkelnder Stern
        if (pointsAwarded >= 20) pointsEmoji = '💫'; // Dizzy Symbol
        if (pointsAwarded >= 30) pointsEmoji = '💎'; // Diamant
        
        return await notificationService.sendNotificationToApartment(
          apartmentId, {
            title: `✅ Aufgabe erledigt (+${pointsAwarded} Punkte)`,
            body: `${senderName} hat "${taskTitle}" abgeschlossen. ${pointsEmoji}`,
            icon: '/icons/android-chrome-192x192.png',
            badge: '/icons/badge-128x128.png',
            data: {
              url: '/cleaning',
              taskId: instanceId,
              type: 'task_completed',
              userName: senderName,
              senderName: senderName,
              taskTitle: taskTitle,
              pointsAwarded: pointsAwarded,
              taskColor: taskColor
            },
            // Vibrationspattern je nach Punktzahl
            vibrate: pointsAwarded >= 15 ? [100, 50, 100, 50, 100] : [100, 50, 100]
          }
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über erledigte Aufgabe:', error);
      }
    },

    // Aufgabe bald fällig
    // Aufgabe zugewiesen
    onTaskAssigned: async (taskTitle, pointsValue, assignedToUserId, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt u00fcbergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        // Den Namen der Person holen, der die Aufgabe zugewiesen wurde
        const assigneeName = resolveUserName(assignedToUserId, apartmentId);
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Aufgabe zugewiesen',
            body: `${senderName} hat dir die Aufgabe "${taskTitle}" zugewiesen.`,
            type: 'task',
            priority: 'normal',
            url: '/cleaning',
            data: {
              taskTitle: taskTitle,
              pointsValue: pointsValue,
              senderName: senderName,
              assignedToUserId: assignedToUserId
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung u00fcber zugewiesene Aufgabe:', error);
      }
    },
    
    onTaskDueSoon: async (taskTitle, daysLeft, apartmentId, taskId, userId = null, assignedUserName = null) => {
      try {
        // Nachricht anpassen, je nachdem, ob ein Benutzer zugewiesen ist
        let bodyText = `"${taskTitle}" ist in ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'} fällig.`;
        if (assignedUserName) {
          bodyText = `"${taskTitle}" (zugewiesen an ${assignedUserName}) ist in ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tagen'} fällig.`;
        }
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Aufgabe bald fällig',
            body: bodyText,
            type: 'task',
            priority: daysLeft <= 1 ? 'medium' : 'low',
            url: '/cleaning',
            tag: `task-due-${taskId}`,
            data: {
              taskId: taskId,
              taskTitle: taskTitle,
              daysLeft: daysLeft,
              assignedUserName: assignedUserName
            },
            renotify: false // Nicht erneut benachrichtigen, wenn bereits gezeigt
          },
          userId || null // Falls kein Absender, dann null (zeigt allen)
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über bald fällige Aufgabe:', error);
      }
    },
    
    // Aufgabe bearbeitet
    onTaskEdited: async (taskTitle, changedFields, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt übergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        // Text für geänderte Felder zusammenbauen
        let changesText = '';
        if (changedFields && Object.keys(changedFields).length > 0) {
          const changes = [];
          if (changedFields.title) changes.push('Titel');
          if (changedFields.description) changes.push('Beschreibung');
          if (changedFields.points) changes.push('Punkte');
          if (changedFields.dueDate) changes.push('Fälligkeitsdatum');
          if (changedFields.assignedUser) changes.push('Zuweisung');
          if (changedFields.recurring) changes.push('Wiederholung');
          
          changesText = changes.length > 0 
            ? ` (Geändert: ${changes.join(', ')})` 
            : '';
        }
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Aufgabe bearbeitet',
            body: `${senderName} hat die Aufgabe "${taskTitle}" bearbeitet.${changesText}`,
            type: 'task',
            priority: 'low',
            url: '/cleaning',
            data: {
              taskTitle: taskTitle,
              changedFields: changedFields,
              senderName: senderName
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über bearbeitete Aufgabe:', error);
      }
    },
    
    // Aufgabe gelöscht
    onTaskDeleted: async (taskTitle, apartmentId, userId, userName = null) => {
      try {
        // Wenn kein Name direkt übergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Aufgabe gelöscht',
            body: `${senderName} hat die Aufgabe "${taskTitle}" gelöscht.`,
            type: 'task',
            priority: 'low',
            url: '/cleaning',
            data: {
              taskTitle: taskTitle,
              senderName: senderName
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über gelöschte Aufgabe:', error);
      }
    }
  },

  /**
   * Chat und Nachrichten
   */
  messages: {
    // Neue Nachricht
    onNewMessage: async (messageText, apartmentId, userId, userName = null, messageData = {}) => {
      try {
        // Wenn kein Name direkt u00fcbergeben wurde, Namen auflösen
        const senderName = userName || resolveUserName(userId, apartmentId);
        
        // Nachrichtenvorschau erstellen - maximal 50 Zeichen
        const messagePreview = messageText.length > 50 
          ? messageText.substring(0, 47) + '...' 
          : messageText;
        
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: `${senderName}`,
            body: `${messagePreview}`,
            type: 'message',
            priority: 'normal',
            url: '/chat',
            data: {
              userId: userId,     // ID des Absenders
              senderName: senderName,  // Explizit den Namen speichern
              messageId: messageData.id || null
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über neue Nachricht:', error);
      }
    }
  },

  /**
   * Finanz-Benachrichtigungen
   */
  finances: {
    // Zahlung erhalten
    onPaymentReceived: async (fromUser, amount, reason, apartmentId, userId = null) => {
      try {
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Zahlung erhalten',
            body: `${fromUser} hat ${amount}€ für "${reason}" bezahlt.`,
            type: 'money',
            priority: 'medium',
            url: '/finances',
            data: {
              amount: amount,
              reason: reason,
              fromUser: fromUser
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über erhaltene Zahlung:', error);
      }
    },

    // Neue Ausgabe/Transaktion
    onNewExpense: async (description, amount, payer, apartmentId, userId = null) => {
      try {
        return await notificationService.sendNotificationToApartment(
          apartmentId,
          {
            title: 'Neue Ausgabe',
            body: `${payer} hat ${amount}€ für "${description}" ausgegeben.`,
            type: 'money',
            priority: 'normal',
            url: '/finances',
            data: {
              amount: amount,
              description: description,
              payer: payer
            }
          },
          userId // Wichtig: Den Absender explizit ausschließen!
        );
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über neue Ausgabe:', error);
      }
    }
  },

  /**
   * Apartment-bezogene Benachrichtigungen
   */
  apartment: {
    // Neuer Mitbewohner
    onNewRoommate: async (newUser, apartmentId, userId = null) => {
      try {
        return await notificationService.createNotification({
          title: 'Neuer Mitbewohner',
          body: `${newUser} ist jetzt Teil der WG!`,
          type: 'info',
          priority: 'medium',
          url: '/settings'
        });
      } catch (error) {
        console.warn('Fehler bei Benachrichtigung über neuen Mitbewohner:', error);
      }
    }
  }
};

export default notificationIntegration;
