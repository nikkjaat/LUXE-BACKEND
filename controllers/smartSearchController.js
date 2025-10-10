const Product = require("../models/Product");
const Category = require("../models/Category");
const SearchAnalytics = require("../models/searchAnalytics");

const categoryNormalizationMap = {
  man: "men",
  mans: "men",
  men: "men",
  mens: "men",
  "men's": "men",
  male: "men",
  gents: "men",
  gentleman: "men",
  woman: "women",
  womans: "women",
  women: "women",
  womens: "women",
  "women's": "women",
  female: "women",
  ladies: "women",
  lady: "women",
  boy: "boys",
  boys: "boys",
  "boy's": "boys",
  lads: "boys",
  girl: "girls",
  girls: "girls",
  "girl's": "girls",
  kid: "kids",
  kids: "kids",
  "kid's": "kids",
  child: "kids",
  children: "kids",
  childrens: "kids",
  infant: "kids",
  toddler: "kids",
  baby: "kids",
  babies: "kids",
  toy: "toys",
  toys: "toys",
  electronic: "electronics",
  electronics: "electronics",
  appliance: "appliances",
  appliances: "appliances",
};

const productNameNormalizationMap = {
  tshirt: "t-shirt",
  tshirts: "t-shirt",
  "t shirt": "t-shirt",
  "t shirts": "t-shirt",
  tee: "t-shirt",
  tees: "t-shirt",
  jeans: "jeans",
  jean: "jeans",
  denim: "jeans",
  denims: "jeans",
  mobile: "phone",
  mobiles: "phone",
  cellphone: "phone",
  smartphone: "phone",
  smartphones: "phone",
  iphone: "phone",
  android: "phone",
  laptop: "laptop",
  laptops: "laptop",
  notebook: "laptop",
  notebooks: "laptop",
  macbook: "laptop",
  computer: "laptop",
  earphones: "headphones",
  earphone: "headphones",
  headphone: "headphones",
  earbuds: "headphones",
  earbud: "headphones",
  sneakers: "shoes",
  sneaker: "shoes",
  footwear: "shoes",
  sandal: "shoes",
  sandals: "shoes",
  flipflop: "shoes",
  flipflops: "shoes",
  slipper: "shoes",
  slippers: "shoes",
  boot: "shoes",
  boots: "shoes",
  shoe: "shoes",
  shirt: "shirt",
  shirts: "shirt",
  dress: "dress",
  dresses: "dress",
  gown: "dress",
  frock: "dress",
  saree: "saree",
  sarees: "saree",
  sari: "saree",
  saris: "saree",
  kurta: "kurta",
  kurtas: "kurta",
  kurti: "kurta",
  kurtis: "kurta",
  pant: "pants",
  pants: "pants",
  trouser: "pants",
  trousers: "pants",
  jacket: "jacket",
  jackets: "jacket",
  coat: "jacket",
  coats: "jacket",
  sweater: "sweater",
  sweaters: "sweater",
  pullover: "sweater",
  hoodie: "hoodie",
  hoodies: "hoodie",
  sweatshirt: "hoodie",
  sweatshirts: "hoodie",
  casual: "casual",
  watch: "watch",
  watches: "watch",
  wristwatch: "watch",
  timepiece: "watch",
  bag: "bag",
  bags: "bag",
  handbag: "bag",
  handbags: "bag",
  purse: "bag",
  purses: "bag",
  backpack: "bag",
  backpacks: "bag",
};

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
];

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
  toys: ["toy", "toys", "plaything", "playthings"],
  electronics: ["electronic", "electronics", "gadget", "gadgets"],
  appliances: ["appliance", "appliances"],
  unisex: ["unisex", "neutral", "gender-neutral"],
};

function normalizeSearchTerm(term, normalizationMap) {
  const lowerTerm = term.toLowerCase().trim();
  return normalizationMap[lowerTerm] || lowerTerm;
}

function tokenizeQuery(query) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return words.filter((word) => !stopWords.includes(word));
}

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

function buildWordBoundaryRegex(tokens, normalizationMap) {
  const normalizedTokens = tokens.map((token) =>
    normalizeSearchTerm(token, normalizationMap)
  );

  const uniqueTokens = [...new Set([...tokens, ...normalizedTokens])];

  const escapedTokens = uniqueTokens.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  return escapedTokens.map((token) => new RegExp(`\\b${token}\\b`, "i"));
}

