const Product = require("../models/Product");
const SearchAnalytics = require("../models/searchAnalytics");
const Category = require("../models/Category");

const levenshteinDistance = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
};

const calculateSimilarity = (str1, str2) => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
};

const fuzzyMatch = (searchTerm, targetText, threshold = 0.6) => {
  if (!searchTerm || !targetText) return false;

  const search = searchTerm.toLowerCase().trim();
  const target = targetText.toLowerCase().trim();

  if (target.includes(search)) return true;

  const searchWords = search.split(/\s+/);
  const targetWords = target.split(/\s+/);

  for (const searchWord of searchWords) {
    let found = false;
    for (const targetWord of targetWords) {
      if (calculateSimilarity(searchWord, targetWord) >= threshold) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return true;
};

const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(200).json({
        success: true,
        suggestions: [],
      });
    }

    const searchTerm = query.trim().toLowerCase();
    const suggestions = [];
    const seenItems = new Set();

    // First: Search in SearchAnalytics for matching keywords
    const analyticsSuggestions = await SearchAnalytics.find({
      $or: [
        { keyword: { $regex: searchTerm, $options: "i" } },
        { originalKeyword: { $regex: searchTerm, $options: "i" } },
        { synonyms: { $in: [new RegExp(searchTerm, "i")] } },
      ],
      searchCount: { $gte: 1 }, // Only include keywords that have been searched
    })
      .sort({
        searchCount: -1,
        popularityScore: -1,
        trendingScore: -1,
      })
      .limit(8)
      .select(
        "keyword originalKeyword searchCount clickCount trending trendingScore"
      )
      .lean();

    // Process analytics suggestions
    for (const analytics of analyticsSuggestions) {
      const displayText = analytics.originalKeyword || analytics.keyword;
      const key = `analytics:${displayText}`;

      if (!seenItems.has(key)) {
        suggestions.push({
          type: analytics.trending ? "trending" : "popular",
          display: displayText,
          name: displayText,
          count: analytics.searchCount,
          clickCount: analytics.clickCount,
          trending: analytics.trending,
          trendingScore: analytics.trendingScore,
          source: "analytics",
        });
        seenItems.add(key);
      }
    }

    // If we have enough suggestions from analytics, return them
    if (suggestions.length >= 8) {
      const limitedSuggestions = suggestions.slice(0, 10);
      return res.status(200).json({
        success: true,
        suggestions: limitedSuggestions,
        count: limitedSuggestions.length,
        source: "analytics",
      });
    }

    // Second: If not enough analytics suggestions, search in products and categories
    const searchBatches = [
      // Batch 1: Products by name and brand
      Product.find({
        status: "active",
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { brand: { $regex: searchTerm, $options: "i" } },
        ],
      })
        .select("name brand category price")
        .limit(6 - suggestions.length) // Adjust limit based on existing suggestions
        .lean(),

      // Batch 2: Categories
      Product.aggregate([
        {
          $match: {
            status: "active",
            $or: [
              { "category.main": { $regex: searchTerm, $options: "i" } },
              { "category.sub": { $regex: searchTerm, $options: "i" } },
              { "category.type": { $regex: searchTerm, $options: "i" } },
            ],
          },
        },
        {
          $group: {
            _id: {
              field: "$category.main",
              type: "main",
            },
            count: { $sum: 1 },
          },
        },
        { $limit: 4 - Math.ceil(suggestions.length / 2) },
      ]),

      // Batch 3: Tags
      Product.aggregate([
        {
          $match: {
            status: "active",
            tags: { $in: [new RegExp(searchTerm, "i")] },
          },
        },
        { $unwind: "$tags" },
        {
          $match: {
            tags: { $regex: searchTerm, $options: "i" },
          },
        },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 },
          },
        },
        { $limit: 3 - Math.ceil(suggestions.length / 3) },
      ]),
    ];

    const results = await Promise.all(searchBatches);

    // Process product results
    const productResults = results[0];
    for (const product of productResults) {
      const key = `product:${product.name}`;
      if (!seenItems.has(key) && suggestions.length < 10) {
        suggestions.push({
          type: "product",
          display: product.name,
          name: product.name,
          brand: product.brand,
          price: product.price,
          category: product.category?.main,
          source: "products",
        });
        seenItems.add(key);
      }
    }

    // Process category results
    const categoryResults = results[1];
    for (const category of categoryResults) {
      const key = `category:${category._id.field}`;
      if (!seenItems.has(key) && suggestions.length < 10) {
        suggestions.push({
          type: "category",
          display: category._id.field,
          name: category._id.field,
          level: category._id.type,
          count: category.count,
          source: "categories",
        });
        seenItems.add(key);
      }
    }

    // Process tag results
    const tagResults = results[2];
    for (const tag of tagResults) {
      const key = `tag:${tag._id}`;
      if (!seenItems.has(key) && suggestions.length < 10) {
        suggestions.push({
          type: "tag",
          display: tag._id,
          name: tag._id,
          count: tag.count,
          source: "tags",
        });
        seenItems.add(key);
      }
    }

    // Sort by relevance and priority
    suggestions.sort((a, b) => {
      // Priority: analytics suggestions first
      const sourceOrder = { analytics: 1, products: 2, categories: 3, tags: 4 };
      const aSource = sourceOrder[a.source] || 99;
      const bSource = sourceOrder[b.source] || 99;
      if (aSource !== bSource) return aSource - bSource;

      // Then by exact match
      const aExact = a.display.toLowerCase() === searchTerm;
      const bExact = b.display.toLowerCase() === searchTerm;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then by trending/popularity
      if (a.trendingScore && b.trendingScore) {
        return b.trendingScore - a.trendingScore;
      }
      if (a.count && b.count) {
        return b.count - a.count;
      }

      // Finally by type
      const typeOrder = {
        trending: 1,
        popular: 2,
        product: 3,
        category: 4,
        tag: 5,
      };
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });

    const limitedSuggestions = suggestions.slice(0, 10);

    return res.status(200).json({
      success: true,
      suggestions: limitedSuggestions,
      count: limitedSuggestions.length,
      source: suggestions.some((s) => s.source === "analytics")
        ? "analytics"
        : "database",
    });
  } catch (error) {
    console.error("Search suggestions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch search suggestions",
      error: error.message,
    });
  }
};

