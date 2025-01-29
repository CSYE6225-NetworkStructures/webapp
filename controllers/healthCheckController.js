const { HealthCheck } = require('../models');
const { sendResponse } = require('../utils/responseUtils.js');

const allowedHeaders = [
  'cache-control',
  'postman-token',
  'host',
  'user-agent',
  'accept',
  'accept-encoding',
  'connection',
];

const performHealthCheck = async (req, res) => {
  try {
    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
      (header) => !allowedHeaders.includes(header.toLowerCase())
    );

    // Conditions to check if the API contains apporpriate headers, no body
    if (Object.keys(req.body).length > 0 || req.headers['content-type'] ||
        (req.files && req.files.length > 0) || Object.keys(req.query).length > 0
      || invalidHeaders.length > 0) {
      return sendResponse(res, 400);
    }

    await HealthCheck.create({});
    return sendResponse(res, 200);
  } catch (error) {
    // For any server issues send 503
    console.error('Health check failed:', error);
    return sendResponse(res, 503);
  }
};

const methodNotAllowed = (req, res) => {
  return sendResponse(res, 405);
};

module.exports = { performHealthCheck, methodNotAllowed };
