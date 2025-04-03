const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: generateUniqueId } = require('uuid');
const path = require('path');
const FileMetadata = require('../models/fileMetadata');
const { sendResponse } = require('../utils/responseUtils.js');
const appLogger = require('../utils/logger');
const { countMetric, startTimer, endTimer, measureDbOperation, measureS3Operation } = require('../utils/metrics');
require('dotenv').config();

const s3Client = new S3Client({ region: process.env.AWS_REGION });

const permittedHeaders = [
    'cache-control',
    'postman-token',
    'host',
    'user-agent',
    'accept',
    'accept-encoding',
    'connection',
    //Load Balancer headers
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-port',
    'x-amzn-trace-id',
    'x-forwarded-host',
    'x-amz-cf-id',
    'x-amzn-requestid'
];

const permittedUploadHeaders = [
    'content-type',
    'content-length'
];

const uploadFile = async (req, res) => {
    const requestId = req.requestId || generateUniqueId();
    const apiTimer = startTimer('api.post.files');
    
    appLogger.info('File upload request received', {
        requestId,
        contentType: req.headers['content-type'],
        method: req.method
    });
    
    if (req.method === "HEAD") {
        appLogger.warn('HEAD method not allowed for file upload', { requestId });
        endTimer(apiTimer);
        return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
        (header) => !permittedHeaders.includes(header.toLowerCase()) && 
        !permittedUploadHeaders.includes(header.toLowerCase())
    );

    if (invalidHeaders.length > 0) {
        appLogger.warn('Invalid headers in file upload request', { 
            requestId,
            invalidHeaders
        });
        endTimer(apiTimer);
        return sendResponse(res, 400);
    }

    // Variables to track S3 upload state
    let fileUploaded = false;
    let fileKey = null;

    try {
        // Check if file exists in request
        const file = req.file;
        if (!file) {
            appLogger.warn('No file provided in upload request', { requestId });
            endTimer(apiTimer);
            return res.status(400).end();
        }

        // Validate file is using the key name "file"
        if (req.file.fieldname !== 'file') {
            appLogger.warn('Invalid file field name in upload request', { 
                requestId,
                fieldname: req.file.fieldname
            });
            endTimer(apiTimer);
            return res.status(400).end();
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            appLogger.warn('Invalid file type in upload request', { 
                requestId,
                fileType: file.mimetype,
                allowedTypes
            });
            endTimer(apiTimer);
            return res.status(400).end();
        }

        // Generate unique file key
        fileKey = `${generateUniqueId()}${path.extname(file.originalname)}`;
        
        appLogger.info('Uploading file to S3', { 
            requestId,
            fileKey,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype
        });
        
        // Upload to S3 with metrics tracking
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        };
        
        await measureS3Operation('putObject', async () => {
            return s3Client.send(new PutObjectCommand(uploadParams));
        });
        
        fileUploaded = true;
        
        appLogger.info('File successfully uploaded to S3', { 
            requestId,
            fileKey
        });

        // Create database entry with metrics tracking
        const fileMetadata = await measureDbOperation('create', 'FileMetadata', async () => {
            return FileMetadata.create({
                fileName: file.originalname,
                filePath: `${process.env.S3_BUCKET_NAME}/${fileKey}`,
                mimeType: file.mimetype,
                size: file.size
            });
        });
        
        appLogger.info('File metadata created in database', { 
            requestId,
            fileId: fileMetadata.id
        });

        const duration = endTimer(apiTimer);
        appLogger.info('File upload request completed successfully', {
            requestId,
            duration,
            fileId: fileMetadata.id
        });

        return res.status(201).json({
            id: fileMetadata.id,
            file_name: fileMetadata.fileName,
            url: fileMetadata.filePath,
            upload_date: fileMetadata.uploadDate
        });
    } catch (err) {
        appLogger.error('File upload failed', { 
            requestId,
            fileKey,
            error: err.message,
            stack: err.stack
        });
        
        // If the file was uploaded to S3 but DB entry failed, clean up the S3 object
        if (fileUploaded && fileKey) {
            try {
                appLogger.info('Attempting to clean up S3 file after failure', { 
                    requestId,
                    fileKey
                });
                
                const deleteParams = {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: fileKey
                };
                
                await measureS3Operation('deleteObject', async () => {
                    return s3Client.send(new DeleteObjectCommand(deleteParams));
                });
                
                appLogger.info('Successfully cleaned up S3 file after failure', { 
                    requestId,
                    fileKey
                });
            } catch (deleteErr) {
                appLogger.error('Failed to clean up S3 file after failure', { 
                    requestId,
                    fileKey,
                    error: deleteErr.message,
                    stack: deleteErr.stack
                });
                // Continue with the original error response even if cleanup fails
            }
        }
        
        endTimer(apiTimer);
        return res.status(503).end();
    }
};

