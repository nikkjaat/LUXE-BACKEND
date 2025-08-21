const mongoose = require("mongoose");

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
      enum: [
        "accessories",
        "women",
        "men",
        "home",
        "electronics",
        "beauty",
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
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: String,
        alt: String,
      },
    ],
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vendor is required"],
    },
    vendorName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "out_of_stock", "discontinued"],
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
      ],
    },
    specifications: {
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      material: String,
      color: [String],
      size: [String],
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
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
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
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
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ "rating.average": -1 });
productSchema.index({ createdAt: -1 });

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

module.exports = mongoose.model("Product", productSchema);
