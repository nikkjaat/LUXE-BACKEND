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

const getSynonyms = (word) => {
  const normalized = word.toLowerCase().trim();
  return SYNONYMS_MAP[normalized] || [];
};

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
    let aggregationPipeline = [];

    if (q && q.trim()) {
      await SearchAnalytics.recordSearch(q.trim());

      const searchTerms = q.trim().split(/\s+/);
      const allSynonyms = [];
      searchTerms.forEach((term) => {
        allSynonyms.push(...getSynonyms(term));
      });

      const expandedTerms = [...searchTerms, ...allSynonyms];

      const wordBoundaryRegexes = expandedTerms.map(
        (term) =>
          new RegExp(
            `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i"
          )
      );

      query.$or = [
        { name: { $in: wordBoundaryRegexes } },
        { description: { $in: wordBoundaryRegexes } },
        { brand: { $in: wordBoundaryRegexes } },
        { tags: { $in: wordBoundaryRegexes } },
        { "category.main": { $in: wordBoundaryRegexes } },
        { "category.sub": { $in: wordBoundaryRegexes } },
        { "colorVariants.colorName": { $in: wordBoundaryRegexes } },
      ];

      if (sortBy === "relevance") {
        aggregationPipeline = [
          { $match: query },
          {
            $addFields: {
              relevanceScore: {
                $add: [
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$name",
                          regex: q.trim(),
                          options: "i",
                        },
                      },
                      50,
                      0,
                    ],
                  },
                  {
                    $cond: [
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: "$tags",
                                as: "tag",
                                cond: {
                                  $regexMatch: {
                                    input: "$$tag",
                                    regex: q.trim(),
                                    options: "i",
                                  },
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      30,
                      0,
                    ],
                  },
                  {
                    $cond: [
                      {
                        $regexMatch: {
                          input: "$description",
                          regex: q.trim(),
                          options: "i",
                        },
                      },
                      10,
                      0,
                    ],
                  },
                  {
                    $cond: [
                      {
                        $or: [
                          {
                            $regexMatch: {
                              input: "$category.main",
                              regex: q.trim(),
                              options: "i",
                            },
                          },
                          {
                            $regexMatch: {
                              input: "$category.sub",
                              regex: q.trim(),
                              options: "i",
                            },
                          },
                        ],
                      },
                      10,
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
          { $sort: { relevanceScore: -1, "rating.average": -1 } },
        ];
      }
    }

    if (category && category !== "all") {
      const categoryRegex = new RegExp(
        `\\b${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
      if (!query.$or) query.$or = [];
      query.$or.push(
        { "category.main": categoryRegex },
        { "category.sub": categoryRegex }
      );
    }
    if (mainCategory && mainCategory !== "all") {
      query["category.main"] = new RegExp(
        `\\b${mainCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
    }
    if (subCategory) {
      query["category.sub"] = new RegExp(
        `\\b${subCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
    }

    if (brand) {
      query.brand = new RegExp(
        `\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      );
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

    if (sortBy !== "relevance") {
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
        default:
          sort = { "rating.average": -1, createdAt: -1 };
      }
    }

    let products;
    let total;

    if (aggregationPipeline.length > 0) {
      const countPipeline = [...aggregationPipeline, { $count: "total" }];
      const countResult = await Product.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      products = await Product.aggregate([
        ...aggregationPipeline,
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: "users",
            localField: "vendor",
            foreignField: "_id",
            as: "vendorData",
          },
        },
        {
          $addFields: {
            vendor: { $arrayElemAt: ["$vendorData", 0] },
          },
        },
        {
          $project: {
            vendorData: 0,
          },
        },
      ]);
    } else {
      products = await Product.find(query)
        .populate("vendor", "vendorInfo.shopName")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      total = await Product.countDocuments(query);
    }

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
        searchTerms: q ? q.trim().split(/\s+/) : [],
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
router.get("/products", searchProducts);
router.get("/autocomplete", getSearchAutocomplete);
router.post("/click", recordSearchClick);

router.get("/smart/products", smartSearchProducts);
router.get("/smart/suggestions", smartSearchSuggestions);
router.get("/smart/autocomplete", smartSearchAutocomplete);

module.exports = router;
