const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/tasks/apartment/:apartmentId
 * @desc    Alle Tasks und Instanzen für ein Apartment abrufen
 * @access  Private
 */
router.get('/apartment/:apartmentId', auth, async (req, res) => {
  console.log('======================================================');
  console.log('=== GET /api/tasks/apartment/:apartmentId ===');
  console.log('======================================================');
  console.log('Anfrage-Parameter (params):', req.params);
  
  const { apartmentId } = req.params;
  const userId = req.user.id;
  
  console.log('Verarbeitete Daten:', { apartmentId, userId });

  try {
    // Zuerst prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Alle Task-Templates mit ihren aktiven Instanzen abrufen
    const [tasks] = await pool.query(
      `SELECT
        t.id, t.title, t.description, t.points, t.is_recurring,
        t.interval_type, t.interval_value, t.color, t.created_at, t.archived,
        u.id as creator_id, u.name as creator_name
      FROM task t
      LEFT JOIN users u ON t.deleted_by_user_id = u.id
      WHERE t.apartment_id = ? AND t.is_deleted = 0
      ORDER BY t.created_at DESC`,
      [apartmentId]
    );

    // Alle aktiven Task-Instanzen abrufen
    const [taskInstances] = await pool.query(
      `SELECT
        ti.id, ti.task_id, ti.assigned_user_id, ti.due_date,
        ti.status, ti.completed_at, ti.completed_by_user_id,
        ti.points_awarded, ti.notes, ti.created_at, ti.archived,
        u.name as assigned_user_name,
        cu.name as completed_by_user_name
      FROM task_instance ti
      LEFT JOIN users u ON ti.assigned_user_id = u.id
      LEFT JOIN users cu ON ti.completed_by_user_id = cu.id
      WHERE ti.apartment_id = ? AND ti.is_deleted = 0
      ORDER BY ti.due_date ASC`,
      [apartmentId]
    );

    // Umwandeln von MySQL-Datumsformaten in ISO-Strings für die Frontend-Verarbeitung
    const formattedTasks = tasks.map(task => ({
      ...task,
      created_at: task.created_at ? new Date(task.created_at).toISOString() : null
    }));

    const formattedInstances = taskInstances.map(instance => ({
      ...instance,
      due_date: instance.due_date ? new Date(instance.due_date).toISOString().split('T')[0] : null,
      completed_at: instance.completed_at ? new Date(instance.completed_at).toISOString() : null,
      created_at: instance.created_at ? new Date(instance.created_at).toISOString() : null
    }));

    // Aufgaben und ihre Instanzen verknüpfen - nur Tasks mit MINDESTENS EINER Instanz zurückgeben
    const tasksWithInstances = formattedTasks.map(task => {
      const relatedInstances = formattedInstances.filter(instance => instance.task_id === task.id);
      return {
        ...task,
        instances: relatedInstances
      };
    }).filter(task => task.instances.length > 0); // Nur Tasks mit Instanzen

    // Vollständige Debugging-Informationen ausgeben
    console.log(`Gefunden: ${formattedTasks.length} Tasks-Templates und ${formattedInstances.length} Task-Instanzen`);
    console.log(`Davon haben ${tasksWithInstances.length} Templates zugeordnete Instanzen`);

    // Auch eigenständige Instanzen (die keinen task_id haben oder deren task nicht in den Tasks gefunden wird) hinzufügen
    const standaloneInstances = formattedInstances.filter(instance => 
      instance.task_id === null || !formattedTasks.some(task => task.id === instance.task_id)
    );

    res.json({
      tasks: tasksWithInstances,
      standaloneInstances
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Tasks:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen der Tasks' });
  }
});

/**
 * @route   GET /api/tasks/apartment/:apartmentId/instance/:instanceId
 * @desc    Eine bestimmte Task-Instanz abrufen
 * @access  Private
 */
router.get('/apartment/:apartmentId/instance/:instanceId', auth, async (req, res) => {
  const { apartmentId, instanceId } = req.params;
  const userId = req.user.id;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Task-Instanz mit zugehörigem Task und Benutzerdaten abrufen
    const [instances] = await pool.query(
      `SELECT 
        ti.*, 
        t.title, t.description, t.points, t.interval_type, t.interval_value, t.color,
        u.name as assigned_user_name,
        cu.name as completed_by_user_name
      FROM task_instance ti
      LEFT JOIN task t ON ti.task_id = t.id
      LEFT JOIN users u ON ti.assigned_user_id = u.id
      LEFT JOIN users cu ON ti.completed_by_user_id = cu.id
      WHERE ti.id = ? AND ti.apartment_id = ? AND ti.is_deleted = 0`,
      [instanceId, apartmentId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ message: 'Aufgabe nicht gefunden' });
    }

    // Datumsformatierung
    const instance = instances[0];
    const formattedInstance = {
      ...instance,
      due_date: instance.due_date ? new Date(instance.due_date).toISOString().split('T')[0] : null,
      completed_at: instance.completed_at ? new Date(instance.completed_at).toISOString() : null,
      created_at: instance.created_at ? new Date(instance.created_at).toISOString() : null
    };

    res.json({ task: formattedInstance });
  } catch (error) {
    console.error('Fehler beim Abrufen der Task-Instanz:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen der Task-Instanz' });
  }
});

/**
 * @route   GET /api/tasks/apartment/:apartmentId/history
 * @desc    Verlauf aller erledigten Aufgaben für ein Apartment
 * @access  Private
 */
router.get('/apartment/:apartmentId/history', auth, async (req, res) => {
  const { apartmentId } = req.params;
  const userId = req.user.id;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Historie abgeschlossener Tasks abrufen
    const [history] = await pool.query(
      `SELECT 
        ti.id, ti.task_id, ti.completed_at, ti.points_awarded,
        t.title, t.color,
        u.id as user_id, u.name as completed_by
      FROM task_instance ti
      LEFT JOIN task t ON ti.task_id = t.id
      LEFT JOIN users u ON ti.completed_by_user_id = u.id
      WHERE ti.apartment_id = ? AND ti.status = 'erledigt'
      ORDER BY ti.completed_at DESC
      LIMIT 50`,
      [apartmentId]
    );

    const formattedHistory = history.map(item => ({
      id: item.id,
      taskId: item.task_id,
      taskTitle: item.title || 'Unbekannte Aufgabe',
      completedBy: item.completed_by || 'Unbekannt',
      userId: item.user_id,
      date: item.completed_at ? new Date(item.completed_at).toISOString().split('T')[0] : null,
      points: item.points_awarded || 0,
      color: item.color || '#4a90e2'
    }));

    res.json(formattedHistory);
  } catch (error) {
    console.error('Fehler beim Abrufen des Aufgabenverlaufs:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen des Aufgabenverlaufs' });
  }
});

/**
 * @route   GET /api/tasks/apartment/:apartmentId/user/:userId/points
 * @desc    Punkte eines Benutzers in einem Apartment abrufen
 * @access  Private
 */
router.get('/apartment/:apartmentId/user/:userId/points', auth, async (req, res) => {
  const { apartmentId, userId: targetUserId } = req.params;
  const userId = req.user.id;

  try {
    // Prüfen, ob der aktuelle Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Punkte des Zielbenutzers abrufen
    const [points] = await pool.query(
      'SELECT points FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [targetUserId, apartmentId]
    );

    if (points.length === 0) {
      return res.json({ points: 0 });
    }

    res.json({ points: points[0].points || 0 });
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerpunkte:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen der Benutzerpunkte' });
  }
});

/**
 * @route   GET /api/tasks/apartment/:apartmentId/stats
 * @desc    Statistiken zu Tasks in einem Apartment abrufen
 * @access  Private
 */