// Enhanced search filter to check ALL category levels
function buildEnhancedSearchFilter(tokens, detectedPrimaryCategory) {
  const filter = {
    status: "active",
  };

  const productNameRegexes = buildWordBoundaryRegex(
    tokens,
    productNameNormalizationMap
  );
  const categoryRegexes = buildWordBoundaryRegex(
    tokens,
    categoryNormalizationMap
  );

  // Base search conditions for product fields (including color variants)
  const productSearchConditions = [
    { name: { $in: productNameRegexes } },
    { description: { $in: productNameRegexes } },
    { brand: { $in: productNameRegexes } },
    { tags: { $in: productNameRegexes } },
    { "colorVariants.colorName": { $in: productNameRegexes } },
    { "colorVariants.sizeVariants.size": { $in: productNameRegexes } },
    { "colorVariants.sizeVariants.customSize": { $in: productNameRegexes } },
  ];

  // Enhanced category search - check ALL 5 levels
  const categorySearchConditions = [
    { "category.main": { $in: categoryRegexes } },
    { "category.sub": { $in: categoryRegexes } },
    { "category.type": { $in: categoryRegexes } },
    { "category.variant": { $in: categoryRegexes } },
    { "category.style": { $in: categoryRegexes } },
    // Also search in allLevels array
    { "category.allLevels.name": { $in: categoryRegexes } },
    { "category.fullPath": { $in: categoryRegexes } },
  ];

  // If primary category is detected (like "men", "women", etc.)
  if (detectedPrimaryCategory) {
    const categoryConditions = primaryCategoryKeywords[
      detectedPrimaryCategory.category
    ].map((keyword) => ({
      "category.main": new RegExp(`\\b${keyword}\\b`, "i"),
    }));

    // Filter out primary category keyword from product search
    const productTokens = tokens.filter(
      (token) =>
        !primaryCategoryKeywords[detectedPrimaryCategory.category].includes(
          token
        )
    );

    if (productTokens.length === 0) {
      // Only category keyword - return all products from that category
      filter.$or = categoryConditions;
      return filter;
    }

    // Search in specific category AND match product/subcategory terms
    const specificProductRegexes = buildWordBoundaryRegex(
      productTokens,
      productNameNormalizationMap
    );

    const specificSearchConditions = [
      { name: { $in: specificProductRegexes } },
      { description: { $in: specificProductRegexes } },
      { brand: { $in: specificProductRegexes } },
      { tags: { $in: specificProductRegexes } },
      { "colorVariants.colorName": { $in: specificProductRegexes } },
      { "colorVariants.sizeVariants.size": { $in: specificProductRegexes } },
      {
        "colorVariants.sizeVariants.customSize": {
          $in: specificProductRegexes,
        },
      },
      // Check all subcategory levels
      { "category.sub": { $in: specificProductRegexes } },
      { "category.type": { $in: specificProductRegexes } },
      { "category.variant": { $in: specificProductRegexes } },
      { "category.style": { $in: specificProductRegexes } },
      { "category.allLevels.name": { $in: specificProductRegexes } },
    ];

    filter.$and = [
      { $or: categoryConditions },
      { $or: specificSearchConditions },
    ];

    return filter;
  }

  // No primary category detected - search everywhere
  filter.$or = [...productSearchConditions, ...categorySearchConditions];

  return filter;
}

function calculateRelevanceScore(product, tokens) {
  let score = 0;

  // Name matching (highest priority)
  const nameMatch = tokens.some((token) => {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    return regex.test(product.name);
  });
  if (nameMatch) score += 50;

  const exactNameMatch = tokens.every((token) => {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    return regex.test(product.name);
  });
  if (exactNameMatch) score += 30;

  // Brand matching
  const brandMatch = tokens.some((token) => {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    return regex.test(product.brand);
  });
  if (brandMatch) score += 20;

  // Tags matching
  const tagsMatch = product.tags?.some((tag) =>
    tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(tag);
    })
  );
  if (tagsMatch) score += 25;

  // Enhanced category matching - check ALL levels with different weights
  const categoryMatches = {
    main: tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(product.category?.main);
    }),
    sub: tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(product.category?.sub);
    }),
    type: tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(product.category?.type);
    }),
    variant: tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(product.category?.variant);
    }),
    style: tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(product.category?.style);
    }),
    allLevels: product.category?.allLevels?.some((level) =>
      tokens.some((token) => {
        const regex = new RegExp(`\\b${token}\\b`, "i");
        return regex.test(level.name);
      })
    ),
  };

  if (categoryMatches.main) score += 15;
  if (categoryMatches.sub) score += 12;
  if (categoryMatches.type) score += 10;
  if (categoryMatches.variant) score += 8;
  if (categoryMatches.style) score += 6;
  if (categoryMatches.allLevels) score += 5;

  // Color variant matching
  const colorVariantMatch = product.colorVariants?.some((variant) =>
    tokens.some((token) => {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      return regex.test(variant.colorName);
    })
  );
  if (colorVariantMatch) score += 15;

  // Description matching (lower priority)
  const descriptionMatch = tokens.some((token) => {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    return regex.test(product.description);
  });
  if (descriptionMatch) score += 8;

  // Performance metrics
  score += (product.rating?.average || 0) * 5;
  score += (product.salesCount || 0) * 0.1;
  score += (product.viewCount || 0) * 0.02;

  // Stock availability bonus
  if (product.stock > 0) score += 5;

  return score;
}

