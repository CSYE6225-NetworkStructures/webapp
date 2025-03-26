const DogStatsD = require('hot-shots');
let metricsClient = null;

// Sanitize metric name by replacing invalid characters
function sanitizeMetricName(metricName) {
    return (metricName || 'unknown').replace(/[^a-zA-Z0-9_\.]/g, '_');
}

// Boot up the metrics service if enabled
try {
    // Only set up metrics if explicitly enabled
    if (process.env.ENABLE_METRICS === 'true') {
        // Configure connection parameters
        const configuration = {
            port: parseInt(process.env.STATSD_PORT || '8125', 10),
            host: process.env.STATSD_HOST || 'localhost',
            mock: false,
            prefix: 'webapp.',
            globalTags: {
                app: 'csye6225-webapp',
                env: process.env.NODE_ENV || 'development'
            },
            errorHandler: (err) => {
                console.error('StatsD client error:', err);
            }
        };
        
        // Initialize the metrics client
        metricsClient = new DogStatsD(configuration);
        
        console.log('StatsD metrics collection initialized');
        
        // Send a test metric after a short delay
        setTimeout(() => {
            try {
                metricsClient.increment('app.startup');
                console.log('StatsD client test metric sent successfully');
            } catch (err) {
                console.error('StatsD client test metric failed:', err);
            }
        }, 1000);
    } else {
        console.log('StatsD metrics collection disabled');
    }
} catch (err) {
    console.error('Failed to initialize StatsD client:', err);
    metricsClient = null;
}

/**
 * Record a timing measurement
 * @param {string} metricName - The name of the timer metric
 * @param {number} timeValue - The timing value in milliseconds
 */
function recordTiming(metricName, timeValue) {
    if (!metricsClient) return;
    
    try {
        // Prepare safe inputs
        const safeName = sanitizeMetricName(metricName);
        const safeValue = typeof timeValue === 'number' && timeValue >= 0 ? timeValue : 0;
        
        metricsClient.timing(safeName, safeValue);
    } catch (err) {
        console.error(`Failed to record timing for ${metricName}:`, err);
    }
}

/**
 * Increase a counter metric
 * @param {string} metricName - The name of the metric to increment
 * @param {number} incrementBy - The value to increment by (default: 1)
 * @param {number} sampleRate - The sample rate (default: 1)
 */
function countMetric(metricName, incrementBy = 1, sampleRate = 1) {
    if (!metricsClient) return;
    
    try {
        // Prepare safe inputs
        const safeName = sanitizeMetricName(metricName);
        const safeValue = typeof incrementBy === 'number' ? incrementBy : 1;
        const safeSampleRate = 
            typeof sampleRate === 'number' && 
            sampleRate > 0 && 
            sampleRate <= 1 ? 
                sampleRate : 1;
        
        metricsClient.increment(safeName, safeValue, safeSampleRate);
    } catch (err) {
        console.error(`Failed to increment counter ${metricName}:`, err);
    }
}

/**
 * Create a new timer object that records duration when stopped
 * @param {string} metricName - The name of the timer metric
 * @returns {Object} - Timer object with stop method
 */
function startTimer(metricName) {
    // Create a safe metric name
    const safeName = sanitizeMetricName(metricName);
    
    // If metrics are disabled, return a dummy timer
    if (!metricsClient) {
        return {
            name: safeName,
            stop: () => 0
        };
    }
    
    // Start measuring time
    const startTime = process.hrtime();
    
    return {
        name: safeName,
        stop: () => {
            try {
                const elapsed = process.hrtime(startTime);
                // Convert to milliseconds
                const duration = (elapsed[0] * 1e3) + (elapsed[1] / 1e6);
                metricsClient.timing(safeName, duration);
                return duration;
            } catch (err) {
                console.error(`Failed to stop timer for ${safeName}:`, err);
                return 0;
            }
        }
    };
}

/**
 * Safely stop a timer with defensive checks
 * @param {Object} timer - The timer object to stop
 * @returns {number} - The duration in milliseconds or 0 if invalid
 */
