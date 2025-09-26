const Product = require("../models/Product.js");
const Review = require("../models/Review.js");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../Utils/cloudinary.js");

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build query
    let query = { status: "active" };

    // Filter by category
    if (req.query.category && req.query.category !== "all") {
      query.category = req.query.category;
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Filter by rating
    if (req.query.minRating) {
      query["rating.average"] = { $gte: parseFloat(req.query.minRating) };
    }

    // Search by name or description
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Sort options
    let sort = {};
    switch (req.query.sort) {
      case "price-low":
        sort.price = 1;
        break;
      case "price-high":
        sort.price = -1;
        break;
      case "rating":
        sort["rating.average"] = -1;
        break;
      case "newest":
        sort.createdAt = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    const products = await Product.find(query)
      .populate("vendor", "vendorInfo.shopName")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("vendor", "vendorInfo.shopName vendorInfo.status")
      .populate({
        path: "reviews",
        populate: {
          path: "user",
          select: "name avatar",
        },
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Increment view count
    product.viewCount += 1;
    await product.save();

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Vendor)
// const createProduct = async (req, res, next) => {
//   try {
//     // Add vendor to req.body
//     req.body.vendor = req.user._id;
//     req.body.vendorName = req.user.vendorInfo.shopName;

//     // Parse specifications if it's a string
//     if (typeof req.body.specifications === "string") {
//       try {
//         req.body.specifications = JSON.parse(req.body.specifications);
//       } catch (err) {
//         console.error("Error parsing specifications:", err);
//         // Handle error or set to empty object
//         req.body.specifications = {};
//       }
//     }

//     // Parse tags if it's a string
//     if (typeof req.body.tags === "string") {
//       try {
//         req.body.tags = JSON.parse(req.body.tags);
//       } catch (err) {
//         console.error("Error parsing tags:", err);
//         req.body.tags = [];
//       }
//     }

//     // Convert price and originalPrice to numbers
//     req.body.price = Number(req.body.price);
//     req.body.originalPrice = Number(req.body.originalPrice);
//     req.body.stock = Number(req.body.stock);

//     // Handle image uploads
//     if (req.files && req.files.length > 0) {
//       const imageUploads = await Promise.all(
//         req.files.map((file) =>
//           uploadToCloudinary(file.buffer, "LUXE/products")
//         )
//       );
//       req.body.images = imageUploads.map((upload) => ({
//         url: upload.secure_url,
//         publicId: upload.public_id,
//       }));
//     }

//     const product = await Product.create(req.body);

//     // Update vendor's product count
//     req.user.vendorInfo.totalProducts += 1;
//     await req.user.save();

//     return res.status(201).json({
//       success: true,
//       product,
//     });
//   } catch (error) {
//     return res.status(400).json({
//       success: false,
//       message: error.message || "Failed to create product",
//       error: error,
//     });
//   }
// };
const createProduct = async (req, res, next) => {
  try {
    // Attach vendor data
    req.body.vendor = req.user._id;
    req.body.vendorName = req.user.vendorInfo.shopName;

    // Parse JSON fields coming as strings
    // Parse JSON fields coming as strings
    try {
      const parseJSONField = (field) => {
        if (req.body[field] && typeof req.body[field] === "string") {
          req.body[field] = JSON.parse(req.body[field]);
        }
      };

      [
        "tags",
        "colorVariants",
        "categoryFields",
        "commonSpecs",
        "category", // ✅ FIX added here
      ].forEach(parseJSONField);
    } catch (parseError) {
      console.error("Error parsing JSON fields:", parseError);
      return res.status(400).json({
        success: false,
        message:
          "Invalid JSON in tags, colorVariants, categoryFields, commonSpecs, or category",
      });
    }

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      console.log("Processing", req.files.length, "files");

      const uploadFolder = `LUXE/products/${req.user._id}/${Date.now()}`;

      if (!Array.isArray(req.body.colorVariants)) {
        req.body.colorVariants = [];
      }

      for (const file of req.files) {
        if (file.fieldname.startsWith("colorImages_")) {
          const colorIndex = parseInt(file.fieldname.split("_")[1]) || 0;

          if (!req.body.colorVariants[colorIndex]) {
            req.body.colorVariants[colorIndex] = {
              colorName: `Color ${colorIndex + 1}`,
              colorCode: "#000000",
              images: [],
              sizeVariants: [],
            };
          }

          if (!req.body.colorVariants[colorIndex].images) {
            req.body.colorVariants[colorIndex].images = [];
          }

          try {
            const uploadResult = await uploadToCloudinary(
              file.buffer,
              uploadFolder
            );

            const imageData = {
              url: uploadResult.secure_url,
              secure_url: uploadResult.secure_url, // schema has both
              publicId: uploadResult.public_id,
              alt: `${req.body.name || "Product"} - ${
                req.body.colorVariants[colorIndex].colorName ||
                `Color ${colorIndex + 1}`
              }`,
              isPrimary: req.body.colorVariants[colorIndex].images.length === 0,
            };

            req.body.colorVariants[colorIndex].images.push(imageData);
          } catch (uploadError) {
            console.error("Error uploading image:", uploadError);
          }
        }
      }
    }

    // Numeric fields
    req.body.price = parseFloat(req.body.price) || 0;
    req.body.originalPrice = parseFloat(req.body.originalPrice) || 0;

    // Validate and format color variants
    if (Array.isArray(req.body.colorVariants)) {
      for (let variant of req.body.colorVariants) {
        variant.colorName = variant.colorName?.trim() || "Unnamed Color";
        variant.colorCode = variant.colorCode || "#000000";

        variant.images = variant.images || [];

        if (!Array.isArray(variant.sizeVariants)) {
          variant.sizeVariants = [];
        }

        variant.sizeVariants = variant.sizeVariants.map((sizeVariant) => ({
          size: sizeVariant.size?.trim() || undefined,
          customSize: sizeVariant.customSize?.trim() || undefined,
          stock: parseInt(sizeVariant.stock) || 0,
          priceAdjustment: parseFloat(sizeVariant.priceAdjustment) || 0,
        }));

        if (variant.sizeVariants.length === 0) {
          return res.status(400).json({
            success: false,
            message: `Each color variant must have at least one size variant.`,
          });
        }

        const allValid = variant.sizeVariants.every(
          (sv) => sv.size || sv.customSize
        );

        if (!allValid) {
          return res.status(400).json({
            success: false,
            message: `Each size variant must have a size or customSize.`,
          });
        }
      }
    }

    // Total stock from variants
    req.body.stock = req.body.colorVariants.reduce((total, variant) => {
      const sizeStock = variant.sizeVariants.reduce(
        (sum, sv) => sum + (parseInt(sv.stock) || 0),
        0
      );
      return total + sizeStock;
    }, 0);

    // Create product
    const product = await Product.create(req.body);

    // Update vendor's totalProducts
    req.user.vendorInfo.totalProducts += 1;
    await req.user.save();

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Vendor - own products only)
const updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    let product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Authorization check
    if (
      req.user.role === "vendor" &&
      product.vendor.toString() !== req.user.id
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this product",
      });
    }

    // Parse the JSON strings from form data
    const colorVariantsData = JSON.parse(req.body.colorVariants || "[]");
    const categoryFields = JSON.parse(req.body.categoryFields || "{}");
    const commonSpecs = JSON.parse(req.body.commonSpecs || "{}");
    const tags = JSON.parse(req.body.tags || "[]");

    // Parse kept and deleted images from form data
    const keptImages = req.body.keptImages
      ? JSON.parse(req.body.keptImages)
      : [];
    const deletedImages = req.body.deletedImages
      ? JSON.parse(req.body.deletedImages)
      : [];

    // console.log("Kept Images:", keptImages);
    // console.log("Deleted Images:", deletedImages);

    // Handle deleted images first
    if (deletedImages.length > 0) {
      await Promise.all(
        deletedImages.map((image) =>
          image.publicId
            ? deleteFromCloudinary(image.publicId)
            : Promise.resolve()
        )
      );
    }

    // Handle image processing for each color variant
    // Handle image processing for each color variant
    const updatedColorVariants = await Promise.all(
      colorVariantsData.map(async (variant, colorIndex) => {
        let variantImages = [];

        // Filter kept images for this specific color variant
        const variantKeptImages = keptImages.filter(
          (img) => img.colorIndex === colorIndex
        );

        // Add kept images with their original primary status
        if (variantKeptImages.length > 0) {
          variantImages.push(
            ...variantKeptImages.map((img) => ({
              url: img.url || img.secure_url,
              secure_url: img.secure_url || img.url,
              alt: img.alt,
              isPrimary: img.isPrimary || false, // Preserve the primary status from frontend
              order: img.order || 0,
              publicId: img.publicId,
            }))
          );
        } else {
          // Fallback: if no kept images specified, keep existing images for this variant
          const existingVariantImages =
            product.colorVariants[colorIndex]?.images || [];
          variantImages = existingVariantImages.filter(
            (existingImg) =>
              !deletedImages.some(
                (deletedImg) => deletedImg.publicId === existingImg.publicId
              )
          );
        }

        // Process new image uploads for this color variant
        const colorVariantFiles = req.files
          ? req.files.filter((file) =>
              file.fieldname.startsWith(`colorImages_${colorIndex}`)
            )
          : [];

        if (colorVariantFiles.length > 0) {
          const newImages = await Promise.all(
            colorVariantFiles.map((file) =>
              uploadToCloudinary(file.buffer, "products")
            )
          );

          // Check if any existing image is already primary
          const hasExistingPrimary = variantImages.some((img) => img.isPrimary);

          // Process image metadata for new images
          newImages.forEach((upload, imageIndex) => {
            const metadataField = `imageMetadata_${colorIndex}_${imageIndex}`;
            const metadata = req.body[metadataField]
              ? JSON.parse(req.body[metadataField])
              : {};

            variantImages.push({
              url: upload.secure_url,
              secure_url: upload.secure_url,
              alt:
                metadata.alt ||
                `${req.body.name} - ${variant.colorName} - Image ${
                  variantImages.length + 1
                }`,
              isPrimary:
                metadata.isPrimary || (!hasExistingPrimary && imageIndex === 0),
              order: metadata.order || variantImages.length,
              publicId: upload.public_id,
            });
          });
        }

        // Ensure proper ordering
        variantImages = variantImages.map((img, index) => ({
          ...img,
          order: index,
        }));

        // Ensure only one primary image exists
        const primaryImages = variantImages.filter((img) => img.isPrimary);
        if (primaryImages.length > 1) {
          // If multiple primary images, keep only the first one as primary
          let foundPrimary = false;
          variantImages = variantImages.map((img) => ({
            ...img,
            isPrimary:
              !foundPrimary && img.isPrimary ? (foundPrimary = true) : false,
          }));
        } else if (variantImages.length > 0 && primaryImages.length === 0) {
          // If no primary image, set the first one as primary
          variantImages[0].isPrimary = true;
        }

        // console.log(
        //   `Final images for color ${colorIndex}:`,
        //   variantImages.map((img) => ({
        //     alt: img.alt,
        //     isPrimary: img.isPrimary,
        //     order: img.order,
        //   }))
        // );

        return {
          colorName: variant.colorName || "Default",
          colorCode: variant.colorCode || "#000000",
          images: variantImages,
          sizeVariants: (variant.sizeVariants || []).map((sizeVariant) => ({
            size: sizeVariant.size || "",
            customSize: sizeVariant.customSize || "",
            stock: parseInt(sizeVariant.stock || 0),
            priceAdjustment: parseFloat(sizeVariant.priceAdjustment || 0),
          })),
        };
      })
    );

    // Calculate total stock from all variants
    const totalStock = updatedColorVariants.reduce((sum, variant) => {
      const variantStock = (variant.sizeVariants || []).reduce(
        (sizeSum, sizeVariant) => sizeSum + (sizeVariant.stock || 0),
        0
      );
      return sum + variantStock;
    }, 0);

    // Prepare update data
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      category: JSON.parse(req.body.category || "{}"),
      originalPrice: Number(req.body.originalPrice || 0),
      brand: req.body.brand || "",
      badge: req.body.badge || "",
      status: req.body.status || "active",
      categoryFields,
      commonSpecs: {
        weight: commonSpecs.weight || { value: "", unit: "kg" },
        material: commonSpecs.material || "",
        warranty: commonSpecs.warranty || "",
        features: commonSpecs.features || [],
      },
      tags,
      colorVariants: updatedColorVariants,
      stock: totalStock,
      hasVariants: updatedColorVariants.length > 0,
    };

    // console.log("Update Data:", updateData);

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("vendor", "name email vendorInfo");

    res.status(200).json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Vendor - own products only)
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Make sure user is product owner
    if (
      req.user.role === "vendor" &&
      product.vendor.toString() !== req.user.id
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this product",
      });
    }

    // Delete images from cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(
        product.images.map((image) =>
          image.publicId
            ? deleteFromCloudinary(image.publicId)
            : Promise.resolve()
        )
      );
    }

    await product.deleteOne();

    // Update vendor's product count
    req.user.vendorInfo.totalProducts = Math.max(
      0,
      req.user.vendorInfo.totalProducts - 1
    );
    await req.user.save();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get products by vendor
