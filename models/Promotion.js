const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Promotion title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Promotion description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    code: {
      type: String,
      required: [true, "Promotion code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, "Code cannot exceed 20 characters"],
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, "Maximum discount amount cannot be negative"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    usageLimit: {
      type: Number,
      min: [1, "Usage limit must be at least 1"],
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    userUsageLimit: {
      type: Number,
      default: 1,
      min: [1, "User usage limit must be at least 1"],
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableCategories: [String],
    excludedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usageCount: {
          type: Number,
          default: 1,
        },
        lastUsed: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
promotionSchema.index({ code: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });
promotionSchema.index({ isActive: 1 });

// Validation for end date
promotionSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("End date must be after start date"));
  }
  next();
});

// Check if promotion is currently valid
promotionSchema.methods.isValid = function () {
  const now = new Date();
  return (
    this.isActive &&
    this.startDate <= now &&
    this.endDate >= now &&
    (!this.usageLimit || this.usageCount < this.usageLimit)
  );
};

// Calculate discount amount
promotionSchema.methods.calculateDiscount = function (orderValue) {
  if (!this.isValid() || orderValue < this.minOrderValue) {
    return 0;
  }

  let discount = 0;
  if (this.discountType === "percentage") {
    discount = (orderValue * this.discountValue) / 100;
  } else {
    discount = this.discountValue;
  }

  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }

  return Math.min(discount, orderValue);
};

module.exports = mongoose.model("Promotion", promotionSchema);
