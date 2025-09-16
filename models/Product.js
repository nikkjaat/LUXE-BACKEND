const mongoose = require("mongoose");

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

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  secure_url: {
    type: String, // For Cloudinary URLs
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
  publicId: String, // For cloudinary or other image storage
});

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

const productSchema = new mongoose.Schema(
  {
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
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      // Removed enum to allow dynamic categories from CategoryContext
    },
    subcategory: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
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
      enum: ["active", "inactive"],
      default: "active",
    },
    specifications: {
      weight: {
        type: String, // Changed to String to match frontend (allows "1.5 kg")
        trim: true,
      },
      dimensions: {
        length: {
          type: String, // Changed to String for flexibility
          trim: true,
        },
        width: {
          type: String, // Changed to String for flexibility
          trim: true,
        },
        height: {
          type: String, // Changed to String for flexibility
          trim: true,
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
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    colorVariants: {
      type: [colorVariantSchema],
      required: true,
      validate: [
        {
          validator: function (v) {
            return v && v.length > 0;
          },
          message: "At least one color variant is required",
        },
      ],
    },

    // Calculated field - total stock from all size variants
    stock: {
      type: Number,
      default: 0,
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

    // Auto-generated fields
    slug: {
      type: String,
      unique: true,
      sparse: true,
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
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
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
  if (!this.sizeVariants || this.sizeVariants.length === 0) {
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
  return this.colorVariants
    .map((variant) => {
      const primaryImage = variant.images.find((img) => img.isPrimary);
      return (
        primaryImage || (variant.images.length > 0 ? variant.images[0] : null)
      );
    })
    .filter(Boolean);
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
  return this.colorVariants.reduce((total, colorVariant) => {
    return total + colorVariant.sizeVariants.length;
  }, 0);
};

// Method to get color variant by name
productSchema.methods.getColorVariantByName = function (colorName) {
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
    return false;
  }

  return this.colorVariants[colorIndex].sizeVariants[sizeIndex].stock > 0;
};

// Ensure virtual fields are serialized
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
