const mongoose = require("mongoose");

// Level 5 Schema
const level5CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Level 5 category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Level 5 category slug is required"],
      trim: true,
    },
    productCount: {
      type: Number,
      default: 0,
      min: [0, "Product count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: true, timestamps: true }
);

// Level 4 Schema
const level4CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Level 4 category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Level 4 category slug is required"],
      trim: true,
    },
    productCount: {
      type: Number,
      default: 0,
      min: [0, "Product count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    subcategories: [level5CategorySchema], // Level 5 subcategories
  },
  { _id: true, timestamps: true }
);

// Level 3 Schema
const level3CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Level 3 category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Level 3 category slug is required"],
      trim: true,
    },
    productCount: {
      type: Number,
      default: 0,
      min: [0, "Product count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    subcategories: [level4CategorySchema], // Level 4 subcategories
  },
  { _id: true, timestamps: true }
);

// Level 2 Schema
const level2CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Level 2 category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Level 2 category slug is required"],
      trim: true,
    },
    productCount: {
      type: Number,
      default: 0,
      min: [0, "Product count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    subcategories: [level3CategorySchema], // Level 3 subcategories
  },
  { _id: true, timestamps: true }
);

// Main Category Schema (Level 1)
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    image: {
      type: String,
      required: [true, "Category image is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Slug cannot exceed 100 characters"],
    },
    subcategories: [level2CategorySchema], // Level 2 subcategories
    productCount: {
      type: Number,
      default: 0,
      min: [0, "Product count cannot be negative"],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
      enum: [1, 2, 3, 4, 5], // 1: Main category, 2: Subcategory, 3: Type, 4: Variant, 5: Style
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    fullPath: {
      type: String,
      trim: true,
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: [200, "SEO title cannot exceed 200 characters"],
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: [500, "SEO description cannot exceed 500 characters"],
    },
    metaKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
    hierarchyLevel: {
      type: String,
      enum: ["main", "subcategory", "type", "variant", "style"],
      default: "main",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for getting all products in this category and its subcategories
categorySchema.virtual("totalProductCount").get(function () {
  let total = this.productCount;

  // Recursive function to calculate product counts from all nested levels
  const calculateNestedProductCount = (categories) => {
    if (!categories || categories.length === 0) return 0;

    let nestedTotal = 0;
    categories.forEach((cat) => {
      nestedTotal += cat.productCount || 0;
      if (cat.subcategories && cat.subcategories.length > 0) {
        nestedTotal += calculateNestedProductCount(cat.subcategories);
      }
    });
    return nestedTotal;
  };

  total += calculateNestedProductCount(this.subcategories);
  return total;
});

// Virtual for getting the complete hierarchy path
categorySchema.virtual("completePath").get(function () {
  if (this.fullPath) return this.fullPath;
  return this.slug;
});

// Index for better performance
// categorySchema.index({ slug: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ hierarchyLevel: 1 });
categorySchema.index({ "subcategories.slug": 1 });
categorySchema.index({ "subcategories.subcategories.slug": 1 });
categorySchema.index({ "subcategories.subcategories.subcategories.slug": 1 });
categorySchema.index({
  "subcategories.subcategories.subcategories.subcategories.slug": 1,
});

// Pre-save middleware to generate fullPath and set hierarchy level
categorySchema.pre("save", function (next) {
  if (this.isModified("name") || this.isModified("slug")) {
    this.fullPath = this.slug;
  }

  // Set hierarchy level based on level number
  const hierarchyMap = {
    1: "main",
    2: "subcategory",
    3: "type",
    4: "variant",
    5: "style",
  };
  this.hierarchyLevel = hierarchyMap[this.level] || "main";

  next();
});

// Static method to find categories by level
categorySchema.statics.findByLevel = function (level) {
  return this.find({ level: level }).sort({ sortOrder: 1, name: 1 });
};

// Static method to find active categories
categorySchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

// Static method to find categories by hierarchy level
categorySchema.statics.findByHierarchyLevel = function (hierarchyLevel) {
  return this.find({ hierarchyLevel: hierarchyLevel, isActive: true }).sort({
    sortOrder: 1,
    name: 1,
  });
};

// Instance method to get complete hierarchy
categorySchema.methods.getHierarchy = function () {
  const buildHierarchy = (category) => {
    return {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      level: category.level,
      hierarchyLevel: category.hierarchyLevel,
      productCount: category.productCount,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      subcategories: category.subcategories
        ? category.subcategories.map(buildHierarchy)
        : [],
    };
  };

  return buildHierarchy(this);
};

// Instance method to check if category has products
categorySchema.methods.hasProducts = function () {
  return this.totalProductCount > 0;
};

// Instance method to get flat list of all subcategories
categorySchema.methods.getAllSubcategories = function () {
  const allSubcategories = [];

  const collectSubcategories = (categories, level) => {
    if (!categories || categories.length === 0) return;

    categories.forEach((cat) => {
      allSubcategories.push({
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        level: level,
        hierarchyLevel: this.getHierarchyLevelFromNumber(level),
        productCount: cat.productCount,
        isActive: cat.isActive,
        sortOrder: cat.sortOrder,
      });

      if (cat.subcategories && cat.subcategories.length > 0) {
        collectSubcategories(cat.subcategories, level + 1);
      }
    });
  };

  collectSubcategories(this.subcategories, 2);
  return allSubcategories;
};

// Helper method to get hierarchy level from number
categorySchema.methods.getHierarchyLevelFromNumber = function (level) {
  const hierarchyMap = {
    1: "main",
    2: "subcategory",
    3: "type",
    4: "variant",
    5: "style",
  };
  return hierarchyMap[level] || "main";
};

// Instance method to find subcategory by slug at any level
categorySchema.methods.findSubcategoryBySlug = function (slug, level = 2) {
  const searchSubcategories = (categories, currentLevel) => {
    for (const cat of categories) {
      if (cat.slug === slug && currentLevel === level) {
        return cat;
      }
      if (cat.subcategories && cat.subcategories.length > 0) {
        const found = searchSubcategories(cat.subcategories, currentLevel + 1);
        if (found) return found;
      }
    }
    return null;
  };

  return searchSubcategories(this.subcategories, 2);
};

// Middleware to update product counts
categorySchema.methods.updateProductCount = async function () {
  const Product = mongoose.model("Product");

  // Count products in this main category
  const mainCategoryCount = await Product.countDocuments({
    "category.main": this._id,
    isActive: true,
  });

  this.productCount = mainCategoryCount;
  await this.save();
};

// Pre-remove middleware to handle category deletion
categorySchema.pre("remove", async function (next) {
  try {
    // Check if category has products
    if (this.totalProductCount > 0) {
      throw new Error("Cannot delete category that contains products");
    }

    // Check all nested levels for products
    const hasProductsInNested = this.checkNestedProducts(this);
    if (hasProductsInNested) {
      throw new Error(
        "Cannot delete category that contains products in nested categories"
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Helper method to check for products in nested categories
categorySchema.methods.checkNestedProducts = function (category) {
  if (category.productCount > 0) return true;

  const checkSubcategories = (categories) => {
    if (!categories || categories.length === 0) return false;

    for (const cat of categories) {
      if (cat.productCount > 0) return true;
      if (cat.subcategories && cat.subcategories.length > 0) {
        if (checkSubcategories(cat.subcategories)) return true;
      }
    }
    return false;
  };

  return checkSubcategories(category.subcategories);
};

// Static method to build complete category tree
categorySchema.statics.getCompleteTree = async function () {
  const mainCategories = await this.find({ level: 1, isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return mainCategories;
};

// Instance method to get breadcrumb trail
categorySchema.methods.getBreadcrumbTrail = async function () {
  const trail = [
    {
      name: this.name,
      slug: this.slug,
      level: "main",
    },
  ];

  // If this is a nested category, you would need to find parent categories
  // This would require additional parent references in the schema

  return trail;
};

module.exports = mongoose.model("Category", categorySchema);
