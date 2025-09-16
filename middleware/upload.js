const multer = require("multer");
const path = require("path");

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload only images."), false);
  }
};

// Create basic multer instance
const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

// For single image upload (category image)
const uploadSingle = multerInstance.single("imageFile");

// For product uploads - we need to handle dynamic field names
const uploadProductFiles = (req, res, next) => {
  // Create a custom multer instance that accepts any field name
  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 50, // Maximum number of files
    },
  }).any(); // Accept any field name

  upload(req, res, (err) => {
    if (err) {
      // Handle specific multer errors
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded.",
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        // For product uploads, we expect dynamic field names
        // So we'll just continue
        return next();
      }
      return next(err);
    }
    next();
  });
};

module.exports = {
  uploadSingle,
  uploadMultiple: uploadProductFiles, // Use the custom handler for products
};
