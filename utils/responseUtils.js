const sendResponse = (res, statusCode, message = '') => {
  res.status(statusCode)
    .set('Cache-Control', 'no-cache, no-store, must-revalidate')
    .set('Pragma', 'no-cache')
    .set("X-Content-Type-Options","nosniff")
    .set('Connection', 'close')
    .end();
};

module.exports = { sendResponse };
