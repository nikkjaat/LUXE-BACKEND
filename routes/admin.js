const express = require("express");
const router = express.Router();

const {
  getVendorApplications,
  approveVendor,
  getVendors,
  getAllUsers,
  adminActivateUser,
  adminSuspendUser,
  deleteUser,
} = require("../controllers/Admin");

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

module.exports = router;
