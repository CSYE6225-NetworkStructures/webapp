const express = require('express');
const { createDatabase, sequelize } = require('./config/database');
const { connectDB } = require('./models');
const healthCheckRoutes = require('./routes/healthCheck');

require('dotenv').config();

const app = express();
app.disable('x-powered-by');

// app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(healthCheckRoutes)

// Middleware to handle unimplemented routes
app.use((req, res) => {
  res.status(404).send();
});

const startServer = async () => {
  try {
    // Validate database and tables are created.
    await createDatabase();
    await connectDB();

    const PORT = process.env.PORT;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting the server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
