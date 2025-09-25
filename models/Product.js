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

    // Category Information
    category: {
      main: {
        type: String,
        required: [true, "Main category is required"],
        enum: [
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
        ],
      },
      sub: {
        type: String,
        required: [true, "Subcategory is required"],
        trim: true,
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
        value: Number,
        unit: {
          type: String,
          enum: ["kg", "g", "lb", "oz"],
        },
      },
      material: {
        type: String,
        trim: true,
      },
      warranty: {
        type: String,
        trim: true,
      },
      features: [
        {
          type: String,
          trim: true,
        },
      ],
    },

    // Variants
    colorVariants: [colorVariantSchema],
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
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    slug: {
      type: String,
      unique: true,
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

// Indexes for better query performance
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ "category.main": 1, "category.sub": 1 });
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

// Generate slug before saving
productSchema.pre("save", function (next) {
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

  next();
});

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

// Static method to get products by category
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

// Ensure virtual fields are serialized
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