const smartSearchProducts = async (req, res) => {
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
      limit = 20,
    } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const query = q.trim();
    const tokens = tokenizeQuery(query);

    if (tokens.length === 0) {
      return res.json({
        success: true,
        query,
        products: [],
        total: 0,
        page: 1,
        pages: 0,
      });
    }

    const detectedPrimaryCategory = detectPrimaryCategoryFromQuery(tokens);

    // Use enhanced search filter
    let filter = buildEnhancedSearchFilter(tokens, detectedPrimaryCategory);

    // Apply additional filters
    if (mainCategory && mainCategory !== "all") {
      filter["category.main"] = new RegExp(`\\b${mainCategory}\\b`, "i");
    }
    if (subCategory && subCategory !== "all") {
      filter["category.sub"] = new RegExp(`\\b${subCategory}\\b`, "i");
    }
    if (category && category !== "all") {
      // Enhanced category filter - check all levels
      filter.$or = [
        { "category.main": new RegExp(`\\b${category}\\b`, "i") },
        { "category.sub": new RegExp(`\\b${category}\\b`, "i") },
        { "category.type": new RegExp(`\\b${category}\\b`, "i") },
        { "category.variant": new RegExp(`\\b${category}\\b`, "i") },
        { "category.style": new RegExp(`\\b${category}\\b`, "i") },
        { "category.allLevels.name": new RegExp(`\\b${category}\\b`, "i") },
      ];
    }

    if (brand) {
      filter.brand = new RegExp(`\\b${brand}\\b`, "i");
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (minRating) {
      filter["rating.average"] = { $gte: parseFloat(minRating) };
    }

    if (inStock === "true") {
      filter.stock = { $gt: 0 };
    }

    let products = await Product.find(filter)
      .populate("vendor", "vendorInfo.shopName")
      .lean();

    const productIds = products.map((p) => p._id);
    await SearchAnalytics.recordSearch(query, products.length, productIds);

    // Fallback: If no results found, do a broader search with partial matches
    if (products.length === 0) {
      const partialFilter = {
        status: "active",
        $or: [
          { name: { $regex: tokens.join("|"), $options: "i" } },
          { description: { $regex: tokens.join("|"), $options: "i" } },
          { brand: { $regex: tokens.join("|"), $options: "i" } },
          { tags: { $regex: tokens.join("|"), $options: "i" } },
          {
            "colorVariants.colorName": {
              $regex: tokens.join("|"),
              $options: "i",
            },
          },
          { "category.main": { $regex: tokens.join("|"), $options: "i" } },
          { "category.sub": { $regex: tokens.join("|"), $options: "i" } },
          { "category.type": { $regex: tokens.join("|"), $options: "i" } },
          { "category.variant": { $regex: tokens.join("|"), $options: "i" } },
          { "category.style": { $regex: tokens.join("|"), $options: "i" } },
          {
            "category.allLevels.name": {
              $regex: tokens.join("|"),
              $options: "i",
            },
          },
        ],
      };

      products = await Product.find(partialFilter)
        .populate("vendor", "vendorInfo.shopName")
        .limit(20)
        .lean();
    }

    products = products.map((product) => ({
      ...product,
      relevanceScore: calculateRelevanceScore(product, tokens),
    }));

    // Sorting
    if (sortBy === "relevance") {
      products.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else {
      switch (sortBy) {
        case "price-low":
          products.sort((a, b) => a.price - b.price);
          break;
        case "price-high":
          products.sort((a, b) => b.price - a.price);
          break;
        case "rating":
          products.sort(
            (a, b) =>
              (b.rating?.average || 0) - (a.rating?.average || 0) ||
              (b.rating?.count || 0) - (a.rating?.count || 0)
          );
          break;
        case "popularity":
          products.sort(
            (a, b) =>
              (b.salesCount || 0) - (a.salesCount || 0) ||
              (b.viewCount || 0) - (a.viewCount || 0)
          );
          break;
        case "newest":
          products.sort((a, b) => b.createdAt - a.createdAt);
          break;
      }
    }

    const total = products.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedProducts = products.slice(skip, skip + parseInt(limit));

    const availableBrands = [
      ...new Set(products.map((p) => p.brand).filter(Boolean)),
    ];
    const availableCategories = [
      ...new Set(products.map((p) => p.category?.main).filter(Boolean)),
    ];

    const priceRange = products.reduce(
      (range, p) => ({
        min: Math.min(range.min, p.price),
        max: Math.max(range.max, p.price),
      }),
      { min: Infinity, max: 0 }
    );

    // Generate suggestions if no results or very few results
    let suggestions = [];
    if (total < 5) {
      const suggestionsFilter = {
        status: "active",
        $or: [],
      };

      // Suggest based on partial keyword matches in all category levels
      tokens.forEach((token) => {
        const partialRegex = new RegExp(token, "i");
        suggestionsFilter.$or.push(
          { "category.main": partialRegex },
          { "category.sub": partialRegex },
          { "category.type": partialRegex },
          { "category.variant": partialRegex },
          { "category.style": partialRegex },
          { "category.allLevels.name": partialRegex },
          { name: partialRegex },
          { brand: partialRegex },
          { tags: partialRegex },
          { "colorVariants.colorName": partialRegex }
        );
      });

      const suggestedProducts = await Product.find(suggestionsFilter)
        .select("name category brand colorVariants")
        .limit(10)
        .lean();

      // Build category-based suggestions
      const categorySet = new Set();
      suggestedProducts.forEach((product) => {
        if (product.category?.main) categorySet.add(product.category.main);
        if (product.category?.sub) categorySet.add(product.category.sub);
        if (product.category?.type) categorySet.add(product.category.type);
        if (product.category?.variant)
          categorySet.add(product.category.variant);
        if (product.category?.style) categorySet.add(product.category.style);
        if (product.category?.allLevels) {
          product.category.allLevels.forEach((level) => {
            if (level.name) categorySet.add(level.name);
          });
        }
      });

      suggestions = Array.from(categorySet)
        .slice(0, 8)
        .map((cat) => ({
          type: "category",
          name: cat,
          display: cat,
        }));
    }

    res.json({
      success: true,
      query,
      detectedPrimaryCategory: detectedPrimaryCategory?.category || null,
      tokens,
      count: paginatedProducts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products: paginatedProducts,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      filters: {
        brands: availableBrands.slice(0, 10),
        categories: availableCategories,
        priceRange:
          priceRange.min === Infinity ? { min: 0, max: 0 } : priceRange,
      },
      searchMeta: {
        searchTerms: tokens,
        detectedPrimaryCategory: detectedPrimaryCategory?.category || null,
        hasFilters: !!(
          category ||
          brand ||
          minPrice ||
          maxPrice ||
          minRating ||
          inStock
        ),
        sortBy,
        isFallbackSearch: total > 0 && products.length > 0,
      },
    });
  } catch (error) {
    console.error("Smart search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
};

const smartSearchSuggestions = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      const trending = await SearchAnalytics.getTrendingKeywords(5);
      return res.json({
        success: true,
        suggestions: trending.map((t) => ({
          display: t.originalKeyword,
          type: "trending",
          count: t.weeklySearches,
        })),
      });
    }

    const query = q.trim();
    const tokens = tokenizeQuery(query);
    const detectedPrimaryCategory = detectPrimaryCategoryFromQuery(tokens);

    const suggestions = [];

    const trending = await SearchAnalytics.getTrendingKeywords(10);
    const matchingTrending = trending.filter((t) =>
      t.originalKeyword.toLowerCase().includes(query.toLowerCase())
    );

    matchingTrending.forEach((t) => {
      suggestions.push({
        display: t.originalKeyword,
        type: "trending",
        count: t.weeklySearches,
        trending: true,
      });
    });

    const productNameRegexes = buildWordBoundaryRegex(
      tokens,
      productNameNormalizationMap
    );

    let productFilter = {
      status: "active",
      $or: [
        { name: { $in: productNameRegexes } },
        { brand: { $in: productNameRegexes } },
        { tags: { $in: productNameRegexes } },
      ],
    };

    if (detectedPrimaryCategory) {
      const categoryConditions = primaryCategoryKeywords[
        detectedPrimaryCategory.category
      ].map((keyword) => ({
        "category.main": new RegExp(`\\b${keyword}\\b`, "i"),
      }));
      productFilter.$and = [
        productFilter.$or ? { $or: productFilter.$or } : {},
        { $or: categoryConditions },
      ];
      delete productFilter.$or;
    }

    const productSuggestions = await Product.find(productFilter)
      .select("name brand price category colorVariants")
      .sort({ viewCount: -1, salesCount: -1 })
      .limit(5)
      .lean();

    productSuggestions.forEach((product) => {
      const primaryImage = product.colorVariants?.[0]?.images?.[0]?.url || null;
      suggestions.push({
        display: product.name,
        type: "product",
        productId: product._id,
        brand: product.brand,
        price: product.price,
        image: primaryImage,
        category: `${product.category?.main || ""} > ${
          product.category?.sub || ""
        }`,
      });
    });

    // Enhanced category suggestions - search all levels
    const categoryRegexes = buildWordBoundaryRegex(
      tokens,
      categoryNormalizationMap
    );
    const categories = await Category.find({
      $or: [
        { name: { $in: categoryRegexes } },
        { "subcategories.name": { $in: categoryRegexes } },
      ],
      isActive: true,
    })
      .limit(3)
      .lean();

    categories.forEach((category) => {
      suggestions.push({
        display: category.name,
        type: "category",
        slug: category.slug,
        count: category.productCount || 0,
      });

      if (category.subcategories) {
        category.subcategories
          .filter((sub) =>
            categoryRegexes.some((regex) => regex.test(sub.name))
          )
          .slice(0, 2)
          .forEach((sub) => {
            suggestions.push({
              display: `${sub.name} in ${category.name}`,
              type: "subcategory",
              slug: sub.slug,
              parentCategory: category.slug,
              count: sub.productCount || 0,
            });
          });
      }
    });

    const uniqueSuggestions = suggestions.filter(
      (suggestion, index, self) =>
        index === self.findIndex((s) => s.display === suggestion.display)
    );

    res.json({
      success: true,
      suggestions: uniqueSuggestions.slice(0, parseInt(limit)),
      detectedPrimaryCategory: detectedPrimaryCategory?.category || null,
    });
  } catch (error) {
    console.error("Smart search suggestions error:", error);
    res.json({
      success: true,
      suggestions: [],
    });
  }
};

