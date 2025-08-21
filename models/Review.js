const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: [true, "Review title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    images: [
      {
        url: String,
        publicId: String,
        alt: String,
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    helpful: {
      type: Number,
      default: 0,
    },
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isApproved: {
      type: Boolean,
      default: true,
    },
    moderationNotes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Ensure one review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Update product rating after review save/update/delete
reviewSchema.post("save", async function () {
  await updateProductRating(this.product);
});

reviewSchema.post("remove", async function () {
  await updateProductRating(this.product);
});

async function updateProductRating(productId) {
  const Review = mongoose.model("Review");
  const Product = mongoose.model("Product");

  const stats = await Review.aggregate([
    { $match: { product: productId, isApproved: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const rating =
    stats.length > 0
      ? {
          average: Math.round(stats[0].averageRating * 10) / 10,
          count: stats[0].totalReviews,
        }
      : { average: 0, count: 0 };

  await Product.findByIdAndUpdate(productId, { rating });
}

module.exports = mongoose.model("Review", reviewSchema);
