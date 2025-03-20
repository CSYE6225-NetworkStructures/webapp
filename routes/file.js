const express = require('express');
const multer = require('multer');
const { uploadFile, getFile, deleteFile, methodNotAllowed } = require('../controllers/fileController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.route('/file')
    .post((req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) {
                return res.status(400).end();
            }

            // Check if there are any additional fields in form-data
            const otherFields = Object.keys(req.body);
            if (otherFields.length > 0) {
                return res.status(400).end();
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