// @route   GET /api/products/vendor/my-products
// @access  Private (Vendor)
const getProductsByVendor = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const products = await Product.find({ vendor: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({ vendor: req.user.id });

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res, next) => {
  try {
    const { q, category, minPrice, maxPrice, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    let query = { status: "active", isActive: true };

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Category filter
    if (category && category !== "all") {
      query.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Sort
    let sortOption = { createdAt: -1 };
    if (sort === "price-asc") sortOption = { price: 1 };
    if (sort === "price-desc") sortOption = { price: -1 };
    if (sort === "rating") sortOption = { "rating.average": -1 };

    const products = await Product.find(query)
      .populate("vendor", "vendorInfo.shopName")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product reviews
// @route   GET /api/products/:id/reviews
// @access  Public
const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({
      product: req.params.id,
      isApproved: true,
    })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private (User)
const addProductReview = async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product: req.params.id,
      user: req.user.id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    const review = await Review.create({
      rating,
      title,
      comment,
      product: req.params.id,
      user: req.user.id,
    });

    await review.populate("user", "name avatar");

    res.status(201).json({
      success: true,
      review,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product review
// @route   PUT /api/products/reviews/:reviewId
// @access  Private (User - own reviews only)
const updateProductReview = async (req, res, next) => {
  try {
    let review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Make sure user is review owner
    if (review.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this review",
      });
    }

    review = await Review.findByIdAndUpdate(req.params.reviewId, req.body, {
      new: true,
      runValidators: true,
    }).populate("user", "name avatar");

    res.status(200).json({
      success: true,
      review,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product review
// @route   DELETE /api/products/reviews/:reviewId
// @access  Private (User - own reviews only)
const deleteProductReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Make sure user is review owner
    if (review.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this review",
      });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByVendor,
  searchProducts,
  getProductReviews,
  addProductReview,
  updateProductReview,
  deleteProductReview,
};
