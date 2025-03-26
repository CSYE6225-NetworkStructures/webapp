const express = require('express');
const { createDatabase } = require('./config/database');
const { connectDB } = require('./models');
const healthCheckRoutes = require('./routes/healthCheck');
const fileRoutes = require('./routes/file');
const appLogger = require('./utils/logger');
const { requestMetricsMiddleware, countMetric, startTimer, endTimer } = require('./utils/metrics');
const { v4: generateUniqueId } = require('uuid');

require('dotenv').config();

// Initialize Express application
const app = express();
app.disable('x-powered-by');

// Add request ID to each request
app.use((req, res, next) => {
  req.requestId = generateUniqueId();
  next();
});

// Log all incoming requests
app.use((req, res, next) => {
  appLogger.info('Request received', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Track response status and completion
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  
  const finalizeRequest = () => {
    appLogger.info('Response sent', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode
    });
  };
  
  res.send = function(...args) {
    finalizeRequest();
    return originalSend.apply(this, args);
  };
  
  res.json = function(...args) {
    finalizeRequest();
    return originalJson.apply(this, args);
  };
  
  res.end = function(...args) {
    finalizeRequest();
    return originalEnd.apply(this, args);
  };
  
  next();
});

// Add metrics middleware
app.use(requestMetricsMiddleware);

// Standard middleware
app.use(express.urlencoded({ extended: true }));

// Add routes
app.use(healthCheckRoutes);
app.use('/v1', fileRoutes);

// Middleware to handle unimplemented routes
app.use((req, res) => {
  appLogger.warn('Route not found', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl
  });
  
  countMetric('api.not_found.count');
  res.status(404).send();
});

// Global error handler
app.use((err, req, res, next) => {
  appLogger.error('Unhandled server error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: err.stack
  });
  
  countMetric('api.server_error.count');
  res.status(500).send();
});

const startServer = async () => {
  const serverStartTimer = startTimer('server.startup.time');
  
  try {
    appLogger.info('Starting server...');
    
    // Create and connect to database
    appLogger.info('Creating database if needed...');
    const dbCreateTimer = startTimer('db.create.time');
    await createDatabase();
    endTimer(dbCreateTimer);
    appLogger.info('Database created or verified successfully');
    
    appLogger.info('Connecting to database...');
    const dbConnectTimer = startTimer('db.connect.time');
    await connectDB();
    endTimer(dbConnectTimer);
    appLogger.info('Database connection established successfully');

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      const startupTime = endTimer(serverStartTimer);
      appLogger.info(`Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION,
        startupTime
      });
      
      countMetric('server.startup.count');
    });

    // Handle graceful shutdown
    const gracefulShutdown = async (signal) => {
      const shutdownTimer = startTimer('server.shutdown.time');
      appLogger.info(`${signal} received. Shutting down gracefully...`);
      
      server.close(() => {
        const shutdownTime = endTimer(shutdownTimer);
        appLogger.info('Server closed successfully', { shutdownTime });
        process.exit(0);
      });
      
      // Force close after timeout
      setTimeout(() => {
        appLogger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Track uncaught exceptions
    process.on('uncaughtException', (err) => {
      appLogger.error('Uncaught exception', {
        error: err.message,
        stack: err.stack
      });
      
      countMetric('server.uncaught_exception.count');
    });
    
    // Track unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      appLogger.error('Unhandled promise rejection', {
        reason: reason.toString(),
        stack: reason.stack
      });
      
      countMetric('server.unhandled_rejection.count');
    });

    return server; // Return the server instance for Jest to use
  } catch (error) {
    appLogger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    
    endTimer(serverStartTimer);
    countMetric('server.startup_failure.count');
    process.exit(1);
  }
};

// Only start the server if this file is executed directly (not imported for testing)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };