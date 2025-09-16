const mongoose = require("mongoose");

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
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    slug: {
      type: String,
      required: [true, "Route is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Route cannot exceed 100 characters"],
    },
    subcategories: [
      {
        type: String,
        trim: true,
      },
    ],
    productCount: {
      type: Number,
      default: 0,
      min: [0, "Product count cannot be negative"],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
