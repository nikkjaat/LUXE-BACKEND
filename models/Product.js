const mongoose = require("mongoose");

// Size variant schema
const sizeVariantSchema = new mongoose.Schema({
  size: {
    type: String,
    trim: true,
  },
  customSize: {
    type: String,
    trim: true,
  },
  stock: {
    type: Number,
    required: [true, "Stock quantity is required"],
    min: [0, "Stock cannot be negative"],
    default: 0,
  },
  priceAdjustment: {
    type: Number,
    default: 0,
  },
});

// Image schema
const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  secure_url: {
    type: String,
  },
  alt: {
    type: String,
    trim: true,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    default: 0,
  },
  publicId: String,
});

// Color variant schema
const colorVariantSchema = new mongoose.Schema({
  colorName: {
    type: String,
    required: [true, "Color name is required"],
    trim: true,
  },
  colorCode: {
    type: String,
    default: "#000000",
    validate: {
      validator: function (v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: "Color code must be a valid hex color",
    },
  },
  images: [imageSchema],
  sizeVariants: [sizeVariantSchema],
});

// Category-specific fields schema (replaces specifications)
const categoryFieldsSchema = new mongoose.Schema(
  {
    // Electronics
    model: String,
    screenSize: String,
    resolution: String,
    ram: String,
    storage: String,
    processor: String,
    battery: String,

    // Clothing (Men & Women)
    fabric: String,
    fit: String,
    sleeveType: String,
    neckType: String,
    occasion: String,
    pattern: String,

    // Books
    author: String,
    publisher: String,
    isbn: String,
    language: String,
    pages: Number,
    genre: String,

    // Furniture
    material: String,
    dimensions: String,
    roomType: String,
    assembly: String,
    weightCapacity: String,

    // Grocery
    expiryDate: Date,
    weight: String,
    ingredients: String,
    nutritionFacts: String,

    // Toys
    ageRange: String,
    batteryRequired: Boolean,
    safetyInfo: String,

    // Sports
    sportType: String,

    // Beauty
    skinType: String,
    volume: String,
    benefits: String,
  },
  { _id: false }
);

// Category reference schema
const categoryReferenceSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    level: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      required: true,
    },
    hierarchyLevel: {
      type: String,
      enum: ["main", "subcategory", "type", "variant", "style"],
      required: true,
    },
  },
  { _id: false }
);

// Main product schema
const productSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // Category Information - Updated for 5-level hierarchy with backward compatibility
    category: {
      // Complete category hierarchy (new fields)
      // hierarchy: {
      //   main: {
      //     type: categoryReferenceSchema,
      //     default: null,
      //   },
      //   subcategory: {
      //     type: categoryReferenceSchema,
      //     default: null,
      //   },
      //   type: {
      //     type: categoryReferenceSchema,
      //     default: null,
      //   },
      //   variant: {
      //     type: categoryReferenceSchema,
      //     default: null,
      //   },
      //   style: {
      //     type: categoryReferenceSchema,
      //     default: null,
      //   },
      // },

      // String paths for easy querying and display (existing fields + new ones)
      main: {
        type: String,
        required: [true, "Main category is required"],
      },
      sub: {
        type: String,
        required: [true, "Subcategory is required"],
        trim: true,
      },
      // New optional fields for extended hierarchy
      type: {
        type: String,
        trim: true,
        default: "",
      },
      variant: {
        type: String,
        trim: true,
        default: "",
      },
      style: {
        type: String,
        trim: true,
        default: "",
      },

      // Complete path for URL and navigation
      fullPath: {
        type: String,
        trim: true,
        default: "",
      },

      // Array of all category levels for flexible querying
      allLevels: {
        type: [
          {
            level: {
              type: Number,
              enum: [1, 2, 3, 4, 5],
            },
            name: String,
            slug: String,
            _id: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Category",
            },
          },
        ],
        default: [],
      },
    },

    brand: {
      type: String,
      trim: true,
      required: [true, "Brand is required"],
    },

    // Pricing
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
    },

    // Product Status & Badges
    badge: {
      type: String,
      enum: [
        "Best Seller",
        "New Arrival",
        "Limited Edition",
        "Exclusive",
        "Trending",
        "Premium",
        "Sale",
        "Hot Deal",
        "Staff Pick",
        "",
      ],
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "discontinued"],
      default: "draft",
    },

    // Category-specific fields (replaces specifications)
    categoryFields: {
      type: categoryFieldsSchema,
      default: () => ({}),
    },

    // Common specifications across all categories
    commonSpecs: {
      weight: {
        value: {
          type: Number,
          default: 0,
        },
        unit: {
          type: String,
          enum: ["kg", "g", "lb", "oz"],
          default: "kg",
        },
      },
      material: {
        type: String,
        trim: true,
        default: "",
      },
      warranty: {
        type: String,
        trim: true,
        default: "",
      },
      features: {
        type: [String],
        default: [],
      },
    },

    // Variants
    colorVariants: {
      type: [colorVariantSchema],
      default: [],
    },
    hasVariants: {
      type: Boolean,
      default: false,
    },

    // Stock information
    stock: {
      type: Number,
      default: 0,
    },

    // Tags
    tags: {
      type: [String],
      default: [],
    },
    slug: {
      type: String,
      sparse: true,
    },

    // Vendor information
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vendor is required"],
    },
    vendorName: {
      type: String,
      required: true,
    },

    // Performance metrics
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    salesCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Text indexes for intelligent search with weights
productSchema.index(
  {
    name: "text",
    description: "text",
    tags: "text",
    brand: "text",
    "category.main": "text",
    "category.sub": "text",
    "category.type": "text",
  },
  {
    weights: {
      name: 10,
      brand: 8,
      tags: 6,
      "category.main": 5,
      "category.sub": 4,
      "category.type": 3,
      description: 2,
    },
    name: "product_search_index",
  }
);

