const express = require('express');
const multer = require('multer');
const { uploadFile, getFile, deleteFile, methodNotAllowed } = require('../controllers/fileController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.route('/file')
    .post((req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: 'File upload error: Please use "file" as the field name for your file upload',
                    error: err.message
                });
            }
            next();
        });
    }, uploadFile)
    .all(methodNotAllowed);

router.route('/file/:id')
    .get(getFile)
    .delete(deleteFile)
    .all(methodNotAllowed);

module.exports = router;