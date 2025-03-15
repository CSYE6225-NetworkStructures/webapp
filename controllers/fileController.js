const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const FileMetadata = require('../models/fileMetadata');
const { sendResponse } = require('../utils/responseUtils.js');
require('dotenv').config();

const s3 = new S3Client({ region: process.env.AWS_REGION });

const uploadFile = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const fileKey = `${uuidv4()}${path.extname(file.originalname)}`;
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        };
        await s3.send(new PutObjectCommand(uploadParams));

        const fileMetadata = await FileMetadata.create({
            fileName: file.originalname,
            filePath: `${process.env.S3_BUCKET_NAME}/${fileKey}`,
            mimeType: file.mimetype,
            size: file.size
        });

        res.status(201).json({
            id: fileMetadata.id,
            file_name: fileMetadata.fileName,
            url: fileMetadata.filePath,
            upload_date: fileMetadata.uploadDate
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getFile = async (req, res) => {
    try {
        const fileMetadata = await FileMetadata.findByPk(req.params.id);
        if (!fileMetadata) return res.status(404).json({ error: 'File not found' });

        res.json({
            id: fileMetadata.id,
            file_name: fileMetadata.fileName,
            url: fileMetadata.filePath,
            upload_date: fileMetadata.uploadDate
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteFile = async (req, res) => {
    try {
        const fileMetadata = await FileMetadata.findByPk(req.params.id);
        if (!fileMetadata) return res.status(404).json({ error: 'File not found' });

        const fileKey = fileMetadata.filePath.split('/').pop();
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: fileKey }));

        await fileMetadata.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const methodNotAllowed = (req, res) => {
    return sendResponse(res, 405);
};

module.exports = { uploadFile, getFile, deleteFile, methodNotAllowed };