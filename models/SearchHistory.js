const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["search", "product_view"],
      required: true,
    },
    searchQuery: {
      type: String,
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    productName: String,
    productImage: String,
    productPrice: Number,
  },
  {
    timestamps: true,
  }
);

searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
