require('dotenv').config();

// Configuration for connecting without specifying database (for database creation)
const dbConfigWithoutDB = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  charset: 'utf8mb4',
  ssl: false,
  bigNumberStrings: true,
  supportBigNumbers: true,
  dateStrings: true,
  multipleStatements: true
};

// Configuration with database specified
const dbConfig = {
  ...dbConfigWithoutDB,
  database: process.env.DB_NAME || 'vps_billing'
};

module.exports = {
  dbConfig,
  dbConfigWithoutDB,
  databaseName: process.env.DB_NAME || 'vps_billing'
};