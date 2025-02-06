const express = require('express');
const { createDatabase } = require('./config/database');
const { connectDB } = require('./models');
const healthCheckRoutes = require('./routes/healthCheck');

require('dotenv').config();

const app = express();
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: true }));
app.use(healthCheckRoutes);

// Middleware to handle unimplemented routes
app.use((req, res) => {
  res.status(404).send();
});

const startServer = async () => {
  try {
    await createDatabase();
    await connectDB();

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    return server; // Return the server instance for Jest to use
  } catch (error) {
    console.error('Error starting the server:', error);
    process.exit(1);
  }
};

// Only start the server if this file is executed directly (not imported for testing)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
