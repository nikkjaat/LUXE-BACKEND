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
    const {
      name,
      description,
      image,
      isActive,
      slug,
      sortOrder,
      imageSource,
      subcategories,
      seoTitle,
      seoDescription,
      metaKeywords,
    } = req.body;

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

    // Handle image upload
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

    // Parse and validate subcategories for 5 levels
    let parsedSubcategories = [];
    if (subcategories) {
      parsedSubcategories = parseAndValidateSubcategories(subcategories);
      if (!parsedSubcategories) {
        return res.status(400).json({
          success: false,
          message: "Invalid subcategories format",
        });
      }
    }

    // Parse metaKeywords if provided
    let parsedMetaKeywords = [];
    if (metaKeywords) {
      if (typeof metaKeywords === "string") {
        try {
          parsedMetaKeywords = JSON.parse(metaKeywords);
        } catch (error) {
          // If it's a comma-separated string, split it
          parsedMetaKeywords = metaKeywords
            .split(",")
            .map((kw) => kw.trim())
            .filter((kw) => kw);
        }
      } else if (Array.isArray(metaKeywords)) {
        parsedMetaKeywords = metaKeywords;
      }
    }

    const newCategory = new Category({
      name: name.trim(),
      description: description ? description.trim() : "",
      slug: slug.trim().toLowerCase(),
      isActive: isActive === "true" || isActive === true,
      sortOrder: parseInt(sortOrder) || 0,
      image: imageUrl,
      subcategories: parsedSubcategories,
      level: 1, // Main category
      hierarchyLevel: "main",
      seoTitle: seoTitle ? seoTitle.trim() : "",
      seoDescription: seoDescription ? seoDescription.trim() : "",
      metaKeywords: parsedMetaKeywords,
    });

    // Generate fullPath for the category
    newCategory.fullPath = newCategory.slug;

    await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Category added successfully",
      data: newCategory,
    });
  } catch (error) {
    console.error("Error adding category:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

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
    const {
      name,
      description,
      image,
      isActive,
      slug,
      sortOrder,
      imageSource,
      subcategories,
      seoTitle,
      seoDescription,
      metaKeywords,
    } = req.body;

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

    // Handle image update
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

    // Parse and validate subcategories for 5 levels
    let parsedSubcategories = category.subcategories; // Keep existing by default
    if (subcategories) {
      parsedSubcategories = parseAndValidateSubcategories(subcategories);
      if (!parsedSubcategories) {
        return res.status(400).json({
          success: false,
          message: "Invalid subcategories format",
        });
      }
    }

    // Parse metaKeywords if provided
    let parsedMetaKeywords = category.metaKeywords;
    if (metaKeywords !== undefined) {
      if (typeof metaKeywords === "string") {
        try {
          parsedMetaKeywords = JSON.parse(metaKeywords);
        } catch (error) {
          // If it's a comma-separated string, split it
          parsedMetaKeywords = metaKeywords
            .split(",")
            .map((kw) => kw.trim())
            .filter((kw) => kw);
        }
      } else if (Array.isArray(metaKeywords)) {
        parsedMetaKeywords = metaKeywords;
      } else if (metaKeywords === "") {
        parsedMetaKeywords = [];
      }
    }

    const updateData = {
      name: name.trim(),
      description: description ? description.trim() : "",
      slug: slug.trim().toLowerCase(),
      isActive: isActive === "true" || isActive === true,
      sortOrder: parseInt(sortOrder) || 0,
      image: imageUrl,
      subcategories: parsedSubcategories,
      seoTitle: seoTitle ? seoTitle.trim() : "",
      seoDescription: seoDescription ? seoDescription.trim() : "",
      metaKeywords: parsedMetaKeywords,
    };

    // Update fullPath if slug changed
    if (slug !== category.slug) {
      updateData.fullPath = slug.trim().toLowerCase();
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// Updated helper function to parse and validate subcategories for 5 levels
function parseAndValidateSubcategories(subcategories) {
  let parsedSubcategories = [];

  try {
    // Parse if it's a string (from FormData)
    if (typeof subcategories === "string") {
      parsedSubcategories = JSON.parse(subcategories);
    } else if (Array.isArray(subcategories)) {
      parsedSubcategories = subcategories;
    } else {
      return null;
    }

    // Validate and set defaults for all 5 levels recursively
    const validateCategoryLevel = (categories, level = 2) => {
      return categories.map((category) => {
        if (!category.name || !category.slug) {
          throw new Error(
            `Each level ${level} category must have a name and slug`
          );
        }

        // Set default values
        category.productCount = category.productCount || 0;
        category.isActive = category.isActive !== false;
        category.sortOrder = parseInt(category.sortOrder) || 0;

        // Set level and hierarchyLevel based on current level
        category.level = level;
        category.hierarchyLevel = getHierarchyLevelFromNumber(level);

        // Recursively validate subcategories if they exist and we haven't reached level 5
        if (
          category.subcategories &&
          Array.isArray(category.subcategories) &&
          level < 5
        ) {
          category.subcategories = validateCategoryLevel(
            category.subcategories,
            level + 1
          );
        } else {
          category.subcategories = category.subcategories || [];
        }

        return category;
      });
    };

    // Start validation from level 2
    parsedSubcategories = validateCategoryLevel(parsedSubcategories, 2);

    return parsedSubcategories;
  } catch (error) {
    console.error("Error parsing subcategories:", error);
    return null;
  }
}

// Helper function to get hierarchy level from number
function getHierarchyLevelFromNumber(level) {
  const hierarchyMap = {
    1: "main",
    2: "subcategory",
    3: "type",
    4: "variant",
    5: "style",
  };
  return hierarchyMap[level] || "main";
}

// Additional utility functions for 5-level categories

exports.getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({ level: 1, isActive: true })
      .select(
        "name slug description image subcategories level hierarchyLevel productCount isActive sortOrder"
      )
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category tree",
      error: error.message,
    });
  }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({
      slug: slug.toLowerCase(),
      isActive: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category by slug:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

exports.updateCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const category = await Category.findByIdAndUpdate(
      id,
      { isActive: isActive === "true" || isActive === true },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: `Category ${
        category.isActive ? "activated" : "deactivated"
      } successfully`,
      data: category,
    });
  } catch (error) {
    console.error("Error updating category status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category status",
      error: error.message,
    });
  }
};

