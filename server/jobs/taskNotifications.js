const cron = require('node-cron');
const { pool } = require('../config/db');
const webpush = require('web-push');

// VAPID-Schlüssel für WebPush (sollten mit denen in der notifications.js übereinstimmen)
const VAPID_PUBLIC_KEY = 'BBw49gSTEPK0ucHMmyIqQ26aVPxcGfQp0xtfU7uDm9wZOz21afVNPQ0zaIafAJiusbwbYe9NOjunGk1Mxnug5yg';
const VAPID_PRIVATE_KEY = 'Yg1TAoo-tXB1Yaybx8zLe2xaGZRElMooNieJt5tr1z0';

// VAPID-Details für WebPush setzen
webpush.setVapidDetails(
  'mailto:jonas.laux@hotmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Hilfsfunktion zur Berechnung der Tage zwischen zwei Daten
 */
const getDayDifference = (startDate, endDate) => {
  // Sicherstellen, dass wir mit Date-Objekten arbeiten
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Zeitzonen-Unterschiede eliminieren, indem wir nur das Datum betrachten
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  // Differenz in Millisekunden
  const diffTime = endDateOnly - startDateOnly;
  // Umrechnen in Tage
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Findet Aufgaben, die heute fällig sind oder bereits überfällig sind
 */
const findUpcomingTasks = async () => {
  try {
    // Aktuelles Datum
    const today = new Date();
    
    // SQL-Abfrage für heute fällige oder überfällige Aufgaben
    // Die nicht abgeschlossen, nicht archiviert und nicht gelöscht sind
    const [tasks] = await pool.query(
      `SELECT 
        ti.id, ti.task_id, ti.apartment_id, ti.assigned_user_id, ti.due_date,
        t.title, t.points, t.color,
        u.name as assigned_user_name,
        u.initials as assigned_user_initials,
        u.profile_color as assigned_user_profile_color
      FROM task_instance ti
      LEFT JOIN task t ON ti.task_id = t.id
      LEFT JOIN users u ON ti.assigned_user_id = u.id
      WHERE 
        ti.status = 'offen' AND 
        ti.is_deleted = 0 AND
        ti.archived = 0 AND
        ti.assigned_user_id IS NOT NULL AND
        ti.due_date <= CURDATE()
      ORDER BY ti.due_date ASC`
    );
    
    console.log(`[Aufgaben-Benachrichtigung] ${tasks.length} heute fällige oder überfällige Aufgaben gefunden.`);
    
    return tasks.map(task => {
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      const daysUntilDue = dueDate ? getDayDifference(today, dueDate) : null;
      
      return {
        ...task,
        due_date: dueDate,
        daysUntilDue: daysUntilDue,
        isOverdue: daysUntilDue < 0
      };
    });
  } catch (error) {
    console.error('[Aufgaben-Benachrichtigung] Fehler beim Abrufen fälliger Aufgaben:', error);
    return [];
  }
};

/**
 * Sendet Benachrichtigungen für anstehende Aufgaben
 */
const sendTaskNotifications = async () => {
  try {
    console.log('[Aufgaben-Benachrichtigung] Prüfe anstehende Aufgaben...');
    
    // Anstehende Aufgaben abrufen
    const upcomingTasks = await findUpcomingTasks();
    
    if (upcomingTasks.length === 0) {
      console.log('[Aufgaben-Benachrichtigung] Keine anstehenden Aufgaben gefunden.');
      return;
    }
    
    // Gruppiere Aufgaben nach Apartment
    const tasksByApartment = upcomingTasks.reduce((acc, task) => {
      if (!acc[task.apartment_id]) {
        acc[task.apartment_id] = [];
      }
      acc[task.apartment_id].push(task);
      return acc;
    }, {});
    
    // Verarbeite Aufgaben für jedes Apartment
    for (const [apartmentId, tasks] of Object.entries(tasksByApartment)) {
      await processApartmentTasks(apartmentId, tasks);
    }
    
    console.log('[Aufgaben-Benachrichtigung] Benachrichtigungen wurden gesendet.');
  } catch (error) {
    console.error('[Aufgaben-Benachrichtigung] Fehler beim Verarbeiten der Aufgaben-Benachrichtigungen:', error);
  }
};

/**
 * Verarbeitet Aufgaben für ein bestimmtes Apartment und sendet Benachrichtigungen
 */
const processApartmentTasks = async (apartmentId, tasks) => {
  try {
    // Wenn keine Aufgaben vorhanden sind, frühzeitig beenden
    if (tasks.length === 0) {
      return;
    }
    
    // Benachrichtigungen für anstehende Aufgaben senden
    for (const task of tasks) {
      // Wenn keine Benutzer-ID zugewiesen ist, überspringen
      if (!task.assigned_user_id) {
        console.log(`[Aufgaben-Benachrichtigung] Aufgabe ${task.id} (${task.title}) hat keinen zugewiesenen Benutzer, überspringe.`);
        continue;
      }
      
      // Nur die Subscription für den zugewiesenen Benutzer abrufen
      const [userSubscriptions] = await pool.query(
        'SELECT * FROM push_subscriptions WHERE apartment_id = ? AND user_id = ?',
        [apartmentId, task.assigned_user_id]
      );
      
      if (userSubscriptions.length === 0) {
        console.log(`[Aufgaben-Benachrichtigung] Keine Subscription für Benutzer ${task.assigned_user_id} in Apartment ${apartmentId} gefunden.`);
        continue;
      }
      
      console.log(`[Aufgaben-Benachrichtigung] Sende Benachrichtigung für Aufgabe "${task.title}" an Benutzer ${task.assigned_user_id}.`);
      
      // Bestimme den Status der Aufgabe
      if (task.isOverdue) {
        await sendTaskDueNotification(task, userSubscriptions, 'überfällig');
      } else {
        await sendTaskDueNotification(task, userSubscriptions, 'heute');
      }
    }
  } catch (error) {
    console.error(`[Aufgaben-Benachrichtigung] Fehler beim Verarbeiten der Aufgaben für Apartment ${apartmentId}:`, error);
  }
};

/**
 * Sendet eine Benachrichtigung für eine fällige Aufgabe
 */
const sendTaskDueNotification = async (task, subscriptions, timeFrame) => {
  try {
    // Je nach Timeframe unterschiedliche Nachrichten und Titel erstellen
    let title, body, priority;
    
    if (timeFrame === 'überfällig') {
      title = `⚠️ Aufgabe überfällig`;
      body = `Die Aufgabe "${task.title}" ist überfällig!`;
      priority = 'high';
    } else {
      title = `Aufgabe heute fällig`;
      body = `Die Aufgabe "${task.title}" ist heute fällig.`;
      priority = 'normal';
    }
    
    // Erstelle die Benachrichtigung
    const notification = {
      title: title,
      body: body,
      icon: '/icons/android-chrome-192x192.png',
      badge: '/icons/android-chrome-192x192.png',
      vibrate: timeFrame === 'überfällig' ? [200, 100, 200, 100, 200] : [100, 50, 100],
      data: {
        url: '/cleaning',
        dateOfArrival: Date.now(),
        taskId: task.id,
        taskTitle: task.title,
        taskColor: task.color || '#4a90e2',
        pointsValue: task.points,
        dueDate: task.due_date,
        type: timeFrame === 'überfällig' ? 'task_overdue' : 'task_due_today',
        timeFrame: timeFrame,
        priority: priority
      },
      requireInteraction: true
    };
    
    // Benachrichtigungen an den zugewiesenen Benutzer senden
    const notificationPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = JSON.parse(sub.subscription);
        
        // Sende Benachrichtigung an den zugewiesenen Benutzer
        await webpush.sendNotification(pushSubscription, JSON.stringify(notification));
        console.log(`[Aufgaben-Benachrichtigung] Gesendet an Benutzer ${sub.user_id}: ${notification.title} - ${notification.body}`);
        
        return { success: true, endpoint: sub.endpoint };
      } catch (error) {
        console.error(`[Aufgaben-Benachrichtigung] Fehler beim Senden an Subscription ${sub.endpoint}:`, error);
        
        // Wenn die Subscription abgelaufen ist oder ungültig ist, löschen
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`[Aufgaben-Benachrichtigung] Lösche ungültige Subscription: ${sub.endpoint}`);
          pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
        }
        
        return { success: false, endpoint: sub.endpoint, error: error.message };
      }
    });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('[Aufgaben-Benachrichtigung] Fehler beim Senden der Aufgaben-Benachrichtigung:', error);
  }
};

/**
 * Startet den Cron-Job für Aufgaben-Benachrichtigungen
 */
const startTaskNotificationCron = () => {
  // Standard: Jeden Tag um 12:00 Uhr (Mittags) Benachrichtigungen senden
  const cronSchedule = process.env.TASK_NOTIFICATION_CRON || '0 12 * * *';
  
  console.log(`[Aufgaben-Benachrichtigung] Cron-Job wird gestartet mit Schedule: ${cronSchedule}`);
  
  const job = cron.schedule(cronSchedule, async () => {
    console.log(`[Aufgaben-Benachrichtigung] Cron-Job ausgeführt am ${new Date().toISOString()}`);
    await sendTaskNotifications();
  });
  
  return job;
};

module.exports = {
  sendTaskNotifications,
  startTaskNotificationCron
};
