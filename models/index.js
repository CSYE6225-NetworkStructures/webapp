const { sequelize } = require('../config/database');
const HealthCheck = require('./healthCheck');

// Connect DB and create tables if not existing.
const connectDB = async () => {
  try {
    await sequelize.sync(); 
    console.log('Database connected and models synchronized successfully');
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error;
  }
};

module.exports = { connectDB, HealthCheck };
