const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
const appLogger = require('../utils/logger');
const { startTimer, endTimer, measureDbOperation } = require('../utils/metrics');
require('dotenv').config();

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

/**
 * Function to create database if it doesn't exist already
 */
const createDatabase = async () => {
  const dbCreateTimer = startTimer('db.create_database.time');
  
  appLogger.info('Attempting to create database if it does not exist', {
    database: DB_NAME,
    host: DB_HOST,
    port: DB_PORT
  });
  
  try {
    // Start connection timer
    const connectionTimer = startTimer('db.connection.time');
    
    // Create connection to MySQL server
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
    });
    
    const connectionTime = endTimer(connectionTimer);
    appLogger.info('Connected to MySQL server successfully', { connectionTime });

    // Execute database creation query
    const queryTimer = startTimer('db.create_database_query.time');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    const queryTime = endTimer(queryTimer);
    
    appLogger.info(`Database "${DB_NAME}" ensured to exist`, { queryTime });
    
    // Close connection
    await connection.end();
    
    const totalTime = endTimer(dbCreateTimer);
    appLogger.info('Database creation process completed', { totalTime });
  } catch (error) {
    const errorTime = endTimer(dbCreateTimer);
    
    appLogger.error('Failed to create database', {
      database: DB_NAME,
      error: error.message,
      stack: error.stack,
      duration: errorTime
    });
    
    throw error;
  }
};

/**
 * Sequelize query logger that sends logs to our application logger
 * @param {string} sql The SQL query being executed
 */
const queryLogger = (sql) => {
  appLogger.debug('Executing SQL query', {
    sql: sql.trim()
  });
};

// Initialize Sequelize with our configuration
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? queryLogger : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  // Customize Sequelize hooks to collect metrics
  hooks: {
    beforeQuery: (options) => {
      // Store start time in the options object for later retrieval
      options._startTime = process.hrtime();
    },
    afterQuery: (options) => {
      if (options._startTime) {
        const diff = process.hrtime(options._startTime);
        // Convert to milliseconds
        const duration = (diff[0] * 1e3) + (diff[1] / 1e6);
        
        // Extract query type (SELECT, INSERT, etc.)
        const queryType = options.type || 'UNKNOWN';
        
        // Record query timing
        endTimer(startTimer(`db.query.${queryType.toLowerCase()}`));
        
        appLogger.debug('SQL query completed', {
          type: queryType,
          duration
        });
      }
    }
  }
});

/**
 * Test database connection
 */
const testConnection = async () => {
  const connectionTimer = startTimer('db.test_connection.time');
  
  try {
    appLogger.info('Testing database connection...');
    await sequelize.authenticate();
    const connectionTime = endTimer(connectionTimer);
    
    appLogger.info('Database connection has been established successfully', {
      database: DB_NAME,
      connectionTime
    });
    
    return true;
  } catch (error) {
    const errorTime = endTimer(connectionTimer);
    
    appLogger.error('Unable to connect to the database', {
      database: DB_NAME,
      error: error.message,
      stack: error.stack,
      duration: errorTime
    });
    
    return false;
  }
};

module.exports = { 
  sequelize, 
  createDatabase,
  testConnection
};