router.get('/apartment/:apartmentId/stats', auth, async (req, res) => {
  const { apartmentId } = req.params;
  const userId = req.user.id;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Verteilung der Aufgaben nach Benutzer und aktuelle Punkte aus der user_apartments Tabelle
    const [userDistribution] = await pool.query(
      `SELECT 
        u.id as user_id, u.name, 
        COUNT(CASE WHEN ti.status = 'erledigt' THEN 1 END) as completed_tasks, 
        ua.points as points
      FROM users u
      JOIN user_apartments ua ON u.id = ua.user_id
      LEFT JOIN task_instance ti ON ti.completed_by_user_id = u.id AND ti.apartment_id = ua.apartment_id
      WHERE ua.apartment_id = ?
      GROUP BY u.id, u.name, ua.points
      ORDER BY ua.points DESC`,
      [apartmentId]
    );

    // Statistiken zu offenen und erledigten Aufgaben
    const [taskStats] = await pool.query(
      `SELECT 
        COUNT(CASE WHEN status = 'offen' THEN 1 END) as open_tasks,
        COUNT(CASE WHEN status = 'erledigt' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'u00fcbersprungen' THEN 1 END) as skipped_tasks,
        COUNT(*) as total_tasks
      FROM task_instance
      WHERE apartment_id = ? AND is_deleted = 0`,
      [apartmentId]
    );

    res.json({
      userDistribution,
      taskStats: taskStats[0] || { open_tasks: 0, completed_tasks: 0, skipped_tasks: 0, total_tasks: 0 }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Task-Statistiken:', error);
    res.status(500).json({ message: 'Serverfehler beim Abrufen der Task-Statistiken' });
  }
});

/**
 * @route   POST /api/tasks/apartment/:apartmentId/template
 * @desc    Neue Aufgabenvorlage erstellen
 * @access  Private
 */
router.post('/apartment/:apartmentId/template', auth, async (req, res) => {
  console.log('=== POST /api/tasks/apartment/:apartmentId/template ===');
  console.log('Anfrage-Parameter (params):', req.params);
  console.log('Anfrage-Daten (body):', req.body);
  
  const { apartmentId } = req.params;
  const userId = req.user.id;
  const { 
    title, description = "", points = 5, 
    is_recurring = false, interval_type = null, interval_value = 1,
    color = '#4a90e2'
  } = req.body;
  
  console.log('Verarbeitete Daten:', {
    apartmentId, userId, title, description, points,
    is_recurring, interval_type, interval_value, color
  });

  // Validierung
  if (!title) {
    return res.status(400).json({ message: 'Titel ist erforderlich' });
  }

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Neue Task-Vorlage erstellen
    const [result] = await pool.query(
      `INSERT INTO task (
        apartment_id, title, description, points, 
        is_recurring, interval_type, interval_value, color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [apartmentId, title, description, points, is_recurring ? 1 : 0, interval_type, interval_value, color]
    );

    const newTaskId = result.insertId;

    // Historie-Eintrag für Erstellung
    await pool.query(
      `INSERT INTO task_edit_history (
        task_id, edited_by_user_id, field_name, new_value
      ) VALUES (?, ?, ?, ?)`,
      [newTaskId, userId, 'Erstellung', title]
    );

    // Task-Infos zurückgeben
    const [newTask] = await pool.query(
      `SELECT * FROM task WHERE id = ?`,
      [newTaskId]
    );

    res.status(201).json({ 
      message: 'Aufgabenvorlage erfolgreich erstellt', 
      template: newTask[0]
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Aufgabenvorlage:', error);
    res.status(500).json({ message: 'Serverfehler beim Erstellen der Aufgabenvorlage' });
  }
});

/**
 * @route   POST /api/tasks/apartment/:apartmentId/instance
 * @desc    Neue Aufgabeninstanz erstellen (mit oder ohne Vorlage)
 * @access  Private
 */
router.post('/apartment/:apartmentId/instance', auth, async (req, res) => {
  console.log('======================================================');
  console.log('=== POST /api/tasks/apartment/:apartmentId/instance ===');
  console.log('======================================================');
  console.log('Anfrage-Parameter (params):', req.params);
  console.log('Anfrage-Body (vollständig):', JSON.stringify(req.body, null, 2));
  
  const { apartmentId } = req.params;
  const userId = req.user.id;
  const { 
    template_id = null,
    title, // Wird nur verwendet, wenn template_id nicht angegeben ist
    due_date,
    assigned_user_id = null,
    assignedUserId = null, // Alternative Benennung aus Frontend
    points = 5,
    notes = "",
    color = '#4a90e2',
    repeat = 'none', // Für Wiederholungen
    isRecurring = false,
    intervalType = null,
    intervalValue = 1,
    initial_due_date,
    customInterval = null  // NEU: Eigenes Feld für benutzerdefinierte Intervalle
  } = req.body;
  
  // ERWEITERTE DEBUG-AUSGABE FÜR DAS INITIAL_DUE_DATE PROBLEM
  console.log('DEBUG-INITIAL-DUE-DATE: Empfangene Daten:', {
    due_date,
    initial_due_date,
    body_enthält_initial_due_date: 'initial_due_date' in req.body,
    body_keys: Object.keys(req.body)
  });

  // Zeitzonenproblem beheben: Datumswerte korrekt für MySQL formatieren
  // Das Problem ist, dass MySQL Datumswerte in UTC speichert, was bei MEZ/MESZ zu einer Verschiebung führt
  let correctedDueDate = due_date; // Standardwert ohne Korrektur
  let correctedInitialDueDate = initial_due_date; // Standardwert ohne Korrektur
  
  // Normalisierung der Datumsangaben für MySQL (Zeitzonen-Problematik)
  if (due_date) {
    // Korrigiere das Datum um +1 Tag für MYSQL UTC-Speicherung
    const dateParts = due_date.split('-');
    if (dateParts.length === 3) {
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Monate sind 0-basiert in JS
      const day = parseInt(dateParts[2]);
      
      // Durch +1 kompensieren wir den Tag, den MySQL bei Konvertierung zu UTC subtrahiert
      const adjustedDate = new Date(Date.UTC(year, month, day + 1));
      const adjustedISOString = adjustedDate.toISOString().split('T')[0];
      correctedDueDate = adjustedISOString;
      
      console.log('DATUM-KORREKTUR: Due Date angepasst:', {
        originalDate: due_date,
        correctedDate: correctedDueDate,
        explanation: 'Tag +1 zur Kompensation der MySQL UTC-Konvertierung'
      });
    }
  }
  
  if (initial_due_date) {
    // Korrigiere das Datum um +1 Tag für MYSQL UTC-Speicherung
    const initialDateParts = initial_due_date.split('-');
    if (initialDateParts.length === 3) {
      const year = parseInt(initialDateParts[0]);
      const month = parseInt(initialDateParts[1]) - 1; // Monate sind 0-basiert in JS
      const day = parseInt(initialDateParts[2]);
      
      // Durch +1 kompensieren wir den Tag, den MySQL bei Konvertierung zu UTC subtrahiert
      const adjustedDate = new Date(Date.UTC(year, month, day + 1));
      const adjustedISOString = adjustedDate.toISOString().split('T')[0];
      correctedInitialDueDate = adjustedISOString;
      
      console.log('DATUM-KORREKTUR: Initial Due Date angepasst:', {
        originalDate: initial_due_date,
        correctedDate: correctedInitialDueDate,
        explanation: 'Tag +1 zur Kompensation der MySQL UTC-Konvertierung'
      });
    }
  }
  
  // Normalisierung der Daten (Frontend- und Backend-Benennungen vereinheitlichen)
  const finalAssignedUserId = assigned_user_id || assignedUserId || null;
  
  // WICHTIG: Bei benutzerdefiniertem Intervall muss isRecurring immer auf true gesetzt werden
  // und intervalType auf 'custom'
  const hasCustomInterval = !!customInterval;
  const finalIsRecurring = hasCustomInterval || isRecurring || (repeat && repeat !== 'none') || false;
  
  // Bei benutzerdefiniertem Intervall setzen wir den Typ auf 'custom'
  let finalIntervalType = intervalType || repeat || null;
  if (hasCustomInterval && (!finalIntervalType || finalIntervalType === 'none')) {
    finalIntervalType = 'custom';
    console.log('CUSTOM INTERVAL: Setze intervalType auf "custom", weil customInterval vorhanden ist');
  }
  
  console.log('Verarbeitete Daten:', {
    apartmentId, userId, template_id, title, due_date,
    assigned_user_id, assignedUserId, finalAssignedUserId,
    points, notes, color, repeat, isRecurring, intervalType,
    finalIsRecurring, finalIntervalType
  });

  // Validierung
  if (!template_id && !title) {
    return res.status(400).json({ message: 'Entweder template_id oder title muss angegeben werden' });
  }

  if (!due_date) {
    return res.status(400).json({ message: 'Fälligkeitsdatum ist erforderlich' });
  }

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    let taskTitle = title;
    let taskPoints = points;
    let taskColor = color;

    // Wenn template_id angegeben, Informationen aus dem Template verwenden
    if (template_id) {
      // Template-Informationen abrufen
      const [templates] = await pool.query(
        'SELECT title, points, color FROM task WHERE id = ? AND apartment_id = ?',
        [template_id, apartmentId]
      );

      if (templates.length === 0) {
        return res.status(404).json({ message: 'Aufgabenvorlage nicht gefunden' });
      }

      // Template-Werte verwenden, falls nicht explizit im Request angegeben
      const template = templates[0];
      taskTitle = title || template.title;
      taskPoints = points || template.points;
      taskColor = color || template.color;
    }

    console.log('CHECKPOINT 1: Task-Erstellung beginnt');
    
    let taskId = template_id;
    let taskCreationMethod = 'Von vorhandener Vorlage';
    
    // Wenn keine Vorlage existiert, erstelle zuerst einen Eintrag in der task-Tabelle
    if (!template_id) {
      console.log('CHECKPOINT 2: Keine template_id vorhanden, erstelle neuen Task-Eintrag');
      taskCreationMethod = 'Neu erstellt ohne Vorlage';
      
      try {
        // Bereite die SQL-Parameter vor (mit Debugging)
        // Korrigierte Datumsfelder verwenden (mit Zeitzonenkorrektur)
        const effective_initial_due_date = correctedInitialDueDate || correctedDueDate;
        
        // DEBUG: Ausführliche Logausgabe für initial_due_date
        console.log('DEBUG-INITIAL-DUE-DATE: SQL-Parameter Vorbereitung:', {
          empfangenes_initial_due_date: initial_due_date,
          korrigiertes_initial_due_date: correctedInitialDueDate,
          empfangenes_due_date: due_date,
          korrigiertes_due_date: correctedDueDate,
          effektiv_verwendetes_datum: effective_initial_due_date,
          grund: 'Zeitzonenkorrigierte Werte für MySQL verwendet',
          hinweis: 'MySQL speichert Datumswerte in UTC, was bei MEZ/MESZ zu -1 Tag führt, daher +1 Tag Korrektur'
        });
        
        const sqlParams = [
          apartmentId, 
          taskTitle, 
          notes || '', 
          taskPoints, 
          finalIsRecurring ? 1 : 0, // Verwende den normalisierten Wert
          finalIntervalType, // Verwende den normalisierten Wert
          intervalValue || 1,
          taskColor,
          effective_initial_due_date // Bevorzuge explicit initial_due_date, fallback auf due_date
        ];
        
        console.log('TASK SQL PARAMETER:', sqlParams);
        
        // EXPLIZITE ÜBERPRÜFUNG DER DATENBANKSPALTEN VOR DER EINFÜGUNG
        try {
          // Prüfen, ob die Spalte 'initial_due_date' in der Tabelle 'task' existiert
          const [columns] = await pool.query('SHOW COLUMNS FROM task');
          console.log('DATENBANK-SCHEMA VALIDIERUNG: Spalten in der task-Tabelle:', 
            columns.map(col => ({ field: col.Field, type: col.Type }))
          );
          
          // Überprüfe explizit auf initial_due_date
          const initialDueDateColumn = columns.find(col => col.Field === 'initial_due_date');
          if (!initialDueDateColumn) {
            console.error('KRITISCHER FEHLER: Die Spalte initial_due_date existiert nicht in der task-Tabelle!');
          } else {
            console.log('SPALTE GEFUNDEN: initial_due_date vom Typ', initialDueDateColumn.Type);
          }
        } catch (error) {
          console.error('Fehler bei der Schemaüberprüfung:', error);
        }
        
        // EXPLIZITE SQL-QUERY mit besonderem Fokus auf initial_due_date
        console.log('FINAL SQL INSERT TASK: Verwende folgende Werte:', {
          effective_initial_due_date,
          in_sqlParams_at_position: '9 (letzte Position)',
          komplette_parameter: sqlParams,
          nur_datum: sqlParams[8] // Das Datum ist an Position 8 im Array
        });
        
        // Erstelle einen neuen Eintrag in der task-Tabelle für eigenständige Aufgaben
        // MIT EXPLIZITER BENENNUNG ALLER PARAMETER
        const [taskResult] = await pool.query(
          `INSERT INTO task (
            apartment_id, title, description, points, 
            is_recurring, interval_type, interval_value, color, initial_due_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sqlParams
        );
        
        // VALIDIERUNG NACH DER EINFÜGUNG
        try {
          // Unmittelbar nach dem Einfügen prüfen, ob das initial_due_date korrekt gespeichert wurde
          const [insertedTask] = await pool.query('SELECT * FROM task WHERE id = ?', [taskResult.insertId]);
          console.log('VERIFIZIERUNG NACH INSERT: Task wurde in DB gespeichert mit folgenden Feldern:', 
            insertedTask[0] ? {
              id: insertedTask[0].id,
              title: insertedTask[0].title,
              initial_due_date: insertedTask[0].initial_due_date,
              alle_felder_in_db: Object.keys(insertedTask[0])
            } : 'Task wurde nicht gefunden!'
          );
        } catch (error) {
          console.error('Fehler bei der Verifizierung nach dem Einfügen:', error);
        }
        
        taskId = taskResult.insertId;
        console.log(`CHECKPOINT 3: Neue eigenständige Aufgabe in task-Tabelle erstellt: ID=${taskId}`);
        console.log('Query-Ergebnis:', taskResult);
      } catch (error) {
        console.error('FEHLER beim Erstellen des Task-Eintrags:', error);
        throw error; // Weitergeben, damit der Request mit Fehler abbricht
      }
    } else {
      console.log(`CHECKPOINT 3: Verwende vorhandene Task-Vorlage: ID=${taskId}`);
    }
    
    console.log('CHECKPOINT 4: Erstelle Instanz-Eintrag mit taskId:', taskId);
    
    // Zeitzonenkorrektur für due_date beim Instanz-Erstellen
    let correctedDueDate = due_date;
    if (due_date) {
      // Hier ebenfalls +1 Tag hinzufügen, um MySQL UTC-Konvertierung auszugleichen
      try {
        const dueDateParts = due_date.split('-');
        if (dueDateParts.length === 3) {
          const year = parseInt(dueDateParts[0]);
          const month = parseInt(dueDateParts[1]) - 1;
          const day = parseInt(dueDateParts[2]);
          
          const adjustedDate = new Date(Date.UTC(year, month, day + 1));
          correctedDueDate = adjustedDate.toISOString().split('T')[0];
          
          console.log('DATUM-KORREKTUR für Instanz-Erstellung:', {
            originalDate: due_date,
            correctedDate: correctedDueDate
          });
        }
      } catch (error) {
        console.error('Fehler bei der Datumkorrektur:', error);
      }
    }
    
    // Bei existierendem Task-Template: Hole das initial_due_date aus der Datenbank
    let taskInitialDueDate = null;
    if (template_id) {
      try {
        const [templates] = await pool.query(
          'SELECT initial_due_date FROM task WHERE id = ?',
          [taskId]
        );
        
        if (templates.length > 0 && templates[0].initial_due_date) {
          // Datumsobjekt erstellen und als ISO-String formatieren (verhindert Zeitzonenfehler)
          let rawDate = templates[0].initial_due_date;
          console.log('CHECKPOINT 4.1: initial_due_date aus Template ermittelt (Rohwert):', rawDate);
          
          // MySQL gibt das Datum zurück bereits in lokaler Zeit, daher KEINE weitere Korrektur nötig
          taskInitialDueDate = rawDate;
          console.log('CHECKPOINT 4.1: initial_due_date aus Template nach Korrektur:', taskInitialDueDate);
        } else {
          // KRITISCHE KORREKTUR: Wenn kein initial_due_date im Template vorhanden ist,
          // dann nimm das correctedDueDate von der aktuellen Instanz und aktualisiere das Template!
          console.log('CRITICAL FIX: Template hat kein initial_due_date! Aktualisiere Template mit:', correctedDueDate);
          
          // UPDATE des Templates mit dem due_date der Instanz als initial_due_date
          try {
            const [updateResult] = await pool.query(
              'UPDATE task SET initial_due_date = ? WHERE id = ?',
              [correctedDueDate, taskId]
            );
            
            console.log('TEMPLATE UPDATE ERGEBNIS:', {
              affectedRows: updateResult.affectedRows,
              changed: updateResult.changedRows,
              message: updateResult.affectedRows > 0 ? 
                'Task-Template erfolgreich mit initial_due_date aktualisiert' : 
                'Konnte Task-Template nicht aktualisieren'
            });
            
            // Setze auch die Variable für die weitere Verarbeitung
            taskInitialDueDate = correctedDueDate;
          } catch (updateError) {
            console.error('Fehler beim Update des initial_due_date im Template:', updateError);
          }
        }
      } catch (error) {
        console.error('Fehler beim Abrufen des initial_due_date:', error);
      }
    }
    

    
    // Wenn kein initial_due_date im Template gefunden wurde, dann verwende due_date als Fallback
    // Bei neu erstelltem Task wird das initial_due_date bereits gespeichert, muss also hier nicht
    // nochmal verwendet werden, da das due_date dort bereits aus dem initial_due_date kommt
    const finalDueDate = taskInitialDueDate || correctedDueDate;
    console.log('CHECKPOINT 4.2: Verwende für Instanz-Fälligkeitsdatum:', {
      taskInitialDueDate,
      due_date,
      finalDueDate: finalDueDate
    });
    
    // Bereite die SQL-Parameter für die Instanz vor
    const instanceParams = [
      taskId, 
      apartmentId, 
      finalAssignedUserId, // Verwende den normalisierten Wert!
      finalDueDate, // Verwende initial_due_date als Basis, Fallback auf due_date
      taskPoints, 
      notes
    ];
    
    console.log('SQL-Parameter für Instanz:', {
      taskId, 
      apartmentId, 
      assigned_user_id, 
      assignedUserId,
      finalAssignedUserId, // Der tatsächlich verwendete Wert
      due_date, 
      taskPoints, 
      notes
    });
    
    console.log('INSTANZ SQL PARAMETER:', instanceParams);
    
    let instanceId;
    try {
      // Neue Aufgabeninstanz erstellen mit dem taskId (entweder von Template oder neu erstellt)
      const [result] = await pool.query(
        `INSERT INTO task_instance (
          task_id, apartment_id, assigned_user_id, due_date, 
          status, points_awarded, notes
        ) VALUES (?, ?, ?, ?, 'offen', ?, ?)`,
        instanceParams
      );
      
      instanceId = result.insertId;
      console.log('CHECKPOINT 5: Instanz erstellt mit ID:', instanceId);
      console.log('Query-Ergebnis:', result);
    } catch (error) {
      console.error('FEHLER beim Erstellen der Instanz:', error);
      console.error('SQL-Fehler:', error.sqlMessage);
      console.error('SQL-Code:', error.code);
      throw error;
    }

    console.log('CHECKPOINT 6: Abfrage der vollständigen Instanzdaten für ID:', instanceId);
    
    let instanceData;
    try {
      // Vollständige Instanz-Informationen aus der Datenbank abrufen
      [instanceData] = await pool.query(
        `SELECT 
          ti.*, t.title, t.description, t.color, t.is_recurring, t.interval_type 
        FROM task_instance ti
        JOIN task t ON ti.task_id = t.id
        WHERE ti.id = ?`,
        [instanceId]
      );
      
      console.log('CHECKPOINT 7: Instanz-Daten aus DB abgerufen:', 
        instanceData.length > 0 ? 'Gefunden' : 'NICHT GEFUNDEN!');
      console.log('Abfrageergebnis:', JSON.stringify(instanceData, null, 2));
    } catch (error) {
      console.error('FEHLER beim Abrufen der Instanzdaten:', error);
      throw error;
    }

    if (instanceData.length === 0) {
      console.error('KRITISCHER FEHLER: Instanz konnte nach Erstellung nicht gefunden werden!');
      return res.status(500).json({ 
        message: 'Kritischer Fehler: Die erstellte Aufgabeninstanz konnte nicht gefunden werden',
        debug: { instanceId, taskId, errorCode: 'INSTANCE_NOT_FOUND_AFTER_CREATE' }
      });
    }
    
    // Details der gefundenen Instanz
    const foundInstance = instanceData[0];
    console.log('CHECKPOINT 8: Gefundene Instanz:', {
      id: foundInstance.id,
      task_id: foundInstance.task_id,
      status: foundInstance.status,
      title: foundInstance.title
    });
    
    // Instanz-Informationen aufbereiten für die Antwort
    const taskInstance = {
      id: instanceId,
      task_id: taskId,
      apartment_id: parseInt(apartmentId),
      assigned_user_id: assigned_user_id,
      due_date: due_date,
      status: 'offen',
      points_awarded: taskPoints,
      notes: notes,
      title: taskTitle,
      color: taskColor,
      is_recurring: foundInstance.is_recurring === 1,
      interval_type: foundInstance.interval_type
    };

    res.status(201).json({ 
      message: 'Aufgabeninstanz erfolgreich erstellt', 
      task: taskInstance
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Aufgabeninstanz:', error);
    res.status(500).json({ message: 'Serverfehler beim Erstellen der Aufgabeninstanz' });
  }
});

/**
 * @route   PUT /api/tasks/apartment/:apartmentId/instance/:instanceId
 * @desc    Aufgabeninstanz aktualisieren
 * @access  Private
 */
router.put('/apartment/:apartmentId/instance/:instanceId', auth, async (req, res) => {
  const { apartmentId, instanceId } = req.params;
  const userId = req.user.id;
  const { 
    assigned_user_id, due_date, is_done, points, notes, color, title, archived
  } = req.body;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Aktuelle Aufgabendaten abrufen
    const [instances] = await pool.query(
      'SELECT * FROM task_instance WHERE id = ? AND apartment_id = ?',
      [instanceId, apartmentId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ message: 'Aufgabeninstanz nicht gefunden' });
    }

    const instance = instances[0];
    const taskId = instance.task_id;
    const wasCompleted = instance.status === 'erledigt';
    const completedNow = is_done === true || is_done === 1;

    // Update-Objekt vorbereiten
    const updateData = {};
    if (assigned_user_id !== undefined) updateData.assigned_user_id = assigned_user_id;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (notes !== undefined) updateData.notes = notes;
    // Punkte können entweder über 'points' oder direkt über 'points_awarded' gesendet werden
    if (points !== undefined) updateData.points_awarded = points;
    if (req.body.points_awarded !== undefined) updateData.points_awarded = req.body.points_awarded;
    // Archivierungsstatus aktualisieren
    if (archived !== undefined) updateData.archived = archived ? 1 : 0;

    // Status und Abschluss-Informationen aktualisieren
    if (is_done !== undefined) {
      updateData.status = completedNow ? 'erledigt' : 'offen';
      
      // Wenn Aufgabe jetzt erledigt wird und vorher nicht erledigt war
      if (completedNow && !wasCompleted) {
        updateData.completed_at = new Date();
        // Wenn ein completed_by_user_id im Request-Body vorhanden ist, verwende diesen
        // ansonsten verwende die ID des aktuellen Benutzers
        updateData.completed_by_user_id = req.body.completed_by_user_id !== undefined ? req.body.completed_by_user_id : userId;
        console.log('Task wird als erledigt markiert von:', updateData.completed_by_user_id, 'angefordert von Benutzer:', userId);

        // Punkte dem Benutzer gutschreiben, der die Aufgabe erledigt hat (nicht unbedingt der aktuelle Benutzer)
        // Verwende die aktualisierten Punkte (aus updateData) oder die ursprünglichen
        const pointsToAward = updateData.points_awarded !== undefined ? updateData.points_awarded : (instance.points_awarded || 0);
        
        // Der Benutzer, der die Punkte bekommt (derjenige, der die Aufgabe erledigt hat)
        const userToReward = updateData.completed_by_user_id;
        console.log(`Schreibe ${pointsToAward} Punkte für Benutzer ${userToReward} gut (angefordert von ${userId})`);
        
        await pool.query(
          'UPDATE user_apartments SET points = points + ? WHERE user_id = ? AND apartment_id = ?',
          [pointsToAward, userToReward, apartmentId]
        );
      }
      // Wenn Aufgabe wieder geöffnet wird
      else if (!completedNow && wasCompleted) {
        updateData.completed_at = null;
        updateData.completed_by_user_id = null;

        // Wenn möglich, Punkte wieder abziehen
        if (instance.completed_by_user_id) {
          await pool.query(
            'UPDATE user_apartments SET points = GREATEST(0, points - ?) WHERE user_id = ? AND apartment_id = ?',
            [instance.points_awarded || 0, instance.completed_by_user_id, apartmentId]
          );
        }
      }
    }

    // Wenn keine u00c4nderungen, früh beenden
    if (Object.keys(updateData).length === 0) {
      return res.json({ 
        message: 'Keine u00c4nderungen vorgenommen',
        task: instance
      });
    }

    // Update-Query dynamisch aufbauen
    const columns = Object.keys(updateData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(updateData);

    const updateQuery = `
      UPDATE task_instance
      SET ${columns.map(col => `${col} = ?`).join(', ')}
      WHERE id = ? AND apartment_id = ?
    `;
    
    await pool.query(updateQuery, [...values, instanceId, apartmentId]);

    // Aktualisierte Aufgabe abrufen
    const [updatedInstances] = await pool.query(
      `SELECT ti.*, t.title, t.color, u.name as completed_by_user_name
       FROM task_instance ti
       LEFT JOIN task t ON ti.task_id = t.id
       LEFT JOIN users u ON ti.completed_by_user_id = u.id
       WHERE ti.id = ?`,
      [instanceId]
    );

    // Titel und Farbe der zugehörigen Task-Vorlage aktualisieren
    if (taskId && (title !== undefined || color !== undefined)) {
      const taskUpdateData = {};
      if (title !== undefined) taskUpdateData.title = title;
      if (color !== undefined) taskUpdateData.color = color;

      if (Object.keys(taskUpdateData).length > 0) {
        const taskUpdateColumns = Object.keys(taskUpdateData);
        const taskUpdateQuery = `
          UPDATE task
          SET ${taskUpdateColumns.map(col => `${col} = ?`).join(', ')}
          WHERE id = ? AND apartment_id = ?
        `;
        
        await pool.query(taskUpdateQuery, [...Object.values(taskUpdateData), taskId, apartmentId]);
      }
    }

    let nextTask = null;

    // Wenn Aufgabe erledigt wurde und es eine wiederkehrende Aufgabe ist, neue Instanz erstellen
    if (completedNow && !wasCompleted && taskId) {
      const [tasks] = await pool.query(
        'SELECT * FROM task WHERE id = ? AND is_recurring = 1',
        [taskId]
      );

      if (tasks.length > 0) {
        const task = tasks[0];
        
        // Berechne wie überfällig die Aufgabe ist
        const currentDate = new Date();
        currentDate.setHours(12, 0, 0, 0);
        
        const instanceDueDate = new Date(due_date || instance.due_date);
        instanceDueDate.setHours(12, 0, 0, 0);
        
        // Prüfe, ob die Aufgabe überfällig ist und wie stark
        const isOverdue = instanceDueDate < currentDate;
        const daysOverdue = isOverdue ? Math.floor((currentDate - instanceDueDate) / (1000 * 60 * 60 * 24)) : 0;
        
        console.log('Aufgabe wird abgeschlossen:', {
          task_id: task.id,
          title: task.title,
          instanceDueDate: instanceDueDate.toISOString(),
          currentDate: currentDate.toISOString(),
          isOverdue,
          daysOverdue,
          interval_type: task.interval_type,
          interval_value: task.interval_value
        });
        
        // Berechne das nächste Fälligkeitsdatum basierend auf der Überfälligkeit
        let nextDueDate;
        
        if (isOverdue) {
          // Bestimme, ob die Aufgabe stark überfällig ist (mindestens ein volles Intervall)
          const intervalDays = task.interval_type === 'daily' ? task.interval_value : 
                         task.interval_type === 'weekly' ? task.interval_value * 7 : 
                         task.interval_type === 'monthly' ? task.interval_value * 30 : 
                         task.interval_type === 'custom' ? task.interval_value : 7;
                         
          // Bei mehr als 50% vom verpassten Intervall gilt die Aufgabe als stark überfällig
          const isVeryOverdue = daysOverdue >= intervalDays * 0.5;
          
          if (isVeryOverdue) {
            // Bei stark überfälligen Aufgaben: Beginne vom aktuellen Datum
            console.log(`Aufgabe ist STARK ÜBERFÄLLIG (${daysOverdue} Tage, Intervall ist ${intervalDays} Tage)`);
            
            // Erzeuge ein neues Datum basierend auf dem aktuellen Datum
            const baseDate = new Date(currentDate);
            baseDate.setHours(12, 0, 0, 0);
            
            // Füge das Intervall hinzu - WICHTIG: Immer den Typ UND den Wert berücksichtigen!
            switch (task.interval_type) {
              case 'daily':
                baseDate.setDate(baseDate.getDate() + task.interval_value);
                console.log(`Täglich: +${task.interval_value} Tage`);
                break;
              case 'weekly':
                // Bei weekly MUSS mit 7 multipliziert werden!
                baseDate.setDate(baseDate.getDate() + (task.interval_value * 7));
                console.log(`Wöchentlich: +${task.interval_value * 7} Tage`);
                break;
              case 'monthly':
                baseDate.setMonth(baseDate.getMonth() + task.interval_value);
                console.log(`Monatlich: +${task.interval_value} Monate`);
                break;
              case 'custom':
                // Bei custom ist der Wert direkt in Tagen
                baseDate.setDate(baseDate.getDate() + task.interval_value);
                console.log(`Benutzerdefiniert: +${task.interval_value} Tage`);
                break;
              default:
                // Fallback auf weekly
                baseDate.setDate(baseDate.getDate() + 7);
                console.log('Fallback auf wöchentlich: +7 Tage');
            }
            
            // ZEITZONENKORREKTUR: Füge explizit einen Tag hinzu bei der Rechnung vom aktuellen Datum aus
            // Das ist notwendig, weil bei der Speicherung in der DB sonst über Zeitzonenverschiebung 1 Tag verloren geht
            
            // Wir brauchen je nach Intervalltyp unterschiedliche Korrekturen
            switch (task.interval_type) {
              case 'daily':
                // Für tägliche Intervalle auch +1 Tag hinzufügen
                baseDate.setDate(baseDate.getDate() + 1);
                console.log('ZEITZONENKORREKTUR (daily): +1 Tag hinzugefügt');
                break;
              
              case 'weekly':
                // Für wöchentliche Intervalle +1 Tag hinzufügen
                baseDate.setDate(baseDate.getDate() + 1);
                console.log('ZEITZONENKORREKTUR (weekly): +1 Tag hinzugefügt');
                break;
              
              case 'monthly':
                // Auch bei monatlichen Intervallen +1 Tag hinzufügen
                baseDate.setDate(baseDate.getDate() + 1);
                console.log('ZEITZONENKORREKTUR (monthly): +1 Tag hinzugefügt');
                break;
              
              case 'custom':
                // Auch bei benutzerdefinierten Intervallen +1 Tag hinzufügen
                baseDate.setDate(baseDate.getDate() + 1);
                console.log('ZEITZONENKORREKTUR (custom): +1 Tag hinzugefügt');
                break;
            }
            
            // Formatiere das Datum als YYYY-MM-DD mit zusätzlicher Debug-Ausgabe
            const year = baseDate.getFullYear();
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            nextDueDate = `${year}-${month}-${day}`;
            
            console.log(`Nächstes Fälligkeitsdatum (von HEUTE aus): ${nextDueDate}`);
            // Verbesserte Debug-Ausgabe mit korrekten Intervallen für alle Typen
            console.log('Detaillierte Datumsberechnung:', {
              vorBerechnung: baseDate.toISOString(),
              intervallTyp: task.interval_type,
              intervallWert: task.interval_value,
              berechnetesTagesintervall: (() => {
                switch(task.interval_type) {
                  case 'daily': return task.interval_value + 1;
                  case 'weekly': return task.interval_value * 7 + 1;
                  case 'monthly': return `${task.interval_value} Monate + 1 Tag`;
                  case 'custom': return task.interval_value + 1;
                  default: return task.interval_value;
                }
              })(),
              jahr: year,
              monat: month,
              tag: day
            });
          } else {
            // Bei leicht überfälligen Aufgaben: Verwende calculateNextDueDate mit altem Datum
            console.log(`Aufgabe ist LEICHT ÜBERFÄLLIG (${daysOverdue} Tage, Intervall ist ${intervalDays} Tage)`);
            nextDueDate = calculateNextDueDate(due_date || instance.due_date, task.interval_type, task.interval_value);
            console.log(`Nächstes Fälligkeitsdatum (von ORIGINAL aus): ${nextDueDate}`);
          }
        } else {
          // Prüfe, ob die Aufgabe VOR dem Fälligkeitsdatum erledigt wird
          const earlilyCompleted = instanceDueDate > currentDate;
          
          if (earlilyCompleted) {
            // Bei vorzeitiger Erledigung: Berechne vom aktuellen Datum aus
            console.log('Aufgabe wird VORZEITIG erledigt, berechne ab aktuellem Datum');
            
            // Erzeuge ein neues Datum basierend auf dem aktuellen Datum
            const baseDate = new Date(currentDate);
            baseDate.setHours(12, 0, 0, 0);
            
            // Füge das Intervall hinzu - immer den Typ UND den Wert berücksichtigen!
            switch (task.interval_type) {
              case 'daily':
                baseDate.setDate(baseDate.getDate() + task.interval_value);
                console.log(`Täglich: +${task.interval_value} Tage`);
                break;
              case 'weekly':
                // Bei weekly MUSS mit 7 multipliziert werden!
                baseDate.setDate(baseDate.getDate() + (task.interval_value * 7));
                console.log(`Wöchentlich: +${task.interval_value * 7} Tage`);
                break;
              case 'monthly':
                baseDate.setMonth(baseDate.getMonth() + task.interval_value);
                console.log(`Monatlich: +${task.interval_value} Monate`);
                break;
              case 'custom':
                // Bei custom ist der Wert direkt in Tagen
                baseDate.setDate(baseDate.getDate() + task.interval_value);
                console.log(`Benutzerdefiniert: +${task.interval_value} Tage`);
                break;
              default:
                // Fallback auf weekly
                baseDate.setDate(baseDate.getDate() + 7);
                console.log('Fallback auf wöchentlich: +7 Tage');
            }
            
            // ZEITZONENKORREKTUR: Füge explizit einen Tag hinzu
            // Das ist notwendig, weil bei der Speicherung in der DB sonst über Zeitzonenverschiebung 1 Tag verloren geht
            baseDate.setDate(baseDate.getDate() + 1);
            console.log('ZEITZONENKORREKTUR: +1 Tag hinzugefügt');
            
            // Formatiere das Datum als YYYY-MM-DD
            const year = baseDate.getFullYear();
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            nextDueDate = `${year}-${month}-${day}`;
            
            console.log(`Nächstes Fälligkeitsdatum (von HEUTE aus bei vorzeitiger Erledigung): ${nextDueDate}`);
          } else {
            // Genau rechtzeitig erledigt: Normale Berechnung vom ursprünglichen Datum
            nextDueDate = calculateNextDueDate(due_date || instance.due_date, task.interval_type, task.interval_value);
            console.log(`Nächstes Fälligkeitsdatum (pünktlich erledigt): ${nextDueDate}`);
          }
        }
        
        // Holen der Beschreibung aus dem Task-Template
        const [taskTemplate] = await pool.query(
          'SELECT description FROM task WHERE id = ?',
          [taskId]
        );
        
        // Template-Beschreibung in die neue Instanz kopieren
        const templateDescription = taskTemplate.length > 0 ? taskTemplate[0].description : '';
        console.log('Kopiere Beschreibung in neue Instanz:', templateDescription);
        
        // Neue Instanz mit nächstem Fälligkeitsdatum erstellen
        const [result] = await pool.query(
          `INSERT INTO task_instance (
            task_id, apartment_id, assigned_user_id, due_date, status, points_awarded, notes
          ) VALUES (?, ?, ?, ?, 'offen', ?, ?)`,
          [taskId, apartmentId, assigned_user_id || instance.assigned_user_id, nextDueDate, task.points, templateDescription]
        );

        const [newInstances] = await pool.query(
          `SELECT ti.*, t.title, t.color
           FROM task_instance ti
           LEFT JOIN task t ON ti.task_id = t.id
           WHERE ti.id = ?`,
          [result.insertId]
        );

        if (newInstances.length > 0) {
          nextTask = {
            ...newInstances[0],
            due_date: newInstances[0].due_date ? new Date(newInstances[0].due_date).toISOString().split('T')[0] : null
          };
        }
      }
    }

    // Aufgabe die zuvor aktualisiert wurde zurückgeben
    const updatedTask = updatedInstances.length > 0 ? {
      ...updatedInstances[0],
      due_date: updatedInstances[0].due_date ? new Date(updatedInstances[0].due_date).toISOString().split('T')[0] : null,
      completed_at: updatedInstances[0].completed_at ? new Date(updatedInstances[0].completed_at).toISOString() : null
    } : null;

    res.json({ 
      message: 'Aufgabe erfolgreich aktualisiert',
      task: updatedTask,
      nextTask
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Aufgabe:', error);
    console.error('SQL-Fehler:', error.sqlMessage || 'Kein SQL-Fehler');
    console.error('SQL-Code:', error.code || 'Kein Fehlercode');
    console.error('Stack:', error.stack);
    console.error('Request-Daten:', req.body);
    res.status(500).json({ 
      message: 'Serverfehler beim Aktualisieren der Aufgabe', 
      error: error.message, 
      sqlError: error.sqlMessage 
    });
  }
});

/**
 * @route   PUT /api/tasks/apartment/:apartmentId/task/:taskId
 * @desc    Task-Template aktualisieren
 * @access  Private
 */
router.put('/apartment/:apartmentId/task/:taskId', auth, async (req, res) => {
  console.log('======================================================');
  console.log('=== PUT /api/tasks/apartment/:apartmentId/task/:taskId ===');
  console.log('======================================================');
  console.log('Anfrage-Parameter (params):', req.params);
  console.log('Anfrage-Body (vollständig):', JSON.stringify(req.body, null, 2));
  
  const { apartmentId, taskId } = req.params;
  const userId = req.user.id;
  const { 
    title, description, points, 
    is_recurring, interval_type, interval_value,
    color, initial_due_date, archived
  } = req.body;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Prüfen, ob das Task-Template existiert und zum angegebenen Apartment gehört
    const [tasks] = await pool.query(
      'SELECT * FROM task WHERE id = ? AND apartment_id = ? AND is_deleted = 0',
      [taskId, apartmentId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ message: 'Aufgabenvorlage nicht gefunden' });
    }

    // Update-Objekt vorbereiten
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (points !== undefined) updateData.points = points;
    if (is_recurring !== undefined) updateData.is_recurring = is_recurring ? 1 : 0;
    if (interval_type !== undefined) updateData.interval_type = interval_type;
    if (interval_value !== undefined) updateData.interval_value = interval_value;
    if (color !== undefined) updateData.color = color;
    if (initial_due_date !== undefined) updateData.initial_due_date = initial_due_date;
    if (archived !== undefined) updateData.archived = archived ? 1 : 0;
    updateData.updated_at = new Date();

    // Wenn keine Änderungen, früh beenden
    if (Object.keys(updateData).length === 0) {
      return res.json({ 
        message: 'Keine Änderungen vorgenommen',
        task: tasks[0]
      });
    }

    // Update-Query dynamisch aufbauen
    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = columns.map(col => `${col} = ?`).join(', ');

    // Task-Template aktualisieren
    await pool.query(
      `UPDATE task SET ${setClause} WHERE id = ? AND apartment_id = ?`,
      [...values, taskId, apartmentId]
    );

    // Wenn die Punktzahl geändert wurde, aktualisiere alle offenen Instanzen
    if (points !== undefined) {
      console.log(`Punkte des Templates wurden von ${tasks[0].points} auf ${points} geändert - aktualisiere alle offenen Instanzen`);
      
      // Nur offene Instanzen aktualisieren (status = 'offen')
      await pool.query(
        `UPDATE task_instance 
         SET points_awarded = ? 
         WHERE task_id = ? AND status = 'offen'`,
        [points, taskId]
      );
    }
    
    // Wenn der Archivierungsstatus geändert wurde, alle Instanzen entsprechend aktualisieren
    if (archived !== undefined) {
      console.log(`Archivierungsstatus des Templates wurde auf ${archived ? 'archiviert' : 'nicht archiviert'} gesetzt - aktualisiere alle Instanzen`);
      
      // Alle Instanzen dieses Templates aktualisieren
      await pool.query(
        `UPDATE task_instance 
         SET archived = ? 
         WHERE task_id = ?`,
        [archived ? 1 : 0, taskId]
      );
    }

    // Historie-Eintrag für wichtige Änderungen
    if (title !== undefined) {
      await pool.query(
        `INSERT INTO task_edit_history (
          task_id, edited_by_user_id, field_name, old_value, new_value
        ) VALUES (?, ?, ?, ?, ?)`,
        [taskId, userId, 'title', tasks[0].title, title]
      );
    }

    // Aktualisierte Task-Informationen abrufen
    const [updatedTasks] = await pool.query(
      'SELECT * FROM task WHERE id = ?',
      [taskId]
    );

    res.json({ 
      message: 'Aufgabenvorlage erfolgreich aktualisiert',
      task: updatedTasks[0]
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Aufgabenvorlage:', error);
    res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Aufgabenvorlage' });
  }
});

/**
 * @route   PUT /api/tasks/apartment/:apartmentId/template/:templateId/archive
 * @desc    Task-Template und alle zugehörigen Instanzen archivieren
 * @access  Private
 */
router.put('/apartment/:apartmentId/template/:templateId/archive', auth, async (req, res) => {
  const { apartmentId, templateId } = req.params;
  const userId = req.user.id;
  const { archived } = req.body; // true zum Archivieren, false zum Wiederherstellen

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Prüfen, ob das Template existiert
    const [templates] = await pool.query(
      'SELECT * FROM task WHERE id = ? AND apartment_id = ? AND is_deleted = 0',
      [templateId, apartmentId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ message: 'Aufgabenvorlage nicht gefunden' });
    }

    // 1. Template archivieren
    await pool.query(
      'UPDATE task SET archived = ? WHERE id = ?',
      [archived ? 1 : 0, templateId]
    );

    // 2. Alle zugehörigen Instanzen archivieren
    await pool.query(
      'UPDATE task_instance SET archived = ? WHERE task_id = ?',
      [archived ? 1 : 0, templateId]
    );

    res.json({
      message: `Aufgabenvorlage erfolgreich ${archived ? 'archiviert' : 'wiederhergestellt'}`,
      archived: archived ? 1 : 0,
      template_id: templateId
    });
  } catch (error) {
    console.error(`Fehler beim ${archived ? 'Archivieren' : 'Wiederherstellen'} der Aufgabenvorlage:`, error);
    res.status(500).json({ message: `Serverfehler beim ${archived ? 'Archivieren' : 'Wiederherstellen'} der Aufgabenvorlage` });
  }
});

