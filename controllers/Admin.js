const User = require("../models/User");

exports.getVendorApplications = async (req, res) => {
  try {
    // Find only vendors whose status is "pending"
    const pendingApplications = await User.find({
      role: "customer",
      "vendorInfo.status": "pending",
    })
      .select("-password") // exclude password
      .lean(); // return plain JS objects for faster performance

    res.status(200).json({
      success: true,
      count: pendingApplications.length,
      data: pendingApplications,
      message: "Vendor applications fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching vendor applications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.approveVendor = async (req, res, next) => {
  try {
    const vendorId = req.params.id; // This will get the ":id" from the URL

    // Example: Find and update vendor status
    const updatedVendor = await User.findByIdAndUpdate(
      vendorId,
      { role: "vendor", "vendorInfo.status": "approved" },
      { new: true }
    );

    if (!updatedVendor) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }

    res.status(200).json({ success: true, data: updatedVendor });
  } catch (error) {
    next(error);
  }
};

exports.getVendors = async (req, res) => {
  try {
    // Find all users with role "vendor"
    const vendors = await User.find({ role: "vendor" })
      .select("-password") // exclude password
      .lean(); // return plain JS objects for faster performance

    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors,
      message: "Vendors fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
