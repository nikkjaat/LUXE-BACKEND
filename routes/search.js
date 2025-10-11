const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Category = require("../models/Category");
const SearchAnalytics = require("../models/searchAnalytics");
const {
  smartSearchProducts,
  smartSearchSuggestions,
  smartSearchAutocomplete,
} = require("../controllers/smartSearchController");

const SYNONYMS_MAP = {
  cellphone: ["mobile", "phone", "smartphone"],
  mobile: ["cellphone", "phone", "smartphone"],
  smartphone: ["cellphone", "mobile", "phone"],
  laptop: ["notebook", "computer"],
  notebook: ["laptop", "computer"],
  shoes: ["footwear", "sneakers"],
  sneakers: ["shoes", "footwear"],
  dress: ["gown", "frock"],
  shirt: ["top", "tshirt", "t-shirt"],
  pants: ["trousers", "jeans"],
  watch: ["timepiece", "wristwatch"],
  bag: ["handbag", "purse"],
};

// NEW: Product type keywords for category matching
const productTypeKeywords = [
  "shirt",
  "shirts",
  "t-shirt",
  "t-shirts",
  "tshirt",
  "tshirts",
  "jeans",
  "pants",
  "trousers",
  "shorts",
  "jacket",
  "jackets",
  "coat",
  "coats",
  "sweater",
  "sweaters",
  "hoodie",
  "hoodies",
  "dress",
  "dresses",
  "skirt",
  "skirts",
  "blouse",
  "blouses",
  "watch",
  "watches",
  "clock",
  "clocks",
  "timepiece",
  "shoe",
  "shoes",
  "sneaker",
  "sneakers",
  "boot",
  "boots",
  "bag",
  "bags",
  "handbag",
  "handbags",
  "backpack",
  "backpacks",
  "phone",
  "phones",
  "mobile",
  "mobiles",
  "smartphone",
  "smartphones",
  "laptop",
  "laptops",
  "computer",
  "computers",
  "tablet",
  "tablets",
  "headphone",
  "headphones",
  "earphone",
  "earphones",
  "earbud",
  "earbuds",
  "camera",
  "cameras",
  "tv",
  "television",
  "televisions",
  "book",
  "books",
  "novel",
  "novels",
  "magazine",
  "magazines",
  "toy",
  "toys",
  "game",
  "games",
  "doll",
  "dolls",
];

// NEW: Primary category keywords
const primaryCategoryKeywords = {
  men: ["men", "male", "man", "mens", "men's", "mans", "gents", "gentleman"],
  women: [
    "women",
    "female",
    "woman",
    "womens",
    "women's",
    "womans",
    "ladies",
    "lady",
  ],
  boys: ["boys", "boy", "lads"],
  girls: ["girls", "girl"],
  kids: [
    "kids",
    "kid",
    "children",
    "child",
    "infant",
    "toddler",
    "baby",
    "babies",
  ],
};

// NEW: Stop words
const stopWords = [
  "for",
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "with",
  "of",
  "from",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
];

const getSynonyms = (word) => {
  const normalized = word.toLowerCase().trim();
  return SYNONYMS_MAP[normalized] || [];
};

// NEW: Tokenize query with stop words removal
function tokenizeQuery(query) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return words.filter((word) => !stopWords.includes(word));
}

// NEW: Detect primary category from query tokens
function detectPrimaryCategoryFromQuery(tokens) {
  for (const [category, keywords] of Object.entries(primaryCategoryKeywords)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword)) {
        return { category, keyword };
      }
    }
  }
  return null;
}

// NEW: Detect product type from query tokens
function detectProductTypeFromQuery(tokens) {
  for (const token of tokens) {
    if (productTypeKeywords.includes(token)) {
      return token;
    }
  }
  return null;
}

