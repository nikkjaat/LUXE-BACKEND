const mongoose = require("mongoose");

const searchAnalyticsSchema = new mongoose.Schema(
  {
    keyword: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    originalKeyword: {
      type: String,
      required: true,
      trim: true,
    },
    searchCount: {
      type: Number,
      default: 1,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    lastSearched: {
      type: Date,
      default: Date.now,
    },
    trending: {
      type: Boolean,
      default: false,
    },
    trendingScore: {
      type: Number,
      default: 0,
    },
    popularityScore: {
      type: Number,
      default: 0,
    },
    weeklySearches: {
      type: Number,
      default: 0,
    },
    synonyms: [
      {
        type: String,
        trim: true,
      },
    ],
    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  }
);

searchAnalyticsSchema.index({ keyword: 1 });
searchAnalyticsSchema.index({ searchCount: -1 });
searchAnalyticsSchema.index({ trending: -1, trendingScore: -1 });
searchAnalyticsSchema.index({ popularityScore: -1 });
searchAnalyticsSchema.index({ lastSearched: -1 });
searchAnalyticsSchema.index({ createdAt: -1 });

searchAnalyticsSchema.methods.calculatePopularityScore = function () {
  const daysSinceCreation = Math.max(
    1,
    (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const clickRate =
    this.searchCount > 0 ? this.clickCount / this.searchCount : 0;

  this.popularityScore =
    ((this.searchCount * 2 + this.clickCount * 5) / daysSinceCreation) *
    (1 + clickRate);

  return this.popularityScore;
};

searchAnalyticsSchema.methods.calculateTrendingScore = function () {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const timeSinceLastSearch = now - this.lastSearched.getTime();

  if (timeSinceLastSearch > SEVEN_DAYS) {
    this.trending = false;
    this.trendingScore = 0;
    return 0;
  }

  const recencyFactor = 1 - timeSinceLastSearch / SEVEN_DAYS;
  this.trendingScore = this.weeklySearches * recencyFactor;
  this.trending = this.trendingScore > 10;

  return this.trendingScore;
};

searchAnalyticsSchema.statics.recordSearch = async function (
  keyword,
  resultCount = 0,
  productIds = []
) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  const analytics = await this.findOneAndUpdate(
    { keyword: normalizedKeyword },
    {
      $inc: { searchCount: 1, weeklySearches: 1 },
      $set: {
        lastSearched: Date.now(),
        originalKeyword: keyword.trim(),
        resultCount,
      },
      $addToSet: { relatedProducts: { $each: productIds } },
    },
    { upsert: true, new: true }
  );

  analytics.calculatePopularityScore();
  analytics.calculateTrendingScore();
  await analytics.save();

  return analytics;
};

searchAnalyticsSchema.statics.recordClick = async function (
  keyword,
  productId = null
) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  const updateQuery = {
    $inc: { clickCount: 1 },
    $set: { lastSearched: Date.now() },
  };

  if (productId) {
    updateQuery.$addToSet = { relatedProducts: productId };
  }

  const analytics = await this.findOneAndUpdate(
    { keyword: normalizedKeyword },
    updateQuery,
    { new: true }
  );

  if (analytics) {
    analytics.calculatePopularityScore();
    await analytics.save();
  }

  return analytics;
};

searchAnalyticsSchema.statics.getTrendingKeywords = async function (
  limit = 10
) {
  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return this.find({
    lastSearched: { $gte: SEVEN_DAYS_AGO },
  })
    .sort({ weeklySearches: -1, trendingScore: -1 })
    .limit(limit)
    .select("keyword originalKeyword searchCount weeklySearches trendingScore");
};

searchAnalyticsSchema.statics.getPopularKeywords = async function (limit = 10) {
  return this.find({})
    .sort({ popularityScore: -1, searchCount: -1 })
    .limit(limit)
    .select("keyword originalKeyword searchCount clickCount popularityScore");
};

searchAnalyticsSchema.statics.cleanupOldSearches = async function () {
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await this.updateMany(
    { lastSearched: { $lt: THIRTY_DAYS_AGO } },
    { $set: { weeklySearches: 0, trending: false, trendingScore: 0 } }
  );
};

module.exports = mongoose.model("SearchAnalytics", searchAnalyticsSchema);
