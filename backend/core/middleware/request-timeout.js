/**
 * Request Timeout Middleware
 * Prevents long-running requests from consuming resources indefinitely
 */

const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    // Set timeout for the request
    req.setTimeout(timeoutMs, () => {
      // Request has timed out
      console.error(`⏱️  Request timeout: ${req.method} ${req.originalUrl}`);
      
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: 'The request took too long to process'
        });
      }
    });

    // Set timeout for the response
    res.setTimeout(timeoutMs, () => {
      console.error(`⏱️  Response timeout: ${req.method} ${req.originalUrl}`);
      
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'Gateway timeout',
          message: 'The server took too long to respond'
        });
      }
    });

    next();
  };
};

module.exports = requestTimeout;
