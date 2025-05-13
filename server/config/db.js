require('dotenv').config();
const mysql = require('mysql2/promise');

// Datenbankverbindungskonfiguration
let pool;

// Datenbankverbindung konfigurieren
// Wird in allen Umgebungen (lokal, Dev, Prod) verwendet
console.log('Verbinde mit Datenbank auf:', process.env.DB_HOST);
pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database and create tables if they don't exist
async function initializeDatabase() {
  try {
    await createTables();
    console.log('Database connection established and tables initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// Create all tables according to the schema
async function createTables() {
  const connection = await pool.getConnection();
  
  try {
    // Users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) DEFAULT NULL,
        oauth_provider VARCHAR(20) DEFAULT NULL,
        oauth_id VARCHAR(255) DEFAULT NULL,
        profile_picture VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY (oauth_provider, oauth_id)
      )
    `);
    
    // Apartments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS apartments (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        address TEXT DEFAULT NULL,
        size DECIMAL(8,2) DEFAULT NULL,
        rent DECIMAL(10,2) DEFAULT NULL,
        move_in_date DATE DEFAULT NULL,
        user_id INT(11) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Task table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task (
        id INT(11) NOT NULL AUTO_INCREMENT,
        apartment_id INT(11) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        points INT(11) DEFAULT 0,
        is_recurring TINYINT(1) DEFAULT 0,
        interval_type ENUM('daily','weekly','monthly') DEFAULT NULL,
        interval_value INT(11) DEFAULT 1,
        color VARCHAR(20) DEFAULT '#4a90e2',
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        deleted_by_user_id INT(11) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Task instance table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_instance (
        id INT(11) NOT NULL AUTO_INCREMENT,
        task_id INT(11) NOT NULL,
        apartment_id INT(11) NOT NULL,
        assigned_user_id INT(11) DEFAULT NULL,
        due_date DATE NOT NULL,
        status ENUM('offen','erledigt','übersprungen') DEFAULT 'offen',
        completed_at TIMESTAMP NULL DEFAULT NULL,
        completed_by_user_id INT(11) DEFAULT NULL,
        points_awarded INT(11) DEFAULT 0,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        deleted_by_user_id INT(11) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    
    // Task edit history table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_edit_history (
        id INT(11) NOT NULL AUTO_INCREMENT,
        task_id INT(11) NOT NULL,
        edited_by_user_id INT(11) NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        old_value TEXT DEFAULT NULL,
        new_value TEXT DEFAULT NULL,
        edited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE,
        FOREIGN KEY (edited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Shopping lists table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shopping_lists (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        date DATE DEFAULT NULL,
        apartment_id INT(11) NOT NULL,
        archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
      )
    `);
    
    // Shopping items table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shopping_items (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) DEFAULT 'sonstiges',
        quantity VARCHAR(50) DEFAULT '1',
        checked TINYINT(1) DEFAULT 0,
        list_id INT(11) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
      )
    `);
    
    // User settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INT(11) NOT NULL AUTO_INCREMENT,
        user_id INT(11) DEFAULT NULL,
        theme VARCHAR(20) DEFAULT 'system',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Invite codes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id INT(11) NOT NULL AUTO_INCREMENT,
        apartment_id INT(11) NOT NULL,
        code VARCHAR(10) NOT NULL,
        created_by INT(11) DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        expires_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY code (code),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    
    // User apartments relationship table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_apartments (
        id INT(11) NOT NULL AUTO_INCREMENT,
        user_id INT(11) NOT NULL,
        apartment_id INT(11) NOT NULL,
        is_owner TINYINT(1) DEFAULT 0,
        points INT(11) DEFAULT 0,
        joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_user_apartment (user_id, apartment_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
      )
    `);
    
    // Financial transactions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id INT(11) NOT NULL AUTO_INCREMENT,
        apartment_id INT(11) NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        date DATE NOT NULL,
        payer_id INT(11) NOT NULL,
        created_by INT(11) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Transaction participants table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transaction_participants (
        id INT(11) NOT NULL AUTO_INCREMENT,
        transaction_id INT(11) NOT NULL,
        user_id INT(11) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_transaction_user (transaction_id, user_id),
        FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Messages table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT(11) NOT NULL AUTO_INCREMENT,
        apartment_id INT(11) NOT NULL,
        user_id INT(11) NOT NULL,
        content TEXT NOT NULL,
        edited TINYINT(1) DEFAULT 0,
        encrypted TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_messages_encrypted (encrypted)
      )
    `);
    
    console.log('All tables created or verified successfully');
    
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  initializeDatabase
};