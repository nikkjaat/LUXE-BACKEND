const Product = require("../models/Product");
const User = require("../models/User");
const mongoose = require("mongoose");

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
    res.status(500).json({ message: error });
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).lean();
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

exports.adminActivateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.isActive = true;
    await user.save();

    if (user.role === "vendor") {
      // If the user is a vendor, also set their vendorInfo status to 'active'
      user.vendorInfo.status = "approved";
      await user.save();
      // all products from this vendor should be set to active
      await Product.updateMany(
        { vendor: user._id },
        { $set: { status: "active" } }
      );
    }

    res.status(200).json({
      success: true,
      message: `User has been ${user.isActive ? "activated" : "suspended"}`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

exports.adminSuspendUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.isActive = false;
    await user.save();

    if (user.role === "vendor") {
      // If the user is a vendor, also set their vendorInfo status to 'suspended
      user.vendorInfo.status = "suspended";
      await user.save();

      // all products from this vendor should be set to inactive
      await Product.updateMany(
        { vendor: user._id },
        { $set: { status: "inactive" } }
      );
    }

    res.status(200).json({
      success: true,
      message: `User has been ${user.isActive ? "activated" : "suspended"}`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

exports.deleteUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.params.id;

    // Delete user
    const user = await User.findByIdAndDelete(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found" });
    }

    // Delete all products from this user
    await Product.deleteMany({ vendor: userId }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "User and their products deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: error.message });
  }
};
