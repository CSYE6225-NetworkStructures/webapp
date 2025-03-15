const { DataTypes } = require('sequelize');
const {sequelize} = require('../config/database');

const FileMetadata = sequelize.define('FileMetadata', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    fileName: { type: DataTypes.STRING, allowNull: false },
    filePath: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    uploadDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
});

module.exports = FileMetadata;
