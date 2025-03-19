const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const FileMetadata = require('../models/fileMetadata');
const { sendResponse } = require('../utils/responseUtils.js');
require('dotenv').config();

const s3 = new S3Client({ region: process.env.AWS_REGION });

const allowedHeaders = [
    'cache-control',
    'postman-token',
    'host',
    'user-agent',
    'accept',
    'accept-encoding',
    'connection',
    'content-type',
    'content-length'
];

const uploadFile = async (req, res) => {
    if (req.method === "HEAD") {
        return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
        (header) => !allowedHeaders.includes(header.toLowerCase())
    );

    if (invalidHeaders.length > 0) {
    return sendResponse(res, 400);
    }

    try {
        // Check if file exists in request
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate file is using the key name "file"
        if (req.file.fieldname !== 'file') {
            return res.status(400).json({ error: 'File must be uploaded with key name "file"' });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ 
                error: 'Only image files of type jpg, jpeg, png, or gif are allowed' 
            });
        }

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

    if (req.method === "HEAD") {
        return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
      (header) => !allowedHeaders.includes(header.toLowerCase())
    );

    if (Object.keys(req.body).length > 0 || req.headers['content-type'] ||
    (req.files && req.files.length > 0) || Object.keys(req.query).length > 0
    || invalidHeaders.length > 0) {
    return sendResponse(res, 400);
    }

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
    
    if (req.method === "HEAD") {
        return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
      (header) => !allowedHeaders.includes(header.toLowerCase())
    );

    if (Object.keys(req.body).length > 0 || req.headers['content-type'] ||
    (req.files && req.files.length > 0) || Object.keys(req.query).length > 0
    || invalidHeaders.length > 0) {
    return sendResponse(res, 400);
    }
    
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