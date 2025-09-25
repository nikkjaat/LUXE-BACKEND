const express = require("express");
const { body } = require("express-validator");

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByVendor,
  searchProducts,
  getProductReviews,
  addProductReview,
  updateProductReview,
  deleteProductReview,
} = require("../controllers/ProductController.js");

const {
  protect,
  authorize,
  adminVendorAuth,
} = require("../middleware/auth.js");
const { validate } = require("../middleware/validate.js");
const { uploadMultiple } = require("../middleware/upload.js");

const router = express.Router();

// Validation rules
const productValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be between 2 and 100 characters"),

  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  // Validate category.main
  body("category.main")
    .isIn([
      "electronics",
      "men",
      "women",
      "grocery",
      "furniture",
      "books",
      "toys",
      "sports",
      "beauty",
      "other",
    ])
    .withMessage("Invalid main category"),

  // Validate category.sub exists
  body("category.sub").trim().notEmpty().withMessage("Subcategory is required"),
];

const reviewValidation = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("title")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters"),
  body("comment")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Comment must be between 10 and 1000 characters"),
];

// Public routes
router.get("/", getProducts);
router.get("/search", searchProducts);
router.get("/:id", getProduct);
router.get("/:id/reviews", getProductReviews);

// Protected routes
router.post(
  "/:id/reviews",
  protect,
  authorize("user"),
  reviewValidation,
  validate,
  addProductReview
);
router.put("/reviews/:reviewId", protect, updateProductReview);
router.delete("/reviews/:reviewId", protect, deleteProductReview);

// Vendor routes
router.post(
  "/",
  protect,
  adminVendorAuth,
  uploadMultiple,

  validate,
  createProduct
);
router.put(
  "/:id",
  protect,
  adminVendorAuth,
  uploadMultiple,

  validate,
  updateProduct
);
router.delete("/:id", protect, adminVendorAuth, deleteProduct);
router.get(
  "/vendor/my-products",
  protect,
  adminVendorAuth,
  getProductsByVendor
);

module.exports = router;