// Individual field indexes for better query performance
productSchema.index({ "category.main": 1 });
productSchema.index({ "category.sub": 1 });
productSchema.index({ "category.type": 1 });
productSchema.index({ "category.variant": 1 });
productSchema.index({ "category.style": 1 });
productSchema.index({ "category.fullPath": 1 });
productSchema.index({ "category.allLevels.level": 1 });
productSchema.index({ "category.allLevels.name": 1 });
productSchema.index({ "category.allLevels.slug": 1 });
productSchema.index({ "category.allLevels._id": 1 });
productSchema.index({ "category.hierarchy.main._id": 1 });
productSchema.index({ "category.hierarchy.subcategory._id": 1 });
productSchema.index({ "category.hierarchy.type._id": 1 });
productSchema.index({ "category.hierarchy.variant._id": 1 });
productSchema.index({ "category.hierarchy.style._id": 1 });
productSchema.index({ brand: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ "rating.average": -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ badge: 1 });
productSchema.index({ "colorVariants.colorName": 1 });
productSchema.index({ "colorVariants.sizeVariants.size": 1 });
productSchema.index({ salesCount: -1 });
productSchema.index({ viewCount: -1 });

// Compound indexes for category queries (backward compatible)
productSchema.index({ "category.main": 1, "category.sub": 1 });
productSchema.index({
  "category.main": 1,
  "category.sub": 1,
  status: 1,
});
productSchema.index({
  "category.main": 1,
  "category.sub": 1,
  "category.type": 1,
  status: 1,
});
productSchema.index({ status: 1, "rating.average": -1 });
productSchema.index({ status: 1, price: 1 });
productSchema.index({ status: 1, createdAt: -1 });

// Validation to ensure at least one size variant per color
colorVariantSchema.pre("validate", function (next) {
  if (this.sizeVariants && this.sizeVariants.length === 0) {
    return next(new Error("At least one size variant is required per color"));
  }
  next();
});

// Validation to ensure size or customSize is provided
sizeVariantSchema.pre("validate", function (next) {
  if (!this.size && !this.customSize) {
    return next(new Error("Either size or customSize must be provided"));
  }
  next();
});

// Generate slug before saving and handle category migration
productSchema.pre("save", function (next) {
  // Generate slug if not provided
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // Calculate total stock from all color and size variants
  if (this.colorVariants && this.colorVariants.length > 0) {
    this.stock = this.colorVariants.reduce((totalStock, colorVariant) => {
      const colorStock = colorVariant.sizeVariants.reduce(
        (sizeSum, sizeVariant) => {
          return sizeSum + (sizeVariant.stock || 0);
        },
        0
      );
      return totalStock + colorStock;
    }, 0);

    this.hasVariants = true;
  }

  // Set originalPrice if not set
  if (!this.originalPrice) {
    this.originalPrice = this.price;
  }

  // Build category structure for existing products (migration helper)
  if (this.isModified("category")) {
    this.buildCategoryStructure();
  }

  next();
});

// Method to build complete category structure
productSchema.methods.buildCategoryStructure = function () {
  // Build allLevels array
  this.category.allLevels = [];

  // Level 1 - Main Category
  if (this.category.main) {
    this.category.allLevels.push({
      level: 1,
      name: this.category.main,
      slug: this.category.main.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    });
  }

  // Level 2 - Subcategory
  if (this.category.sub) {
    this.category.allLevels.push({
      level: 2,
      name: this.category.sub,
      slug: this.category.sub.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    });
  }

  // Level 3 - Type
  if (this.category.type) {
    this.category.allLevels.push({
      level: 3,
      name: this.category.type,
      slug: this.category.type.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    });
  }

  // Level 4 - Variant
  if (this.category.variant) {
    this.category.allLevels.push({
      level: 4,
      name: this.category.variant,
      slug: this.category.variant.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    });
  }

  // Level 5 - Style
  if (this.category.style) {
    this.category.allLevels.push({
      level: 5,
      name: this.category.style,
      slug: this.category.style.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    });
  }

  // Build full path
  this.category.fullPath = this.category.allLevels
    .map((level) => level.slug)
    .join("/");
};

