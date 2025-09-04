const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
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
      enum: [
        "women",
        "men",
        "electronics",
        "beauty",
        "home",
        "accessories",
        "sports",
        "kids",
      ],
    },
    subcategory: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "active",
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
        "Featured",
        "Eco-Friendly",
        "Handmade",
      ],
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        name: String,
        size: Number,
        publicId: String,
        alt: String,
      },
    ],

    // Category-specific specifications stored as flexible object
    specifications: {
      // Common fields across categories
      size: [String], // For clothing, sports, kids
      color: [String], // All categories
      material: String, // Fashion, home, accessories, sports, kids
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      weight: Number,

      // Women's Fashion specific
      careInstructions: String,
      fitType: String, // Regular, Slim, Loose, Oversized, Tight
      occasion: [String], // Casual, Formal, Party, Work, Sports, Beach
      season: [String], // Spring, Summer, Fall, Winter, All Season

      // Men's Fashion specific
      collarType: String, // Regular, Button-down, Spread, Cutaway, Band

      // Electronics specific
      warranty: String, // 6 months, 1 year, 2 years, etc.
      connectivity: [String], // WiFi, Bluetooth, USB-C, etc.
      powerSource: String, // Battery, AC Adapter, USB, Solar, Rechargeable
      compatibility: String,
      batteryLife: String,

      // Beauty specific
      skinType: [String], // All Skin Types, Dry, Oily, Combination, etc.
      ingredients: String,
      volume: String, // 50ml, 100g
      shelfLife: String, // 6 months, 12 months, etc.
      application: String,
      benefits: [String], // Anti-aging, Moisturizing, Brightening, etc.
      crueltyFree: Boolean,
      vegan: Boolean,

      // Home & Living specific
      roomType: [String], // Living Room, Bedroom, Kitchen, etc.
      style: String, // Modern, Traditional, Contemporary, etc.
      assembly: Boolean,

      // Accessories specific
      closure: String, // Zipper, Magnetic, Buckle, etc.
      waterResistant: Boolean,
      giftWrapping: Boolean,

      // Sports & Fitness specific
      sportCategory: [String], // Running, Gym, Yoga, etc.
      features: [String], // Moisture Wicking, Breathable, etc.
      skillLevel: String, // Beginner, Intermediate, Advanced, etc.
      indoor: Boolean,
      outdoor: Boolean,

      // Kids & Baby specific
      ageGroup: String, // 0-6 months, 6-12 months, etc.
      safetyStandards: [String], // CE Certified, CPSIA Compliant, etc.
      washable: Boolean,
      chokeHazard: Boolean,
      educational: String,
    },

    // Tags for search and categorization
    tags: [String],

    // SEO fields
    seoTitle: String,
    seoDescription: String,
    seoKeywords: String,

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
    sku: {
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ category: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ "rating.average": -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ badge: 1 });
productSchema.index({ "specifications.size": 1 });
productSchema.index({ "specifications.color": 1 });

// Generate SKU before saving
productSchema.pre("save", function (next) {
  if (!this.sku) {
    this.sku = `LUX-${this.category.toUpperCase()}-${Date.now()}`;
  }
  next();
});

// Update vendor name when vendor changes
productSchema.pre("save", async function (next) {
  if (this.isModified("vendor")) {
    const User = mongoose.model("User");
    const vendor = await User.findById(this.vendor);
    if (vendor && vendor.vendorInfo) {
      this.vendorName = vendor.vendorInfo.shopName;
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

// Ensure virtual fields are serialized
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