/**
 * @route   DELETE /api/tasks/apartment/:apartmentId/instance/:instanceId
 * @desc    Aufgabeninstanz löschen (soft delete)
 * @access  Private
 */
router.delete('/apartment/:apartmentId/instance/:instanceId', auth, async (req, res) => {
  const { apartmentId, instanceId } = req.params;
  const userId = req.user.id;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // Aktuelle Aufgabendaten abrufen, um den Status zu prüfen
    const [instances] = await pool.query(
      'SELECT * FROM task_instance WHERE id = ? AND apartment_id = ?',
      [instanceId, apartmentId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ message: 'Aufgabeninstanz nicht gefunden' });
    }

    const instance = instances[0];
    const isCompleted = instance.status === 'erledigt';
    const hasPoints = instance.points_awarded > 0;
    
    console.log(`Lösche Aufgabe ${instanceId}:`, {
      isCompleted,
      hasPoints,
      pointsAwarded: instance.points_awarded,
      completedByUserId: instance.completed_by_user_id
    });
    
    // Wenn die Aufgabe erledigt ist und Punkte vergeben wurden, diese abziehen
    let newTotalPoints = null;
    
    if (isCompleted && hasPoints && instance.completed_by_user_id) {
      console.log(`Ziehe ${instance.points_awarded} Punkte von Benutzer ${instance.completed_by_user_id} ab`);
      
      // Punkte vom Benutzer abziehen
      await pool.query(
        'UPDATE user_apartments SET points = GREATEST(0, points - ?) WHERE user_id = ? AND apartment_id = ?',
        [instance.points_awarded, instance.completed_by_user_id, apartmentId]
      );
      
      // Neuen Punktestand abrufen
      const [userPoints] = await pool.query(
        'SELECT points FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
        [instance.completed_by_user_id, apartmentId]
      );
      
      if (userPoints.length > 0) {
        newTotalPoints = userPoints[0].points;
      }
    }

    // Soft Delete der Aufgabeninstanz
    await pool.query(
      `UPDATE task_instance 
       SET is_deleted = 1, deleted_at = NOW(), deleted_by_user_id = ? 
       WHERE id = ? AND apartment_id = ?`,
      [userId, instanceId, apartmentId]
    );

    res.json({ 
      message: 'Aufgabe erfolgreich gelöscht',
      wasCompleted: isCompleted,
      pointsRemoved: isCompleted && hasPoints ? instance.points_awarded : 0,
      completedByUserId: isCompleted ? instance.completed_by_user_id : null,
      newTotalPoints: newTotalPoints
    });
  } catch (error) {
    console.error('Fehler beim Löschen der Aufgabe:', error);
    res.status(500).json({ message: 'Serverfehler beim Löschen der Aufgabe' });
  }
});

