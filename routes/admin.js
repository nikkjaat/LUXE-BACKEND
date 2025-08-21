const express = require("express");
const router = express.Router();

const {
  getVendorApplications,
  approveVendor,
  getVendors,
} = require("../controllers/Admin");

// get vendor applications
router.get("/vendors/applications", getVendorApplications);
router.put("/vendors/:id/approve", approveVendor);
// get all vendors
router.get("/vendors", getVendors);

module.exports = router;
