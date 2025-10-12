require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'vps_billing',
  // Connection pool configuration for better resource management
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 50, // Prevent unlimited queue
  waitForConnections: true,
  // Timeout configurations to prevent hanging connections
  connectTimeout: 10000, // 10 seconds
  acquireTimeout: 10000, // 10 seconds to acquire connection from pool
  timeout: 60000, // 60 seconds query timeout
  // Idle connection management
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
  // Character set
  charset: 'utf8mb4',
  // MariaDB compatible options
  ssl: false,
  bigNumberStrings: true,
  supportBigNumbers: true,
  dateStrings: true,
  multipleStatements: false // Security: disable by default
};

module.exports = dbConfig;