// Hilfsfunktion zur Berechnung der Anzahl von Tagen zwischen zwei Datumsangaben
function getDayDifference(startDate, endDate) {
  // Beide Daten auf Mitternacht normalisieren
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(12, 0, 0, 0);
  
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(12, 0, 0, 0);
  
  // Differenz in Millisekunden berechnen und auf Tage umrechnen
  const diffTime = Math.abs(normalizedEnd - normalizedStart);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Hilfsfunktion zur Berechnung des nächsten Fälligkeitsdatums
function calculateNextDueDate(currentDueDate, intervalType, intervalValue = 1) {
  console.log('Berechne nächstes Fälligkeitsdatum:', {
    originalDueDate: currentDueDate,
    intervalType,
    intervalValue
  });
  
  // Aktuelles Datum für den Vergleich (in lokaler Zeitzone)
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Setze auf Mittag, um Zeitzonen-Probleme zu vermeiden
  
  // Original-Fälligkeitsdatum parsen (in lokaler Zeitzone)
  const originalDueDate = new Date(currentDueDate);
  originalDueDate.setHours(12, 0, 0, 0); // Setze auf Mittag, um Zeitzonen-Probleme zu vermeiden
  
  // Überprüfen, ob die Aufgabe überfällig ist
  const isOverdue = originalDueDate < today;
  
  // Bei überfälligen Aufgaben vom aktuellen Datum ausgehen, ansonsten vom Fälligkeitsdatum
  let baseDate;
  let daysOverdue = 0;
  
  if (isOverdue) {
    // Bei überfälligen Aufgaben: Wie viele Tage/Wochen/Monate ist sie überfällig?
    daysOverdue = Math.floor((today - originalDueDate) / (1000 * 60 * 60 * 24));
    console.log(`Aufgabe ist ${daysOverdue} Tage überfällig`);
    
    // Bei stark überfälligen Aufgaben starten wir vom aktuellen Datum
    // Heuristik: Wenn mehr als die Hälfte des Intervalls überschritten ist
    const intervalDays = intervalType === 'daily' ? intervalValue : 
                    intervalType === 'weekly' ? intervalValue * 7 : 
                    intervalType === 'monthly' ? intervalValue * 30 : 7;
    if (daysOverdue >= intervalDays * 0.5) {
      // Bei stark überfälligen Aufgaben (mind. 50% des Intervalls) vom heutigen Datum ausgehen
      
      console.log(`STARK ÜBERFÄLLIG - ${daysOverdue} Tage überfällig, Intervall ist ${intervalDays} Tage (50% = ${intervalDays * 0.5} Tage)`)
      
      // Heutiges Datum manuell erstellen, um Zeitzonenprobleme zu vermeiden
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();
      
      // Neues Datum mit lokaler Zeit erzeugen, ohne Zeitzonenverschiebung
      baseDate = new Date(currentYear, currentMonth, currentDay, 12, 0, 0, 0);
      console.log('Verwende HEUTIGES Datum als Basis (stark überfällig):', 
                 baseDate.toISOString());
    } else {
      // Bei leicht überfälligen Aufgaben vom ursprünglichen Datum ausgehen
      baseDate = new Date(originalDueDate);
      console.log('Verwende URSPRÜNGLICHES Datum als Basis (leicht überfällig)');
    }
  } else {
    // Nicht überfällig - verwende das ursprüngliche Datum
    baseDate = new Date(originalDueDate);
    console.log('Verwende URSPRÜNGLICHES Datum als Basis (nicht überfällig)');
  }
  
  // Ab hier die normale Berechnung basierend auf dem ausgewählten Basisdatum
  switch (intervalType) {
    case 'daily':
      baseDate.setDate(baseDate.getDate() + intervalValue);
      break;
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + (7 * intervalValue));
      break;
    case 'monthly':
      baseDate.setMonth(baseDate.getMonth() + intervalValue);
      break;
    case 'custom':
      // Für benutzerdefinierte Intervalle interpretieren wir den Wert als Tage
      baseDate.setDate(baseDate.getDate() + intervalValue);
      break;
    default:
      // Wenn kein Intervall angegeben, 7 Tage als Standard nehmen
      baseDate.setDate(baseDate.getDate() + 7);
  }
  
  // Zähle explizit den Tag um zu prüfen, ob die Berechnung korrekt ist
  if (intervalType === 'weekly') {
    // Für stark überfällige Aufgaben, bei denen wir vom aktuellen Datum ausgehen
    // Eine Aufgabe ist stark überfällig, wenn sie mindestens ein volles Intervall (z.B. 7 Tage bei weekly) überfällig ist
    const intervalDays = intervalValue * 7;
    const isUsingCurrentDateDueToOverdue = isOverdue && daysOverdue >= intervalDays;
    
    if (isUsingCurrentDateDueToOverdue) {
      // Bei stark überfälligen Aufgaben: Stellen wir sicher, dass genau 7 Tage hinzugefügt wurden
      const expectedDate = new Date(baseDate);
      expectedDate.setDate(expectedDate.getDate() + (intervalValue * 7));
      expectedDate.setHours(12, 0, 0, 0); // Mittag-Normalisierung
      baseDate = expectedDate;
      console.log('STARK ÜBERFÄLLIG: Setze nächstes Datum auf genau', intervalValue * 7, 'Tage ab heute:', baseDate.toISOString());
    } else {
      // Normal: Prüfe und korrigiere die Tage-Differenz
      const dayDiff = getDayDifference(originalDueDate, baseDate);
      console.log(`Tage-Differenz: ${dayDiff} - Start: ${originalDueDate.toISOString()}, Ende: ${baseDate.toISOString()}`);
      
      // Prüfung: Bei weekly muss die Differenz genau intervalValue * 7 Tage sein
      if (dayDiff !== intervalValue * 7) {
        console.warn(`WARNUNG: Erwartete ${intervalValue * 7} Tage Differenz, aber berechnete ${dayDiff}. Korrigiere...`);
        // Explizite Korrektur: Genau X * 7 Tage vom Original-Due-Date
        baseDate = new Date(originalDueDate);
        baseDate.setDate(originalDueDate.getDate() + (intervalValue * 7));
        baseDate.setHours(12, 0, 0, 0); // Mittag-Normalisierung
      }
    }
  }
  
  // Format in YYYY-MM-DD umwandeln und Zeitzone berücksichtigen
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  const result = `${year}-${month}-${day}`;
  
  console.log('Berechnetes nächstes Fälligkeitsdatum:', result);
  return result;
}