const getFile = async (req, res) => {
    const requestId = req.requestId || generateUniqueId();
    const apiTimer = startTimer('api.get.files');
    
    appLogger.info('File retrieval request received', {
        requestId,
        fileId: req.params.id,
        method: req.method
    });

    if (req.method === "HEAD") {
        appLogger.warn('HEAD method not allowed for file retrieval', { 
            requestId,
            fileId: req.params.id
        });
        endTimer(apiTimer);
        return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
      (header) => !permittedHeaders.includes(header.toLowerCase())
    );

    if (Object.keys(req.body).length > 0 || req.headers['content-type'] ||
    (req.files && req.files.length > 0) || Object.keys(req.query).length > 0
    || invalidHeaders.length > 0) {
        appLogger.warn('Invalid request parameters for file retrieval', { 
            requestId,
            fileId: req.params.id,
            hasBody: Object.keys(req.body).length > 0,
            hasContentType: !!req.headers['content-type'],
            hasFiles: !!(req.files && req.files.length > 0),
            hasQueryParams: Object.keys(req.query).length > 0,
            invalidHeaders
        });
        endTimer(apiTimer);
        return sendResponse(res, 400);
    }

    try {
        appLogger.info('Retrieving file metadata from database', { 
            requestId,
            fileId: req.params.id
        });
        
        const fileMetadata = await measureDbOperation('findByPk', 'FileMetadata', async () => {
            return FileMetadata.findByPk(req.params.id);
        });
        
        if (!fileMetadata) {
            appLogger.warn('File not found', { 
                requestId,
                fileId: req.params.id
            });
            endTimer(apiTimer);
            return res.status(404).end();
        }

        appLogger.info('File metadata retrieved successfully', { 
            requestId,
            fileId: fileMetadata.id,
            fileName: fileMetadata.fileName
        });

        const duration = endTimer(apiTimer);
        appLogger.info('File retrieval request completed successfully', {
            requestId,
            duration,
            fileId: fileMetadata.id
        });

        res.json({
            id: fileMetadata.id,
            file_name: fileMetadata.fileName,
            url: fileMetadata.filePath,
            upload_date: fileMetadata.uploadDate
        });
    } catch (err) {
        appLogger.error('File retrieval failed', { 
            requestId,
            fileId: req.params.id,
            error: err.message,
            stack: err.stack
        });
        
        endTimer(apiTimer);
        res.status(503).end();
    }
};

const deleteFile = async (req, res) => {
    const requestId = req.requestId || generateUniqueId();
    const apiTimer = startTimer('api.delete.files');
    
    appLogger.info('File deletion request received', {
        requestId,
        fileId: req.params.id,
        method: req.method
    });
    
    if (req.method === "HEAD") {
        appLogger.warn('HEAD method not allowed for file deletion', { 
            requestId,
            fileId: req.params.id
        });
        endTimer(apiTimer);
        return res.status(405).end();
    }

    const incomingHeaders = Object.keys(req.headers);
    const invalidHeaders = incomingHeaders.filter(
      (header) => !permittedHeaders.includes(header.toLowerCase())
    );

    if (Object.keys(req.body).length > 0 || req.headers['content-type'] ||
    (req.files && req.files.length > 0) || Object.keys(req.query).length > 0
    || invalidHeaders.length > 0) {
        appLogger.warn('Invalid request parameters for file deletion', { 
            requestId,
            fileId: req.params.id,
            hasBody: Object.keys(req.body).length > 0,
            hasContentType: !!req.headers['content-type'],
            hasFiles: !!(req.files && req.files.length > 0),
            hasQueryParams: Object.keys(req.query).length > 0,
            invalidHeaders
        });
        endTimer(apiTimer);
        return sendResponse(res, 400);
    }
    
    try {
        appLogger.info('Retrieving file metadata for deletion', { 
            requestId,
            fileId: req.params.id
        });
        
        const fileMetadata = await measureDbOperation('findByPk', 'FileMetadata', async () => {
            return FileMetadata.findByPk(req.params.id);
        });
        
        if (!fileMetadata) {
            appLogger.warn('File not found for deletion', { 
                requestId,
                fileId: req.params.id
            });
            endTimer(apiTimer);
            return res.status(404).end();
        }

        const fileKey = fileMetadata.filePath.split('/').pop();
        
        appLogger.info('Deleting file from S3', { 
            requestId,
            fileId: fileMetadata.id,
            fileKey
        });
        
        await measureS3Operation('deleteObject', async () => {
            return s3Client.send(new DeleteObjectCommand({ 
                Bucket: process.env.S3_BUCKET_NAME, 
                Key: fileKey 
            }));
        });
        
        appLogger.info('File deleted from S3 successfully', { 
            requestId,
            fileId: fileMetadata.id,
            fileKey
        });

        await measureDbOperation('destroy', 'FileMetadata', async () => {
            return fileMetadata.destroy();
        });
        
        appLogger.info('File metadata deleted from database', { 
            requestId,
            fileId: fileMetadata.id
        });
        
        const duration = endTimer(apiTimer);
        appLogger.info('File deletion request completed successfully', {
            requestId,
            duration,
            fileId: req.params.id
        });
        
        res.status(204).send();
    } catch (err) {
        appLogger.error('File deletion failed', { 
            requestId,
            fileId: req.params.id,
            error: err.message,
            stack: err.stack
        });
        
        endTimer(apiTimer);
        res.status(503).end();
    }
};

const methodNotAllowed = (req, res) => {
    const requestId = req.requestId || generateUniqueId();
    
    appLogger.warn('Method not allowed', { 
        requestId,
        method: req.method,
        path: req.originalUrl
    });
    
    countMetric('api.method_not_allowed.count');
    return sendResponse(res, 405);
};

module.exports = { uploadFile, getFile, deleteFile, methodNotAllowed };