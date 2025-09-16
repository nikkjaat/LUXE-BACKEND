const express = require("express");
const router = express.Router();

const {
  getAdminProducts,
  getVendorApplications,
  approveVendor,
  getVendors,
  getAllUsers,
  adminActivateUser,
  adminSuspendUser,
  deleteUser,
  addCategory,
  updateCategory,
  getCategories,
} = require("../controllers/Admin");
const { protect, adminVendorAuth } = require("../middleware/auth");
const { uploadSingle } = require("../middleware/upload");

// Admin product management routes
router.get("/admin/products", protect, adminVendorAuth, getAdminProducts);

// get vendor applications
router.get("/vendors/applications", getVendorApplications);
router.put("/vendors/:id/approve", approveVendor);
//get all users
router.get("/admin/getallusers", getAllUsers);
// get all vendors
router.get("/vendors", getVendors);

router.put("/admin/users/:id/activate", adminActivateUser);
router.put("/admin/users/:id/suspend", adminSuspendUser);
router.delete("/admin/users/:id", deleteUser);

router.get("/admin/categories", getCategories);

router.post(
  "/admin/create-category",
  protect,
  adminVendorAuth,
  uploadSingle,
  addCategory
);
router.put(
  "/admin/categories/:id",
  protect,
  adminVendorAuth,
  uploadSingle,
  updateCategory
);

module.exports = router;
