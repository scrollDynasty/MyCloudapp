require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'vps_billing',
  connectionLimit: 10,
  charset: 'utf8mb4',
  // MariaDB compatible options
  ssl: false,
  bigNumberStrings: true,
  supportBigNumbers: true,
  dateStrings: true,
  multipleStatements: true
};

module.exports = dbConfig;