const smartSearchAutocomplete = async (req, res) => {
  try {
    const { q, limit = 8 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const query = q.trim();
    const tokens = tokenizeQuery(query);
    const detectedPrimaryCategory = detectPrimaryCategoryFromQuery(tokens);

    const productNameRegexes = buildWordBoundaryRegex(
      tokens,
      productNameNormalizationMap
    );

    let productNames = await Product.distinct("name", {
      name: { $in: productNameRegexes },
      status: "active",
    });

    if (detectedPrimaryCategory) {
      const categoryConditions = primaryCategoryKeywords[
        detectedPrimaryCategory.category
      ].map((keyword) => ({
        "category.main": new RegExp(`\\b${keyword}\\b`, "i"),
      }));

      productNames = await Product.distinct("name", {
        name: { $in: productNameRegexes },
        status: "active",
        $or: categoryConditions,
      });
    }

    const brandNames = await Product.distinct("brand", {
      brand: { $in: productNameRegexes },
      status: "active",
    });

    const categoryRegexes = buildWordBoundaryRegex(
      tokens,
      categoryNormalizationMap
    );
    const categoryNames = await Category.distinct("name", {
      name: { $in: categoryRegexes },
      isActive: true,
    });

    const allSuggestions = [
      ...productNames.slice(0, 4),
      ...brandNames.slice(0, 2),
      ...categoryNames.slice(0, 2),
    ];

    res.json({
      success: true,
      suggestions: allSuggestions.slice(0, parseInt(limit)),
      detectedPrimaryCategory: detectedPrimaryCategory?.category || null,
    });
  } catch (error) {
    console.error("Smart autocomplete error:", error);
    res.json({ success: true, suggestions: [] });
  }
};

module.exports = {
  smartSearchProducts,
  smartSearchSuggestions,
  smartSearchAutocomplete,
};
