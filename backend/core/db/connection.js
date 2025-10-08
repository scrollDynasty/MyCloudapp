const mysql = require('mysql2');
const dbConfig = require('../config/database');

class Database {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  async connect() {
    try {
      // Create connection pool
      this.pool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        queueLimit: 0
      });

      // Get promise-based pool
      this.poolPromise = this.pool.promise();

      // Test connection
      await this.testConnection();
      
      this.connected = true;
      console.log('✅ MariaDB connected successfully');
      console.log(`📍 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
      
      return this.poolPromise;
    } catch (error) {
      console.error('❌ MariaDB connection failed:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const [rows] = await this.poolPromise.execute('SELECT 1 as test');
      return rows[0].test === 1;
    } catch (error) {
      throw new Error(`Database connection test failed: ${error.message}`);
    }
  }

  async query(sql, params = []) {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      const [rows, fields] = await this.poolPromise.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error.message);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  }

  async queryWithFields(sql, params = []) {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      const [rows, fields] = await this.poolPromise.execute(sql, params);
      return { rows, fields };
    } catch (error) {
      console.error('Database query error:', error.message);
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.poolPromise.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('🔐 Database connection closed');
    }
  }

  // Utility methods
  escape(value) {
    return mysql.escape(value);
  }

  escapeId(value) {
    return mysql.escapeId(value);
  }

  format(sql, values) {
    return mysql.format(sql, values);
  }
}

// Create singleton instance
const db = new Database();

module.exports = db;