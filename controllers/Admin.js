const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const mongoose = require("mongoose");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../Utils/cloudinary.js");

exports.getAdminProducts = async (req, res, next) => {
  try {
    const products = await Product.find().populate("vendor", "name email");
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

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

exports.addCategory = async (req, res, next) => {
  try {
    const { name, description, image, isActive, slug, sortOrder, imageSource } =
      req.body;

    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }

    // Check for duplicates
    const existingCategory = await Category.findOne({
      $or: [{ name }, { slug }],
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
    }

    let imageUrl = "";

    // Handle image upload - store as single string
    if (imageSource === "file" && req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "LUXE/category"
        );
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    } else if (imageSource === "url" && image) {
      imageUrl = image;
    } else {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const newCategory = new Category({
      name,
      description,
      slug,
      isActive: isActive === "true" || isActive === true,
      sortOrder: parseInt(sortOrder) || 0,
      image: imageUrl,
    });

    await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Category added successfully",
      data: newCategory,
    });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, isActive, slug, sortOrder, imageSource } =
      req.body;

    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check for duplicates (excluding current category)
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      $or: [{ name }, { slug }],
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
    }

    let imageUrl = category.image; // Keep existing image by default

    // Handle image update - store as single string (consistent with addCategory)
    if (imageSource === "file" && req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          "LUXE/category"
        );
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    } else if (imageSource === "url" && image) {
      imageUrl = image;
    }
    // Note: If no new image is provided, we keep the existing image
    // Remove the else block that returns error to allow updates without changing image

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name,
        description,
        slug,
        isActive: isActive === "true" || isActive === true,
        sortOrder: parseInt(sortOrder) || 0,
        image: imageUrl, // Store as single string (consistent with addCategory)
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// Add these missing controller functions
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1 });
    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};
