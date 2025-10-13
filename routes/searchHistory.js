const express = require("express");
const router = express.Router();
const {
  addSearchHistory,
  addProductViewHistory,
  getSearchHistory,
  clearSearchHistory,
  deleteHistoryItem,
} = require("../controllers/searchHistoryController");
const isAuth = require("../middleware/isAuth");

router.post("/search", isAuth, addSearchHistory);
router.post("/product-view", isAuth, addProductViewHistory);
router.get("/", isAuth, getSearchHistory);
router.delete("/clear", isAuth, clearSearchHistory);
router.delete("/:id", isAuth, deleteHistoryItem);

module.exports = router;
