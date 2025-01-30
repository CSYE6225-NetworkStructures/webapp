const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HealthCheck = sequelize.define('HealthCheck', {
  checkId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  datetime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
  tableName: 'health_check',
});

module.exports = HealthCheck;
