const { HealthCheck } = require('../models');
const { sendResponse } = require('../utils/responseUtils.js');
const appLogger = require('../utils/logger');
const { countMetric, startTimer, endTimer, measureDbOperation } = require('../utils/metrics');
const { v4: generateUniqueId } = require('uuid');

const permittedHeaders = [
  'cache-control',
  'postman-token',
  'host',
  'user-agent',
  'accept',
  'accept-encoding',
  'connection',
];

const performHealthCheck = async (req, res) => {
  const requestId = req.requestId || generateUniqueId();
  const apiTimer = startTimer('api.get.healthcheck');
  
  appLogger.info('Health check request received', {
    requestId,
    method: req.method,
    path: req.originalUrl
  });
  
  try {
    if (req.method === "HEAD") {
      appLogger.warn('HEAD method not allowed for health check endpoint', { 
        requestId 
      });
      endTimer(apiTimer);
      return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
      (header) => !permittedHeaders.includes(header.toLowerCase())
    );

    // Conditions to check if the API contains appropriate headers, no body
    if (Object.keys(req.body).length > 0 || req.headers['content-type'] ||
        (req.files && req.files.length > 0) || Object.keys(req.query).length > 0
        || invalidHeaders.length > 0) {
      
      appLogger.warn('Invalid request parameters for health check', { 
        requestId,
        hasBody: Object.keys(req.body).length > 0,
        hasContentType: !!req.headers['content-type'],
        hasFiles: !!(req.files && req.files.length > 0),
        hasQueryParams: Object.keys(req.query).length > 0,
        invalidHeaders
      });
      
      endTimer(apiTimer);
      return sendResponse(res, 400);
    }

    appLogger.info('Performing health check database operation', { requestId });
    
    await measureDbOperation('create', 'HealthCheck', async () => {
      return HealthCheck.create({});
    });
    
    const duration = endTimer(apiTimer);
    
    appLogger.info('Health check completed successfully', { 
      requestId,
      duration
    });
    
    return sendResponse(res, 200);
  } catch (error) {
    // For any server issues send 503
    appLogger.error('Health check failed', { 
      requestId,
      error: error.message,
      stack: error.stack
    });
    
    endTimer(apiTimer);
    return sendResponse(res, 503);
  }
};

const methodNotAllowed = (req, res) => {
  const requestId = req.requestId || generateUniqueId();
  
  appLogger.warn('Method not allowed for health check endpoint', { 
    requestId,
    method: req.method,
    path: req.originalUrl
  });
  
  countMetric('api.healthcheck.method_not_allowed.count');
  return sendResponse(res, 405);
};

module.exports = { performHealthCheck, methodNotAllowed };