// Get categories by hierarchy level
exports.getCategoriesByHierarchyLevel = async (req, res) => {
  try {
    const { level } = req.params;

    const validLevels = ["main", "subcategory", "type", "variant", "style"];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hierarchy level",
      });
    }

    const categories = await Category.findByHierarchyLevel(level);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories by hierarchy level:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

// Get complete category hierarchy with all levels
exports.getCompleteHierarchy = async (req, res) => {
  try {
    const categories = await Category.getCompleteTree();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching complete hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch complete hierarchy",
      error: error.message,
    });
  }
};

// Helper function to parse and validate subcategories
function parseAndValidateSubcategories(subcategories) {
  let parsedSubcategories = [];

  try {
    // Parse if it's a string (from FormData)
    if (typeof subcategories === "string") {
      parsedSubcategories = JSON.parse(subcategories);
    } else if (Array.isArray(subcategories)) {
      parsedSubcategories = subcategories;
    } else {
      return null;
    }

    // Validate subcategory structure
    for (const subcategory of parsedSubcategories) {
      if (!subcategory.name || !subcategory.slug) {
        throw new Error("Each subcategory must have a name and slug");
      }

      // Set default values for subcategory
      subcategory.productCount = subcategory.productCount || 0;
      subcategory.isActive = subcategory.isActive !== false;
      subcategory.sortOrder = parseInt(subcategory.sortOrder) || 0;
      subcategory.subcategories = subcategory.subcategories || [];

      // Validate sub-subcategories
      if (
        subcategory.subcategories &&
        Array.isArray(subcategory.subcategories)
      ) {
        for (const subSubcategory of subcategory.subcategories) {
          if (!subSubcategory.name || !subSubcategory.slug) {
            throw new Error("Each sub-subcategory must have a name and slug");
          }

          // Set default values for sub-subcategory
          subSubcategory.productCount = subSubcategory.productCount || 0;
          subSubcategory.isActive = subSubcategory.isActive !== false;
          subSubcategory.sortOrder = parseInt(subSubcategory.sortOrder) || 0;
        }
      }
    }

    return parsedSubcategories;
  } catch (error) {
    console.error("Error parsing subcategories:", error);
    return null;
  }
}

// Additional utility functions for category management

exports.getCategoryHierarchy = async (req, res) => {
  try {
    const categories = await Category.find({ level: 1, isActive: true })
      .select("name slug description image subcategories")
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching category hierarchy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category hierarchy",
      error: error.message,
    });
  }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({
      slug: slug.toLowerCase(),
      isActive: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category by slug:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

exports.updateCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const category = await Category.findByIdAndUpdate(
      id,
      { isActive: isActive === "true" || isActive === true },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: `Category ${
        category.isActive ? "activated" : "deactivated"
      } successfully`,
      data: category,
    });
  } catch (error) {
    console.error("Error updating category status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category status",
      error: error.message,
    });
  }
};

// Helper function to generate slugs (you can add this to your controller)
exports.generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
