const mongoose = require("mongoose");

const socialPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    caption: {
      type: String,
      required: [true, "Caption is required"],
      trim: true,
      maxlength: [500, "Caption cannot exceed 500 characters"],
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
    tags: [String],
    hashtags: [String],
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: [300, "Comment cannot exceed 300 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shares: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPublic: {
      type: Boolean,
      default: true,
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
    moderationNotes: String,
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
socialPostSchema.index({ user: 1 });
socialPostSchema.index({ product: 1 });
socialPostSchema.index({ createdAt: -1 });
socialPostSchema.index({ hashtags: 1 });
socialPostSchema.index({ isPublic: 1, isApproved: 1 });

// Virtual for like count
socialPostSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

// Virtual for comment count
socialPostSchema.virtual("commentCount").get(function () {
  return this.comments.length;
});

// Virtual for share count
socialPostSchema.virtual("shareCount").get(function () {
  return this.shares.length;
});

// Ensure virtuals are included in JSON
socialPostSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("SocialPost", socialPostSchema);