// NEW: Build enhanced search filter for legacy search
function buildEnhancedSearchFilter(tokens) {
  const filter = {
    status: "active",
  };

  const detectedPrimaryCategory = detectPrimaryCategoryFromQuery(tokens);
  const detectedProductType = detectProductTypeFromQuery(tokens);

  // If we have both a primary category AND a product type, use strict matching
  if (detectedPrimaryCategory && detectedProductType) {
    const categoryConditions = primaryCategoryKeywords[
      detectedPrimaryCategory.category
    ].map((keyword) => ({
      "category.main": new RegExp(`\\b${keyword}\\b`, "i"),
    }));

    // Build product type conditions - search in ALL category levels
    const productTypeConditions = [
      { "category.main": new RegExp(`\\b${detectedProductType}\\b`, "i") },
      { "category.sub": new RegExp(`\\b${detectedProductType}\\b`, "i") },
      { "category.type": new RegExp(`\\b${detectedProductType}\\b`, "i") },
      { "category.variant": new RegExp(`\\b${detectedProductType}\\b`, "i") },
      { "category.style": new RegExp(`\\b${detectedProductType}\\b`, "i") },
      {
        "category.allLevels.name": new RegExp(
          `\\b${detectedProductType}\\b`,
          "i"
        ),
      },
    ];

    // STRICT FILTER: Must match BOTH category AND product type in category hierarchy
    filter.$and = [
      { $or: categoryConditions }, // Must be in the detected category (men/women/etc.)
      { $or: productTypeConditions }, // Must have the product type in category
    ];

    return filter;
  }

  // Fallback to regular search if no category+product type combination detected
  const searchRegexes = tokens.map(
    (token) =>
      new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
  );

  filter.$or = [
    { name: { $in: searchRegexes } },
    { description: { $in: searchRegexes } },
    { brand: { $in: searchRegexes } },
    { tags: { $in: searchRegexes } },
    { "category.main": { $in: searchRegexes } },
    { "category.sub": { $in: searchRegexes } },
    { "category.type": { $in: searchRegexes } },
    { "category.variant": { $in: searchRegexes } },
    { "category.style": { $in: searchRegexes } },
    { "category.allLevels.name": { $in: searchRegexes } },
    { "colorVariants.colorName": { $in: searchRegexes } },
  ];

  return filter;
}

const getSearchSuggestions = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        suggestions: [],
      });
    }

    const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(`\\b${escapedQuery}`, "i");
    const suggestions = [];

    const searchTerms = q.trim().split(/\s+/);
    const allSynonyms = [];
    searchTerms.forEach((term) => {
      allSynonyms.push(...getSynonyms(term));
    });

    const expandedTerms = [q.trim(), ...allSynonyms];
    const expandedSearchRegexes = expandedTerms.map(
      (term) =>
        new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
    );

    const trendingKeywords = await SearchAnalytics.getTrendingKeywords(5);
    const matchingTrending = trendingKeywords.filter((kw) =>
      kw.originalKeyword.toLowerCase().includes(q.toLowerCase())
    );

    matchingTrending.forEach((trend) => {
      suggestions.push({
        display: trend.originalKeyword,
        name: trend.originalKeyword,
        type: "trending",
        count: trend.weeklySearches,
        trending: true,
      });
    });

    const productSuggestions = await Product.aggregate([
      {
        $match: {
          status: "active",
          $or: [
            { name: { $in: expandedSearchRegexes } },
            { description: { $in: expandedSearchRegexes } },
            { tags: { $in: expandedSearchRegexes } },
            { brand: { $in: expandedSearchRegexes } },
          ],
        },
      },
      {
        $addFields: {
          relevanceScore: {
            $add: [
              {
                $cond: [
                  { $regexMatch: { input: "$name", regex: q, options: "i" } },
                  50,
                  0,
                ],
              },
              { $multiply: ["$viewCount", 0.01] },
              { $multiply: ["$salesCount", 0.05] },
              { $multiply: ["$rating.average", 2] },
            ],
          },
        },
      },
      { $sort: { relevanceScore: -1, viewCount: -1 } },
      { $limit: 5 },
      {
        $project: {
          name: 1,
          price: 1,
          brand: 1,
          image: { $arrayElemAt: ["$colorVariants.images.url", 0] },
          category: 1,
        },
      },
    ]);

    productSuggestions.forEach((product) => {
      suggestions.push({
        display: product.name,
        name: product.name,
        type: "product",
        price: product.price,
        image: product.image,
        productId: product._id,
        brand: product.brand,
        category: `${product.category?.main || ""} > ${
          product.category?.sub || ""
        }`,
      });
    });

    const brandSuggestions = await Product.aggregate([
      {
        $match: {
          status: "active",
          brand: { $in: expandedSearchRegexes },
        },
      },
      {
        $group: {
          _id: "$brand",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 2 },
    ]);

    brandSuggestions.forEach((brand) => {
      suggestions.push({
        display: brand._id,
        name: brand._id,
        type: "brand",
        count: brand.count,
      });
    });

    const categories = await Category.find({
      $or: [{ name: searchRegex }, { "subcategories.name": searchRegex }],
      isActive: true,
    }).limit(3);

    categories.forEach((category) => {
      suggestions.push({
        display: category.name,
        name: category.name,
        type: "category",
        slug: category.slug,
        count: category.productCount || 0,
      });

      if (category.subcategories) {
        category.subcategories
          .filter((sub) => searchRegex.test(sub.name))
          .slice(0, 2)
          .forEach((sub) => {
            suggestions.push({
              display: `${sub.name} in ${category.name}`,
              name: sub.name,
              type: "subcategory",
              slug: sub.slug,
              parentCategory: category.slug,
              count: sub.productCount || 0,
            });
          });
      }
    });

    res.json({
      success: true,
      suggestions: suggestions.slice(0, parseInt(limit)),
    });
  } catch (error) {
    console.error("Search suggestions error:", error);
    res.json({
      success: true,
      suggestions: [],
    });
  }
};

const getPopularSearches = async (req, res) => {
  try {
    const { limit = 10, type = "all" } = req.query;

    let results = [];

    if (type === "trending" || type === "all") {
      const trending = await SearchAnalytics.getTrendingKeywords(5);
      results.push(
        ...trending.map((t) => ({
          keyword: t.originalKeyword,
          type: "trending",
          count: t.weeklySearches,
        }))
      );
    }

    if (type === "popular" || type === "all") {
      const popular = await SearchAnalytics.getPopularKeywords(5);
      results.push(
        ...popular.map((p) => ({
          keyword: p.originalKeyword,
          type: "popular",
          count: p.searchCount,
        }))
      );
    }

    if (type === "terms" || results.length === 0) {
      const popularProducts = await Product.aggregate([
        { $match: { status: "active" } },
        { $sort: { viewCount: -1, salesCount: -1 } },
        { $limit: 5 },
        { $project: { name: 1 } },
      ]);

      const popularCategories = await Category.aggregate([
        { $match: { isActive: true } },
        { $sort: { productCount: -1 } },
        { $limit: 3 },
        { $project: { name: 1 } },
      ]);

      results.push(
        ...popularProducts.map((p) => p.name),
        ...popularCategories.map((c) => c.name)
      );
    }

    const uniqueResults = [...new Set(results)];

    res.json({
      success: true,
      data: uniqueResults.slice(0, parseInt(limit)),
    });
  } catch (error) {
    console.error("Popular searches error:", error);
    res.json({
      success: true,
      data: ["luxury handbags", "smart watches", "winter fashion"],
    });
  }
};

// UPDATED: Legacy search products with enhanced category filtering
const searchProducts = async (req, res) => {
  try {
    const {
      q,
      category,
      mainCategory,
      subCategory,
      brand,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      sortBy = "relevance",
      page = 1,
      limit = 12,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { status: "active" };
    let sort = {};

    // NEW: Use enhanced search filter for queries
    if (q && q.trim()) {
      await SearchAnalytics.recordSearch(q.trim());

      const tokens = tokenizeQuery(q.trim());

      if (tokens.length > 0) {
        // Use the enhanced filter that handles category+product type combinations
        const enhancedFilter = buildEnhancedSearchFilter(tokens);
        Object.assign(query, enhancedFilter);
      } else {
        // Fallback to simple search if no meaningful tokens
        const searchRegex = new RegExp(
          q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { brand: searchRegex },
          { tags: searchRegex },
        ];
      }
    }

    // Apply additional filters (these work with the enhanced filter)
    if (mainCategory && mainCategory !== "all") {
      query["category.main"] = new RegExp(`\\b${mainCategory}\\b`, "i");
    }
    if (subCategory && subCategory !== "all") {
      query["category.sub"] = new RegExp(`\\b${subCategory}\\b`, "i");
    }
    if (category && category !== "all") {
      if (!query.$or) query.$or = [];
      query.$or.push(
        { "category.main": new RegExp(`\\b${category}\\b`, "i") },
        { "category.sub": new RegExp(`\\b${category}\\b`, "i") },
        { "category.type": new RegExp(`\\b${category}\\b`, "i") }
      );
    }

    if (brand) {
      query.brand = new RegExp(`\\b${brand}\\b`, "i");
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (minRating) {
      query["rating.average"] = { $gte: parseFloat(minRating) };
    }

    if (inStock === "true") {
      query.stock = { $gt: 0 };
    }

    // Set sort order
    switch (sortBy) {
      case "price-low":
        sort = { price: 1 };
        break;
      case "price-high":
        sort = { price: -1 };
        break;
      case "rating":
        sort = { "rating.average": -1, "rating.count": -1 };
        break;
      case "popularity":
        sort = { salesCount: -1, viewCount: -1 };
        break;
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "relevance":
      default:
        // For relevance, use a combination of factors
        sort = { salesCount: -1, "rating.average": -1, viewCount: -1 };
        break;
    }

    // Execute query
    const products = await Product.find(query)
      .populate("vendor", "vendorInfo.shopName")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    // Get filter aggregations
    const filterAggregations = await Product.aggregate([
      { $match: query },
      {
        $facet: {
          priceRange: [
            {
              $group: {
                _id: null,
                minPrice: { $min: "$price" },
                maxPrice: { $max: "$price" },
              },
            },
          ],
          brands: [
            { $group: { _id: "$brand", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          categories: [
            { $group: { _id: "$category.main", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
          ],
          ratings: [
            {
              $bucket: {
                groupBy: "$rating.average",
                boundaries: [0, 1, 2, 3, 4, 5],
                default: "unrated",
                output: { count: { $sum: 1 } },
              },
            },
          ],
        },
      },
    ]);

    // NEW: Detect what was searched for response metadata
    const tokens = q ? tokenizeQuery(q.trim()) : [];
    const detectedPrimaryCategory = detectPrimaryCategoryFromQuery(tokens);
    const detectedProductType = detectProductTypeFromQuery(tokens);

    res.json({
      success: true,
      query: q,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products,
      filters: filterAggregations[0] || {},
      searchMeta: {
        searchTerms: tokens,
        detectedPrimaryCategory: detectedPrimaryCategory?.category || null,
        detectedProductType: detectedProductType || null,
        hasFilters: !!(
          category ||
          brand ||
          minPrice ||
          maxPrice ||
          minRating ||
          inStock
        ),
        sortBy,
      },
    });
  } catch (error) {
    console.error("Product search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
};

const getSearchAutocomplete = async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(`\\b${escapedQuery}`, "i");

    const productCompletions = await Product.distinct("name", {
      name: searchRegex,
      status: "active",
    });

    const brandCompletions = await Product.distinct("brand", {
      brand: searchRegex,
      status: "active",
    });

    const categoryCompletions = await Category.distinct("name", {
      name: searchRegex,
      isActive: true,
    });

    const allCompletions = [
      ...productCompletions.slice(0, 3),
      ...brandCompletions.slice(0, 2),
      ...categoryCompletions.slice(0, 2),
    ];

    res.json({
      success: true,
      suggestions: allCompletions.slice(0, parseInt(limit)),
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    res.json({ success: true, suggestions: [] });
  }
};

const recordSearchClick = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (keyword) {
      await SearchAnalytics.recordClick(keyword);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Record click error:", error);
    res.json({ success: true });
  }
};

router.get("/suggestions", getSearchSuggestions);
router.get("/popular", getPopularSearches);
router.get("/products", searchProducts); // UPDATED with enhanced filtering
router.get("/autocomplete", getSearchAutocomplete);
router.post("/click", recordSearchClick);

// Smart search routes (keep these as they have the most advanced logic)
router.get("/smart/products", smartSearchProducts);
router.get("/smart/suggestions", smartSearchSuggestions);
router.get("/smart/autocomplete", smartSearchAutocomplete);

module.exports = router;