// Alternative approach: Try different search strategies
const searchProducts = async (req, res) => {
  try {
    const {
      query,
      page = 1,
      limit = 20,
      sortBy = "relevance",
      minPrice,
      maxPrice,
      brand,
      category,
      subcategory,
      rating,
      inStock,
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchTerm = query.trim().toLowerCase();
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    // Define stop words
    const stopWords = [
      "for",
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "of",
      "as",
      "with",
      "by",
    ];

    // Split search term into words and filter out stop words
    const searchWords = searchTerm
      .split(/\s+/)
      .filter(
        (word) => word.length > 0 && !stopWords.includes(word.toLowerCase())
      );

    // console.log("Search Words:", searchWords);
    // console.log("Original Query:", searchTerm);

    let searchQuery = {
      status: "active",
    };

    // Build search conditions for ALL words
    if (searchWords.length > 0) {
      // Create a condition for each word that must match in at least one field
      const wordConditions = searchWords.map((word) => {
        const wordRegex = new RegExp(`\\b${word}\\b`, "i"); // Word boundary for exact word matching
        return {
          $or: [
            { name: wordRegex },
            { brand: wordRegex },
            { "category.main": wordRegex },
            { "category.sub": wordRegex },
            { "category.type": wordRegex },
            { "category.variant": wordRegex },
            { "category.style": wordRegex },
            { tags: { $in: [wordRegex] } },
            { description: wordRegex },
            { badge: wordRegex },
            { "colorVariants.colorName": wordRegex },
            { "commonSpecs.material": wordRegex },
            { "commonSpecs.features": { $in: [wordRegex] } },
            { "categoryFields.fabric": wordRegex },
            { "categoryFields.occasion": wordRegex },
            { "categoryFields.fit": wordRegex },
            { "categoryFields.pattern": wordRegex },
            { "categoryFields.sleeveType": wordRegex },
            { "categoryFields.neckType": wordRegex },
          ],
        };
      });

      // Use $and to ensure ALL search words are found somewhere in the product
      searchQuery.$and = wordConditions;
    }

    // Additional filters
    if (inStock === "true") {
      searchQuery.stock = { $gt: 0 };
    }

    if (minPrice || maxPrice) {
      searchQuery.price = {};
      if (minPrice) searchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice);
    }

    if (brand) {
      searchQuery.brand = new RegExp(brand, "i");
    }

    if (category) {
      searchQuery["category.main"] = new RegExp(category, "i");
    }

    if (subcategory) {
      searchQuery["category.sub"] = new RegExp(subcategory, "i");
    }

    if (rating) {
      searchQuery["rating.average"] = { $gte: parseFloat(rating) };
    }

    // console.log("Final Search Query:", JSON.stringify(searchQuery, null, 2));

    let sortOptions = {};
    let findQuery = Product.find(searchQuery);

    switch (sortBy) {
      case "price_low":
        sortOptions = { price: 1 };
        break;
      case "price_high":
        sortOptions = { price: -1 };
        break;
      case "rating":
        sortOptions = { "rating.average": -1, "rating.count": -1 };
        break;
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      case "popularity":
        sortOptions = { salesCount: -1, viewCount: -1 };
        break;
      case "relevance":
      default:
        sortOptions = { salesCount: -1, "rating.average": -1 };
        break;
    }

    const products = await findQuery
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate("vendor", "vendorInfo.shopName")
      .lean();

    const totalCount = await Product.countDocuments(searchQuery);

    const productIds = products.map((p) => p._id);
    await SearchAnalytics.recordSearch(searchTerm, totalCount, productIds);

    // Get filters for sidebar
    const brands = await Product.distinct("brand", searchQuery);
    const categories = await Product.aggregate([
      { $match: searchQuery },
      {
        $group: {
          _id: {
            main: "$category.main",
            sub: "$category.sub",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const priceRange = await Product.aggregate([
      { $match: searchQuery },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      query: searchTerm,
      products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalProducts: totalCount,
        limit: limitNum,
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
      },
      filters: {
        brands: brands.slice(0, 20),
        categories: categories.slice(0, 10),
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
      },
      appliedFilters: {
        sortBy,
        minPrice,
        maxPrice,
        brand,
        category,
        subcategory,
        rating,
        inStock,
      },
    });
  } catch (error) {
    console.error("Product search error:", error);

    // Fallback to simple search if complex query fails
    try {
      console.log("Trying fallback search...");
      return await fallbackSearch(req, res);
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        message: "Failed to search products",
        error: error.message,
      });
    }
  }
};

// Fallback search function
const fallbackSearch = async (req, res) => {
  const {
    query,
    page = 1,
    limit = 20,
    sortBy = "relevance",
    minPrice,
    maxPrice,
    inStock,
  } = req.query;

  const searchTerm = query.trim().toLowerCase();
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const skip = (pageNum - 1) * limitNum;

  // Simple search query focusing on description and name
  const regex = new RegExp(searchTerm, "i");
  const searchQuery = {
    status: "active",
    $or: [
      { name: regex },
      { description: regex },
      { brand: regex },
      { "category.main": regex },
      { "category.sub": regex },
      { tags: { $in: [regex] } },
    ],
  };

  // Additional filters
  if (inStock === "true") {
    searchQuery.stock = { $gt: 0 };
  }

  if (minPrice || maxPrice) {
    searchQuery.price = {};
    if (minPrice) searchQuery.price.$gte = parseFloat(minPrice);
    if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice);
  }

  let sortOptions = {};
  switch (sortBy) {
    case "price_low":
      sortOptions = { price: 1 };
      break;
    case "price_high":
      sortOptions = { price: -1 };
      break;
    case "rating":
      sortOptions = { "rating.average": -1 };
      break;
    case "newest":
      sortOptions = { createdAt: -1 };
      break;
    case "popularity":
      sortOptions = { salesCount: -1 };
      break;
    default:
      sortOptions = { salesCount: -1, "rating.average": -1 };
      break;
  }

  const products = await Product.find(searchQuery)
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNum)
    .populate("vendor", "vendorInfo.shopName")
    .lean();

  const totalCount = await Product.countDocuments(searchQuery);

  return res.status(200).json({
    success: true,
    query: searchTerm,
    products,
    pagination: {
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalProducts: totalCount,
      limit: limitNum,
      hasNextPage: pageNum * limitNum < totalCount,
      hasPrevPage: pageNum > 1,
    },
    filters: {
      brands: await Product.distinct("brand", searchQuery),
      categories: await Product.aggregate([
        { $match: searchQuery },
        {
          $group: {
            _id: {
              main: "$category.main",
              sub: "$category.sub",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      priceRange: await Product.aggregate([
        { $match: searchQuery },
        {
          $group: {
            _id: null,
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
          },
        },
      ]).then((result) => result[0] || { minPrice: 0, maxPrice: 0 }),
    },
    appliedFilters: {
      sortBy,
      minPrice,
      maxPrice,
      inStock,
    },
    note: "Used fallback search",
  });
};

// Helper functions (same as before)
const applySorting = (products, sortType) => {
  const sorted = [...products];

  switch (sortType) {
    case "price_low":
      return sorted.sort((a, b) => a.price - b.price);
    case "price_high":
      return sorted.sort((a, b) => b.price - a.price);
    case "rating":
      return sorted.sort(
        (a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)
      );
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    case "popularity":
      return sorted.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    case "relevance":
    default:
      return sorted;
  }
};

const getCategoriesFromProducts = (products) => {
  const categoryMap = new Map();

  products.forEach((product) => {
    const key = `${product.category?.main}|${product.category?.sub}`;
    if (categoryMap.has(key)) {
      categoryMap.set(key, categoryMap.get(key) + 1);
    } else {
      categoryMap.set(key, 1);
    }
  });

  return Array.from(categoryMap.entries())
    .map(([key, count]) => {
      const [main, sub] = key.split("|");
      return {
        _id: { main, sub },
        count,
      };
    })
    .sort((a, b) => b.count - a.count);
};

const getPriceRangeFromProducts = (products) => {
  if (products.length === 0) {
    return { minPrice: 0, maxPrice: 0 };
  }

  const prices = products.map((p) => p.price).filter((price) => price != null);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
};

// Helper function to apply sorting to products array
// const applySorting = (products, sortType) => {
//   const sorted = [...products];

//   switch (sortType) {
//     case "price_low":
//       return sorted.sort((a, b) => a.price - b.price);
//     case "price_high":
//       return sorted.sort((a, b) => b.price - a.price);
//     case "rating":
//       return sorted.sort(
//         (a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)
//       );
//     case "newest":
//       return sorted.sort(
//         (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//       );
//     case "popularity":
//       return sorted.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
//     case "relevance":
//     default:
//       return sorted;
//   }
// };

// Helper function to get categories from products array
// const getCategoriesFromProducts = (products) => {
//   const categoryMap = new Map();

//   products.forEach((product) => {
//     const key = `${product.category?.main}|${product.category?.sub}`;
//     if (categoryMap.has(key)) {
//       categoryMap.set(key, categoryMap.get(key) + 1);
//     } else {
//       categoryMap.set(key, 1);
//     }
//   });

//   return Array.from(categoryMap.entries())
//     .map(([key, count]) => {
//       const [main, sub] = key.split("|");
//       return {
//         _id: { main, sub },
//         count,
//       };
//     })
//     .sort((a, b) => b.count - a.count);
// };

// Helper function to get price range from products array
// const getPriceRangeFromProducts = (products) => {
//   if (products.length === 0) {
//     return { minPrice: 0, maxPrice: 0 };
//   }

//   const prices = products.map((p) => p.price).filter((price) => price != null);
//   return {
//     minPrice: Math.min(...prices),
//     maxPrice: Math.max(...prices),
//   };
// };

// Fallback search function with simpler query
// const fallbackSearch = async (req, res) => {
//   const {
//     query,
//     page = 1,
//     limit = 20,
//     sortBy = "relevance",
//     minPrice,
//     maxPrice,
//     inStock,
//   } = req.query;

//   const searchTerm = query.trim().toLowerCase();
//   const pageNum = parseInt(page) || 1;
//   const limitNum = Math.min(parseInt(limit) || 20, 100);
//   const skip = (pageNum - 1) * limitNum;

//   // Simple search query
//   const searchQuery = {
//     status: "active",
//     $or: [
//       { name: { $regex: searchTerm, $options: "i" } },
//       { brand: { $regex: searchTerm, $options: "i" } },
//       { "category.main": { $regex: searchTerm, $options: "i" } },
//       { "category.sub": { $regex: searchTerm, $options: "i" } },
//       { tags: { $in: [new RegExp(searchTerm, "i")] } },
//     ],
//   };

//   // Additional filters
//   if (inStock === "true") {
//     searchQuery.stock = { $gt: 0 };
//   }

//   if (minPrice || maxPrice) {
//     searchQuery.price = {};
//     if (minPrice) searchQuery.price.$gte = parseFloat(minPrice);
//     if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice);
//   }

//   let sortOptions = {};
//   switch (sortBy) {
//     case "price_low":
//       sortOptions = { price: 1 };
//       break;
//     case "price_high":
//       sortOptions = { price: -1 };
//       break;
//     case "rating":
//       sortOptions = { "rating.average": -1 };
//       break;
//     case "newest":
//       sortOptions = { createdAt: -1 };
//       break;
//     case "popularity":
//       sortOptions = { salesCount: -1 };
//       break;
//     default:
//       sortOptions = { salesCount: -1, "rating.average": -1 };
//       break;
//   }

//   const products = await Product.find(searchQuery)
//     .sort(sortOptions)
//     .skip(skip)
//     .limit(limitNum)
//     .populate("vendor", "vendorInfo.shopName")
//     .lean();

//   const totalCount = await Product.countDocuments(searchQuery);

//   return res.status(200).json({
//     success: true,
//     query: searchTerm,
//     products,
//     pagination: {
//       currentPage: pageNum,
//       totalPages: Math.ceil(totalCount / limitNum),
//       totalProducts: totalCount,
//       limit: limitNum,
//       hasNextPage: pageNum * limitNum < totalCount,
//       hasPrevPage: pageNum > 1,
//     },
//     filters: {
//       brands: [],
//       categories: [],
//       priceRange: { minPrice: 0, maxPrice: 0 },
//     },
//     appliedFilters: {
//       sortBy,
//       minPrice,
//       maxPrice,
//       inStock,
//     },
//     note: "Used fallback search due to query complexity",
//   });
// };

const getPopularSearches = async (req, res) => {
  try {
    const { type = "terms", limit = 10 } = req.query;
    const limitNum = parseInt(limit) || 10;

    let searches;

    if (type === "trending") {
      searches = await SearchAnalytics.getTrendingKeywords(limitNum);
    } else {
      searches = await SearchAnalytics.getPopularKeywords(limitNum);
    }

    const data = searches.map((s) => s.originalKeyword || s.keyword);

    return res.status(200).json({
      success: true,
      type,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("Popular searches error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch popular searches",
      error: error.message,
    });
  }
};

const recordSearchClick = async (req, res) => {
  try {
    const { keyword, productId } = req.body;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "Keyword is required",
      });
    }

    await SearchAnalytics.recordClick(keyword, productId);

    return res.status(200).json({
      success: true,
      message: "Click recorded successfully",
    });
  } catch (error) {
    console.error("Record click error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record click",
      error: error.message,
    });
  }
};

const getSearchAnalytics = async (req, res) => {
  try {
    const { period = "week", limit = 20 } = req.query;
    const limitNum = parseInt(limit) || 20;

    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case "day":
        dateFilter = {
          lastSearched: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
        };
        break;
      case "week":
        dateFilter = {
          lastSearched: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        };
        break;
      case "month":
        dateFilter = {
          lastSearched: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
        };
        break;
    }

    const topSearches = await SearchAnalytics.find(dateFilter)
      .sort({ searchCount: -1 })
      .limit(limitNum)
      .select("keyword originalKeyword searchCount clickCount resultCount")
      .lean();

    const trendingSearches = await SearchAnalytics.find({
      ...dateFilter,
      trending: true,
    })
      .sort({ trendingScore: -1 })
      .limit(limitNum)
      .select("keyword originalKeyword trendingScore weeklySearches")
      .lean();

    const totalSearches = await SearchAnalytics.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: "$searchCount" },
          totalClicks: { $sum: "$clickCount" },
          uniqueSearches: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      period,
      analytics: {
        topSearches,
        trendingSearches,
        summary: totalSearches[0] || {
          totalSearches: 0,
          totalClicks: 0,
          uniqueSearches: 0,
        },
      },
    });
  } catch (error) {
    console.error("Search analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch search analytics",
      error: error.message,
    });
  }
};

module.exports = {
  getSearchSuggestions,
  searchProducts,
  getPopularSearches,
  recordSearchClick,
  getSearchAnalytics,
};
