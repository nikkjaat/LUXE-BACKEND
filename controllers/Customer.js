const User = require("../models/User");

exports.getCartItems = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
    const cartItems = await User.findById(userId).populate("cart.productId");
    // console.log("Cart items retrieved:", cartItems);

    res.status(200).json({
      message: "Cart items retrieved successfully",
      cartItems,
    });
  } catch (error) {
    console.error("❌ Error retrieving cart items:", error.message);
    res
      .status(500)
      .json({ message: "Failed to retrieve cart items", error: error.message });
  }
};

// Ultra-simple addToCart
exports.addToCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { id, quantity = 1 } = req.body;

    const cartItem = user.cart.find((item) => item.productId.equals(id));

    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      user.cart.push({ productId: id, quantity });
    }

    await user.save();
    await user.populate("cart.productId");

    res.json({ success: true, cartItems: user.cart });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating cart", error: error.message });
  }
};

// exports.addToCart = async (req, res, next) => {
//   try {
//     const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
//     let { id, quantity } = req.body;
//     console.log(id);
//     quantity = quantity || 1; // Default to 1 if quantity is not provided
//     // Find the user and update their cart
//     //if quantity is not provided, default to 1
//     // if product is already in cart, update quantity
//     const existingCartItem = await User.findOne({
//       _id: userId,
//       "cart.productId": id,
//     });
//     if (existingCartItem) {
//       const updatedUser = await User.findOneAndUpdate(
//         { _id: userId, "cart.productId": id },
//         { $inc: { "cart.$.quantity": quantity } },
//         { new: true }
//       ).populate("cart.productId");
//       console.log("Product quantity updated in cart:", updatedUser.cart);
//       return res.status(200).json({
//         success: true,
//         message: "Product quantity updated in cart successfully",
//         cartItems: updatedUser.cart,
//       });
//     }
//     // If product is not in cart, add it
//     const user = await User.findByIdAndUpdate(
//       userId,
//       {
//         $addToSet: {
//           cart: { productId: id, quantity: quantity },
//         },
//       },
//       { new: true }
//     ).populate("cart.productId");
//     // console.log("Product added to cart:", user.cart);
//     if (!user) {
//       return res.status(404).json({
//         message: "User not found",
//       });
//     }
//     res.status(200).json({
//       success: true,
//       message: "Product added to cart successfully",
//       cartItems: user.cart,
//     });
//   } catch (error) {
//     console.error("❌ Error adding to cart:", error.message);
//     res
//       .status(500)
//       .json({ message: "Failed to add product to cart", error: error.message });
//   }
// };

exports.updateQuantity = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
    const { id } = req.params;
    const { quantity } = req.body;
    // console.log(userId, id, quantity);
    // Find the user and update the quantity of the specified product in the cart
    const user = await User.findOneAndUpdate(
      { _id: userId, "cart._id": id },
      { $set: { "cart.$.quantity": quantity } },
      { new: true }
    ).populate("cart.productId");
    if (!user) {
      return res.status(404).json({
        message: "User or product not found in cart",
      });
    }
    res.status(200).json({
      success: true,
      message: "Cart item quantity updated successfully",
      cartItems: user.cart,
    });
  } catch (error) {
    console.error("❌ Error updating cart item quantity:", error.message);
    res.status(500).json({
      message: "Failed to update cart item quantity",
      error: error.message,
    });
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
    const { id } = req.params;

    // Find the user and update their cart
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $pull: {
          cart: { _id: id },
        },
      },
      { new: true }
    ).populate("cart.productId");

    res.status(200).json({
      success: true,
      message: "Product removed from cart successfully",
      cartItems: user.cart,
    });
  } catch (error) {
    console.error("❌ Error removing from cart:", error.message);
    res.status(500).json({
      message: "Failed to remove product from cart",
      error: error.message,
    });
  }
};

// Assuming getWishlistItems, addToWishlist, and removeFromWishlist are defined similarly
exports.getWishlistItems = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
    const wishlistItems = await User.findById(userId).populate(
      "wishlist.productId"
    );

    // console.log("Wishlist items retrieved:", wishlistItems);

    res.status(200).json({
      sucess: true,
      message: "Wishlist items retrieved successfully",
      wishlistItems,
    });
  } catch (error) {
    console.error("❌ Error retrieving wishlist items:", error.message);
    res.status(500).json({
      message: "Failed to retrieve wishlist items",
      error: error.message,
    });
  }
};
exports.addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
    const { id } = req.body;

    // Find the user and update their wishlist
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          wishlist: { productId: id },
        },
      },
      { new: true }
    ).populate("wishlist.productId");

    res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully",
      wishlistItems: user.wishlist,
    });
  } catch (error) {
    console.error("❌ Error adding to wishlist:", error.message);
    res.status(500).json({
      message: "Failed to add product to wishlist",
      error: error.message,
    });
  }
};

exports.removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming user ID is stored in req.user by isAuth middleware
    const { id } = req.params;

    // Find the user and update their wishlist
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $pull: {
          wishlist: { productId: id },
        },
      },
      { new: true }
    ).populate("wishlist.productId");

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      wishlistItems: user.wishlist,
    });
  } catch (error) {
    console.error("❌ Error removing from wishlist:", error.message);
    res.status(500).json({
      message: "Failed to remove product from wishlist",
      error: error.message,
    });
  }
};
