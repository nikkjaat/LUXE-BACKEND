const express = require("express");
const router = express.Router();

const {
  getCartItems,
  addToCart,
  updateQuantity,
  removeFromCart,
  getWishlistItems,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/Customer");
const isAuth = require("../middleware/isAuth");

// Define routes for customer-related operations

// cart operations
router.get("/cart", isAuth, getCartItems);
router.post("/addtocart", isAuth, addToCart);
router.put("/cart/update/:id", isAuth, updateQuantity); // Update quantity in cart
router.delete("/cart/remove/:id", isAuth, removeFromCart);

// wishlist operations
router.get("/wishlist", isAuth, getWishlistItems);
router.post("/wishlist/add", isAuth, addToWishlist);
router.delete("/wishlist/remove/:id", isAuth, removeFromWishlist);

// // order operations
// router.get("/orders", isAuth, getOrders);
// router.post("/orders", isAuth, createOrder);
// router.get("/orders/:id", isAuth, getOrderDetails);
// // review operations
// router.get("/reviews", isAuth, getReviews);
// router.post("/reviews", isAuth, createReview);
// router.get("/reviews/:id", isAuth, getReviewDetails);
// // address operations
// router.get("/addresses", isAuth, getAddresses);
// router.post("/addresses", isAuth, addAddress);
// router.put("/addresses/:id", isAuth, updateAddress);
// router.delete("/addresses/:id", isAuth, deleteAddress);
// // payment operations
// router.get("/payments", isAuth, getPaymentMethods);
// router.post("/payments", isAuth, addPaymentMethod);

module.exports = router;