function endTimer(timer) {
    try {
        if (timer && typeof timer.stop === 'function') {
            return timer.stop();
        }
    } catch (err) {
        const timerName = timer?.name ? ` for ${timer.name}` : '';
        console.error(`Error stopping timer${timerName}:`, err);
    }
    return 0;
}

/**
 * Express middleware for tracking API metrics
 */
function requestMetricsMiddleware(req, res, next) {
    // Skip if metrics are disabled
    if (!metricsClient) {
        return next();
    }
    
    try {
        // Helper function to get the route pattern
        const getRoutePattern = () => {
            if (req.route) {
                return req.route.path;
            }
            return req.path || 'unknown_route';
        };
        
        // Format route for metric names
        const formatRouteName = (route) => {
            return route
                .replace(/\//g, '.')
                .replace(/:/g, '')
                .replace(/^\.+|\.+$/g, '')
                .replace(/\./g, '_');
        };
        
        // Get initial route info
        let routePath = getRoutePattern();
        const httpMethod = req.method.toLowerCase();
        let metricPrefix = `api.${httpMethod}.${formatRouteName(routePath)}`;
        
        // Count this request
        countMetric(`${metricPrefix}.count`);
        
        // Start timing the request
        const requestTimer = startTimer(`${metricPrefix}.time`);
        
        // Store original response end method
        const originalEndFn = res.end;
        
        // Override end to capture metrics when response completes
        res.end = function(...args) {
            try {
                // Route might be resolved by now
                if (routePath === 'unknown_route' && req.route) {
                    routePath = getRoutePattern();
                    metricPrefix = `api.${httpMethod}.${formatRouteName(routePath)}`;
                }
                
                // Record request duration
                endTimer(requestTimer);
                
                // Track response status code
                countMetric(`${metricPrefix}.status.${res.statusCode}`);
            } catch (err) {
                console.error('Error in metrics middleware:', err);
            }
            
            // Always call original function
            return originalEndFn.apply(this, args);
        };
    } catch (err) {
        console.error('Error in metrics middleware setup:', err);
    }
    
    // Continue to next middleware
    next();
}

/**
 * Track database operation timing
 * @param {string} queryType - The type of database operation
 * @param {string} tableName - The database table or collection
 * @param {Function} dbOperation - The database operation function
 * @returns {Promise} - Result of the database operation
 */
async function measureDbOperation(queryType, tableName, dbOperation) {
    // Create safe metric names
    const safeQueryType = sanitizeMetricName(queryType);
    const safeTableName = sanitizeMetricName(tableName);
    
    // Start the timer
    const dbTimer = startTimer(`db.${safeTableName}.${safeQueryType}`);
    
    try {
        // Execute the database operation
        const result = await dbOperation();
        
        // Record the timing
        endTimer(dbTimer);
        
        return result;
    } catch (err) {
        // Record timing even on error
        endTimer(dbTimer);
        
        // Count database errors
        countMetric(`db.${safeTableName}.${safeQueryType}.error`);
        
        // Re-throw for proper error handling
        throw err;
    }
}

/**
 * Track S3 operation timing
 * @param {string} operationType - The S3 operation name
 * @param {Function} s3Operation - The S3 operation function
 * @returns {Promise} - Result of the S3 operation
 */
async function measureS3Operation(operationType, s3Operation) {
    // Create safe metric name
    const safeOperationType = sanitizeMetricName(operationType);
    
    // Start the timer
    const s3Timer = startTimer(`s3.${safeOperationType}`);
    
    try {
        // Execute the S3 operation
        const result = await s3Operation();
        
        // Record the timing
        endTimer(s3Timer);
        
        return result;
    } catch (err) {
        // Record timing even on error
        endTimer(s3Timer);
        
        // Count S3 errors
        countMetric(`s3.${safeOperationType}.error`);
        
        // Re-throw for proper error handling
        throw err;
    }
}

// Export the metrics utilities
module.exports = {
    countMetric,
    recordTiming,
    startTimer,
    endTimer,
    requestMetricsMiddleware,
    measureDbOperation,
    measureS3Operation
};