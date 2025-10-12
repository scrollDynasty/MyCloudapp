const mysql = require('mysql2');
const dbConfig = require('../config/database');

class Database {
  constructor() {
    this.pool = null;
    this.poolPromise = null;
    this.connected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
    this.isInitializing = false;
  }

  async connect() {
    // Return existing pool if already connected
    if (this.connected && this.poolPromise) {
      return this.poolPromise;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.isInitializing) {
      // Wait for existing connection attempt to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.poolPromise;
    }

    this.isInitializing = true;

    try {
      // Create connection pool only once
      if (!this.pool) {
        this.pool = mysql.createPool(dbConfig);

        // Get promise-based pool
        this.poolPromise = this.pool.promise();

        // Set up pool event handlers for monitoring
        this.setupPoolMonitoring();
      }

      // Test connection
      await this.testConnection();
      
      this.connected = true;
      this.connectionAttempts = 0;
      console.log('✅ MariaDB connected successfully');
      console.log(`📍 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
      console.log(`📊 Pool config: ${dbConfig.connectionLimit} connections, ${dbConfig.queueLimit} queue limit`);
      
      return this.poolPromise;
    } catch (error) {
      this.connectionAttempts++;
      console.error(`❌ MariaDB connection failed (attempt ${this.connectionAttempts}/${this.maxRetries}):`, error.message);
      
      if (this.connectionAttempts >= this.maxRetries) {
        throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
      }
      
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  setupPoolMonitoring() {
    // Monitor pool for connection events
    this.pool.on('acquire', (connection) => {
      // Connection acquired from pool - can add metrics here
    });

    this.pool.on('connection', (connection) => {
      // New connection created
      console.log('🔗 New database connection established');
    });

    this.pool.on('enqueue', () => {
      // Waiting for available connection - may indicate need for more connections
      console.warn('⏳ Query queued - waiting for available connection');
    });

    this.pool.on('release', (connection) => {
      // Connection released back to pool
    });
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
      try {
        // Gracefully close all connections in pool
        await this.pool.end();
        this.connected = false;
        this.pool = null;
        this.poolPromise = null;
        console.log('🔐 Database connection pool closed gracefully');
      } catch (error) {
        console.error('Error closing database pool:', error);
        throw error;
      }
    }
  }

  // Get pool statistics for monitoring
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      connected: this.connected,
      totalConnections: this.pool._allConnections?.length || 0,
      freeConnections: this.pool._freeConnections?.length || 0,
      queuedRequests: this.pool._connectionQueue?.length || 0,
      config: {
        connectionLimit: dbConfig.connectionLimit,
        queueLimit: dbConfig.queueLimit
      }
    };
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