/**
 * @route   PUT /api/tasks/apartment/:apartmentId/instance/:instanceId/reopen
 * @desc    Erledigte Aufgabeninstanz wieder als 'offen' markieren und neuere offene Instanzen entfernen
 * @access  Private
 */
router.put('/apartment/:apartmentId/instance/:instanceId/reopen', auth, async (req, res) => {
  const { apartmentId, instanceId } = req.params;
  const userId = req.user.id;

  try {
    // Prüfen, ob der Benutzer Mitglied des Apartments ist
    const [apartmentMember] = await pool.query(
      'SELECT * FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
      [userId, apartmentId]
    );

    if (apartmentMember.length === 0) {
      return res.status(403).json({ message: 'Kein Zugriff auf dieses Apartment' });
    }

    // 1. Zuerst die Instanz abrufen, um sicherzustellen, dass sie existiert und Template-Info zu erhalten
    const [instances] = await pool.query(
      'SELECT ti.*, t.title, t.points, u.name as assigned_user_name \n       FROM task_instance ti \n       LEFT JOIN task t ON ti.task_id = t.id \n       LEFT JOIN users u ON ti.assigned_user_id = u.id \n       WHERE ti.id = ? AND ti.apartment_id = ? AND ti.is_deleted = 0',
      [instanceId, apartmentId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ message: 'Aufgabeninstanz nicht gefunden' });
    }

    const instance = instances[0];
    
    // 2. Prüfen, ob die Instanz tatsächlich erledigt ist
    if (instance.status !== 'erledigt') {
      return res.status(400).json({ 
        message: 'Die Aufgabeninstanz ist nicht als erledigt markiert und kann daher nicht wiederhergestellt werden' 
      });
    }

    // 3. Benutzerinfo abrufen
    const completedByUserId = instance.completed_by_user_id;
    const pointsAwarded = instance.points_awarded || 0;
    
    // 4. Neuere offene Instanzen desselben Templates finden
    const [newerInstances] = await pool.query(
      "SELECT * FROM task_instance \n       WHERE task_id = ? AND apartment_id = ? AND id != ? \n       AND status = 'offen' AND is_deleted = 0",
      [instance.task_id, apartmentId, instanceId]
    );
    
    let removedNewerInstance = null;
    
    // 5. Wenn es neuere Instanzen gibt, die neueste davon löschen (soft delete)
    if (newerInstances.length > 0) {
      // Sortiere nach Fälligkeitsdatum - die nächste anstehende Instanz
      const sortedInstances = newerInstances.sort((a, b) => {
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA - dateB;
      });
      
      // Die erste Instanz ist die nächste anstehende
      const instanceToRemove = sortedInstances[0];
      removedNewerInstance = { ...instanceToRemove };
      
      // Soft-Delete durchführen
      await pool.query(
        'UPDATE task_instance SET is_deleted = 1, deleted_at = NOW(), deleted_by_user_id = ? WHERE id = ?',
        [userId, instanceToRemove.id]
      );
      
      console.log(`Neuere Instanz ${instanceToRemove.id} wurde entfernt, um Duplikate zu vermeiden`);
    }
    
    // 6. Die ursprüngliche Instanz wieder als 'offen' markieren
    await pool.query(
      "UPDATE task_instance SET status = 'offen', completed_at = NULL, completed_by_user_id = NULL, \n       points_awarded = NULL WHERE id = ?",
      [instanceId]
    );
    
    console.log(`Instanz ${instanceId} wurde erfolgreich wieder als 'offen' markiert`);
    
    // 7. Falls Punkte abgezogen werden müssen, dies tun
    let pointsRemoved = 0;
    let newTotalPoints = 0;
    
    if (completedByUserId && pointsAwarded > 0) {
      // Aktuelle Punkte des Benutzers in diesem Apartment abrufen
      const [userApartmentPoints] = await pool.query(
        'SELECT points FROM user_apartments WHERE user_id = ? AND apartment_id = ?',
        [completedByUserId, apartmentId]
      );
      
      if (userApartmentPoints.length > 0) {
        const currentPoints = userApartmentPoints[0].points || 0;
        pointsRemoved = pointsAwarded;
        newTotalPoints = Math.max(0, currentPoints - pointsRemoved);
        
        // Punkte abziehen
        await pool.query(
          'UPDATE user_apartments SET points = ? WHERE user_id = ? AND apartment_id = ?',
          [newTotalPoints, completedByUserId, apartmentId]
        );
        
        console.log(`${pointsRemoved} Punkte von Benutzer ${completedByUserId} in Apartment ${apartmentId} abgezogen. Neuer Punktestand: ${newTotalPoints}`);
      }
    }
    
    // 8. Aktualisierte Aufgabeninstanz abrufen
    const [updatedInstances] = await pool.query(
      'SELECT ti.*, t.title, t.points, u.name as assigned_user_name \n       FROM task_instance ti \n       LEFT JOIN task t ON ti.task_id = t.id \n       LEFT JOIN users u ON ti.assigned_user_id = u.id \n       WHERE ti.id = ?',
      [instanceId]
    );

    res.json({
      message: 'Aufgabeninstanz erfolgreich wieder geöffnet',
      task: updatedInstances[0],
      removedNewerInstance,
      pointsRemoved,
      newTotalPoints
    });
  } catch (error) {
    console.error('Fehler beim Wiederherstellen der Aufgabeninstanz:', error);
    res.status(500).json({ message: 'Serverfehler beim Wiederherstellen der Aufgabeninstanz' });
  }
});

module.exports = router;
