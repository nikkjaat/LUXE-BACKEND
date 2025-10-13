const SearchHistory = require("../models/SearchHistory");
const Product = require("../models/Product");

const addSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { searchQuery } = req.body;

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    await SearchHistory.create({
      userId,
      type: "search",
      searchQuery: searchQuery.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Search history recorded",
    });
  } catch (error) {
    console.error("Add search history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record search history",
      error: error.message,
    });
  }
};

const addProductViewHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Use findOneAndUpdate with upsert to update or create
    const result = await SearchHistory.findOneAndUpdate(
      {
        userId,
        type: "product_view",
        productId,
      },
      {
        $set: {
          productName: product.name,
          productImage: product.colorVariants[0].images?.[0]?.url || null,
          productPrice: product.price,
          createdAt: new Date(), // Update timestamp
          // move to index 0
        },
        $setOnInsert: {
          userId,
          type: "product_view",
          productId,
        },
      },
      {
        upsert: true, // Create if doesn't exist
        new: true, // Return updated document
        setDefaultsOnInsert: true, // Set default values on insert
      }
    );

    const action = result.isNew ? "created" : "updated";

    return res.status(200).json({
      success: true,
      message: `Product view history ${action}`,
      action,
    });
  } catch (error) {
    console.error("Add product view history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record product view history",
      error: error.message,
    });
  }
};

const getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const history = await SearchHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("productId", "name images price rating")
      .lean();

    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Get search history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch search history",
      error: error.message,
    });
  }
};

const clearSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await SearchHistory.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: "Search history cleared",
    });
  } catch (error) {
    console.error("Clear search history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear search history",
      error: error.message,
    });
  }
};

const deleteHistoryItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await SearchHistory.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "History item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "History item deleted",
    });
  } catch (error) {
    console.error("Delete history item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete history item",
      error: error.message,
    });
  }
};

module.exports = {
  addSearchHistory,
  addProductViewHistory,
  getSearchHistory,
  clearSearchHistory,
  deleteHistoryItem,
};