// Update vendor name when vendor changes
productSchema.pre("save", async function (next) {
  if (this.isModified("vendor")) {
    try {
      const User = mongoose.model("User");
      const vendor = await User.findById(this.vendor);
      if (vendor && vendor.vendorInfo) {
        this.vendorName = vendor.vendorInfo.shopName;
      }
    } catch (error) {
      console.error("Error updating vendor name:", error);
    }
  }
  next();
});

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }
  return 0;
});

// Virtual for availability status
productSchema.virtual("isAvailable").get(function () {
  return this.status === "active" && this.stock > 0;
});

// Virtual for category breadcrumb
productSchema.virtual("categoryBreadcrumb").get(function () {
  const breadcrumb = [];

  if (this.category.main)
    breadcrumb.push({ name: this.category.main, level: 1 });
  if (this.category.sub) breadcrumb.push({ name: this.category.sub, level: 2 });
  if (this.category.type)
    breadcrumb.push({ name: this.category.type, level: 3 });
  if (this.category.variant)
    breadcrumb.push({ name: this.category.variant, level: 4 });
  if (this.category.style)
    breadcrumb.push({ name: this.category.style, level: 5 });

  return breadcrumb;
});

// Method to get primary image for a specific color variant
productSchema.methods.getPrimaryImageForColor = function (colorIndex = 0) {
  if (!this.colorVariants || !this.colorVariants[colorIndex]) {
    return null;
  }

  const variant = this.colorVariants[colorIndex];
  const primaryImage = variant.images.find((img) => img.isPrimary);

  if (primaryImage) {
    return primaryImage;
  }

  // Fallback to first image if no primary is set
  if (variant.images.length > 0) {
    return variant.images[0];
  }

  return null;
};

// Method to get all primary images (one per color variant)
productSchema.methods.getAllPrimaryImages = function () {
  if (this.colorVariants && this.colorVariants.length > 0) {
    return this.colorVariants
      .map((variant) => {
        const primaryImage = variant.images.find((img) => img.isPrimary);
        return (
          primaryImage || (variant.images.length > 0 ? variant.images[0] : null)
        );
      })
      .filter(Boolean);
  }

  return [];
};

// Method to get first available primary image
productSchema.methods.getPrimaryImage = function () {
  return this.getPrimaryImageForColor(0);
};

// Method to get available sizes for a specific color
productSchema.methods.getAvailableSizesForColor = function (colorIndex = 0) {
  if (!this.colorVariants || !this.colorVariants[colorIndex]) {
    return [];
  }

  return this.colorVariants[colorIndex].sizeVariants
    .filter((sizeVariant) => sizeVariant.stock > 0)
    .map((sizeVariant) => ({
      size: sizeVariant.size || sizeVariant.customSize,
      stock: sizeVariant.stock,
      priceAdjustment: sizeVariant.priceAdjustment,
    }));
};

// Method to get all available colors
productSchema.methods.getAvailableColors = function () {
  if (!this.colorVariants || this.colorVariants.length === 0) {
    return [];
  }

  return this.colorVariants
    .filter((colorVariant) => {
      // Check if any size variant has stock
      return colorVariant.sizeVariants.some(
        (sizeVariant) => sizeVariant.stock > 0
      );
    })
    .map((colorVariant, index) => ({
      index,
      colorName: colorVariant.colorName,
      colorCode: colorVariant.colorCode,
      totalStock: colorVariant.sizeVariants.reduce(
        (sum, sizeVariant) => sum + sizeVariant.stock,
        0
      ),
      primaryImage:
        colorVariant.images.find((img) => img.isPrimary) ||
        colorVariant.images[0] ||
        null,
    }));
};

// Method to calculate final price for a specific size variant
productSchema.methods.getFinalPrice = function (colorIndex = 0, sizeIndex = 0) {
  if (
    !this.colorVariants ||
    !this.colorVariants[colorIndex] ||
    !this.colorVariants[colorIndex].sizeVariants ||
    !this.colorVariants[colorIndex].sizeVariants[sizeIndex]
  ) {
    return this.price;
  }

  const sizeVariant = this.colorVariants[colorIndex].sizeVariants[sizeIndex];
  return this.price + (sizeVariant.priceAdjustment || 0);
};

