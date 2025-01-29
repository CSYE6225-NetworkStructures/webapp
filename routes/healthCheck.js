const express = require('express');
const { performHealthCheck, methodNotAllowed } = require('../controllers/healthCheckController');

const router = express.Router();

router.route('/healthz')
  .get(performHealthCheck)
  .all(methodNotAllowed);

module.exports = router;
