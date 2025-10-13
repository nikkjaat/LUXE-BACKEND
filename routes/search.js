const express = require("express");
const router = express.Router();
const {
  getSearchSuggestions,
  searchProducts,
  getPopularSearches,
  recordSearchClick,
  getSearchAnalytics,
} = require("../controllers/searchController");
const isAuth = require("../middleware/isAuth");

router.get("/suggestions", getSearchSuggestions);

router.get("/products", searchProducts);

router.get("/popular", getPopularSearches);

router.post("/click", recordSearchClick);

router.get("/analytics", isAuth, getSearchAnalytics);

module.exports = router;