// Method to get total variants count
productSchema.methods.getTotalVariants = function () {
  if (!this.colorVariants || this.colorVariants.length === 0) {
    return 1; // The product itself is a variant
  }

  return this.colorVariants.reduce((total, colorVariant) => {
    return total + colorVariant.sizeVariants.length;
  }, 0);
};

// Method to get color variant by name
productSchema.methods.getColorVariantByName = function (colorName) {
  if (!this.colorVariants || this.colorVariants.length === 0) {
    return null;
  }

  return this.colorVariants.find(
    (variant) => variant.colorName.toLowerCase() === colorName.toLowerCase()
  );
};

// Method to check if a specific variant is in stock
productSchema.methods.isVariantInStock = function (colorIndex, sizeIndex) {
  if (
    !this.colorVariants ||
    !this.colorVariants[colorIndex] ||
    !this.colorVariants[colorIndex].sizeVariants ||
    !this.colorVariants[colorIndex].sizeVariants[sizeIndex]
  ) {
    return this.stock > 0; // Return product stock status if no variants
  }

  return this.colorVariants[colorIndex].sizeVariants[sizeIndex].stock > 0;
};

// Method to get category at specific level
productSchema.methods.getCategoryAtLevel = function (level) {
  const levelMap = {
    1: this.category.main,
    2: this.category.sub,
    3: this.category.type,
    4: this.category.variant,
    5: this.category.style,
  };

  return levelMap[level] || null;
};

// Method to get category reference at specific level
productSchema.methods.getCategoryReferenceAtLevel = function (level) {
  const levelMap = {
    1: this.category.hierarchy?.main,
    2: this.category.hierarchy?.subcategory,
    3: this.category.hierarchy?.type,
    4: this.category.hierarchy?.variant,
    5: this.category.hierarchy?.style,
  };

  return levelMap[level] || null;
};

// Static method to get products by category at any level
productSchema.statics.findByCategoryLevel = function (
  level,
  categoryNameOrId,
  options = {}
) {
  const query = {
    status: "active",
    ...options,
  };

  // Support both name and ID queries
  if (mongoose.Types.ObjectId.isValid(categoryNameOrId)) {
    // Query by category ID
    query[`category.allLevels._id`] = categoryNameOrId;
  } else {
    // Query by category name
    const levelFieldMap = {
      1: "category.main",
      2: "category.sub",
      3: "category.type",
      4: "category.variant",
      5: "category.style",
    };

    const fieldName = levelFieldMap[level];
    if (fieldName) {
      query[fieldName] = categoryNameOrId;
    }
  }

  return this.find(query);
};

// Static method to get products by main category (backward compatible)
productSchema.statics.findByCategory = function (
  mainCategory,
  subCategory = null,
  options = {}
) {
  const query = {
    "category.main": mainCategory,
    status: "active",
    ...options,
  };

  if (subCategory) {
    query["category.sub"] = subCategory;
  }

  return this.find(query);
};

// Static method to get products by main category
productSchema.statics.findByMainCategory = function (
  mainCategory,
  options = {}
) {
  return this.findByCategoryLevel(1, mainCategory, options);
};

// Static method to get products by subcategory
productSchema.statics.findBySubcategory = function (subcategory, options = {}) {
  return this.findByCategoryLevel(2, subcategory, options);
};

// Static method to get products by category path
productSchema.statics.findByCategoryPath = function (
  categoryPath,
  options = {}
) {
  const query = {
    "category.fullPath": new RegExp(`^${categoryPath}`),
    status: "active",
    ...options,
  };

  return this.find(query);
};

// Static method to get low stock products
productSchema.statics.findLowStock = function (vendorId = null) {
  const query = {
    status: "active",
    $expr: { $lte: ["$stock", "$lowStockThreshold"] },
  };

  if (vendorId) {
    query.vendor = vendorId;
  }

  return this.find(query);
};

// Static method to get products with complete category hierarchy
productSchema.statics.findWithCategoryHierarchy = function (query = {}) {
  return this.find(query).populate([
    {
      path: "category.hierarchy.main._id",
      select: "name slug description image",
    },
    {
      path: "category.hierarchy.subcategory._id",
      select: "name slug description",
    },
    { path: "category.hierarchy.type._id", select: "name slug description" },
    { path: "category.hierarchy.variant._id", select: "name slug description" },
    { path: "category.hierarchy.style._id", select: "name slug description" },
  ]);
};

// Static method to migrate existing products to new category structure
productSchema.statics.migrateCategoryStructure = async function () {
  const products = await this.find({
    $or: [
      { "category.allLevels": { $exists: false } },
      { "category.allLevels": { $size: 0 } },
      { "category.fullPath": { $exists: false } },
      { "category.fullPath": "" },
    ],
  });

  for (const product of products) {
    product.buildCategoryStructure();
    await product.save();
  }

  return { migrated: products.length };
};

// Ensure virtual fields are serialized
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
