const { v4: generateUniqueId } = require('uuid');
const winstonModule = require('winston');
const { transports, format, createLogger } = winstonModule;
const CloudwatchTransport = require('winston-cloudwatch');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Generate a unique identifier for this instance
const serverInstanceId = process.env.INSTANCE_ID || generateUniqueId().substring(0, 8);

// Configure logging directory - strictly from .env file
const logDirectory = process.env.LOG_DIRECTORY;
console.log("HERE::::::");
console.log(process.env.LOG_DIRECTORY);

// Create log directory if it's defined and doesn't exist
if (logDirectory) {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
} else {
  console.warn('LOG_DIRECTORY not defined in .env file. File logging will be disabled.');
}

// Configure log file paths - only if directory is defined
let logFilePath;
let errorLogFilePath;

if (logDirectory) {
  logFilePath = path.join(logDirectory, 'application.log');
  errorLogFilePath = path.join(logDirectory, 'error.log');
}

// Configure formatting options
const logFormatting = format.combine(
    format.timestamp(),
    format.json()
);

// Console format (can be more human-readable if desired)
const consoleFormatting = format.combine(
    format.timestamp(),
    format.json()
);

// Default metadata for all log entries
const globalMetadata = {
    environment: process.env.NODE_ENV || 'development',
    service: 'webapp',
    instanceId: serverInstanceId
};

// Setup initial transports array with console
const loggerTransports = [
    new transports.Console({
        format: consoleFormatting
    })
];

// Add file transports if file logging is enabled and directory is defined
if (process.env.ENABLE_FILE_LOGGING !== 'false' && logDirectory) {
    // Add combined log file (all levels)
    loggerTransports.push(
        new transports.File({
            filename: logFilePath,
            format: logFormatting,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,               // Keep 5 log files
            tailable: true
        })
    );
    
    // Add error-only log file
    loggerTransports.push(
        new transports.File({
            filename: errorLogFilePath,
            level: 'error',
            format: logFormatting,
            maxsize: 5 * 1024 * 1024,  // 5MB
            maxFiles: 5,               // Keep 5 error log files
            tailable: true
        })
    );
}

// Initialize the application logger
const appLogger = createLogger({
    format: logFormatting,
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: globalMetadata,
    transports: loggerTransports
});

// Production environment configuration
const isLocalEnvironment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

// Add CloudWatch integration for non-local environments
if (!isLocalEnvironment) {
    // Create a date string for the log stream name
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Configure CloudWatch transport
    const cloudwatchConfig = {
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        logGroupName: process.env.CLOUDWATCH_GROUP_NAME || 'webapp-logs',
        logStreamName: `${serverInstanceId}-${currentDate}`,
        messageFormatter: (logData) => {
            const { level, message, ...additionalInfo } = logData;
            return JSON.stringify({
                level,
                message,
                ...additionalInfo
            });
        }
    };
    
    // Add CloudWatch transport to the logger
    appLogger.add(new CloudwatchTransport(cloudwatchConfig));
}

// Log logger initialization
appLogger.info('Logger initialized', {
    logDirectory: logDirectory || 'not configured',
    fileLoggingEnabled: (process.env.ENABLE_FILE_LOGGING !== 'false' && logDirectory !== undefined),
    cloudWatchEnabled: !isLocalEnvironment
});

module.exports = appLogger;