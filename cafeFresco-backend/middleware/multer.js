const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const imageStore = require('../services/storage');

// Ensure upload directories exist
const productImageDir = path.join(__dirname, '../public/images/product');
const userImageDir = path.join(__dirname, '../public/images/user');
const categoryImageDir = path.join(__dirname, '../public/images/category');

[productImageDir, userImageDir, categoryImageDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Function to set storage destination dynamically
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder;
        if (req.uploadType === 'product') {
            folder = productImageDir;
        } else if (req.uploadType === 'category') {
            folder = categoryImageDir;
        } else {
            folder = userImageDir;
        }
        cb(null, folder);
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(12, (err, bytes) => {
            if (err) return cb(err, null);
            const uniqueFileName = bytes.toString('hex') + path.extname(file.originalname);
            cb(null, uniqueFileName);
        });
    }
});

// File filter (only allow images)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValidType = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);

    if (isValidType) {
        cb(null, true);
    } else {
        cb(new Error("Only images are allowed (jpeg, jpg, png, gif, webp)"), false);
    }
};

// Multer upload function
const upload = (type) => {
    return (req, res, next) => {
        req.uploadType = type; // Set type dynamically for destination folderh
        multer({
            storage: storage,
            limits: { fileSize: Number(process.env.UPLOAD_MAX_MB || 2) * 1024 * 1024 },
            fileFilter: fileFilter
        }).single('image')(req, res, (err) => {
            if (err) {
                const message = err.code === 'LIMIT_FILE_SIZE' ? `Image is too large (max ${process.env.UPLOAD_MAX_MB || 2} MB)` : err.message;
                return res.status(400).json({ message });
            }
            if (!req.file) return next();
            const folder = req.uploadType === 'product' || req.uploadType === 'category' ? req.uploadType : 'user';
            // req.file.storedUrl is what routes save on the document (local path, or Cloudinary when configured)
            const finish = () => {
                // If the handler ends in an error, delete the file it just received (no orphans)
                const json = res.json.bind(res);
                res.json = (body) => {
                    if (res.statusCode >= 400) imageStore.remove(req.file.storedUrl);
                    return json(body);
                };
                next();
            };
            if (imageStore.driver() !== 'cloudinary') {
                req.file.storedUrl = `/images/${folder}/${req.file.filename}`;
                return finish();
            }
            fs.promises
                .readFile(req.file.path)
                .then((buffer) => imageStore.save(buffer, { folder, ext: path.extname(req.file.originalname).slice(1).toLowerCase() || 'jpg' }))
                .then((url) => {
                    req.file.storedUrl = url;
                    fs.unlink(req.file.path, () => {});
                    finish();
                })
                .catch((e) => {
                    fs.unlink(req.file.path, () => {});
                    console.error('Image upload to storage failed:', e.message);
                    res.status(502).json({ message: 'Could not store the image. Please try again.' });
                });
        });
    };
};

module.exports = upload;
