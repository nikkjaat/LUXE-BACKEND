const Product = require("../models/Product.js");
const Review = require("../models/Review.js");
const Category = require("../models/Category.js");
const mongoose = require("mongoose");

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

    // Track product view in search analytics if there's a search query
    const searchQuery = req.query.q || req.query.from;
    if (searchQuery) {
      const SearchAnalytics = require("../models/searchAnalytics");
      await SearchAnalytics.recordClick(searchQuery, product._id);
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to build complete category structure
// const buildCategoryStructure = async (categoryData) => {
//   try {
//     // const Category = mongoose.model("Category");

//     const hierarchy = {
//       main: null,
//       subcategory: null,
//       type: null,
//       variant: null,
//       style: null,
//     };

//     const allLevels = [];

//     // Level 1 - Main Category
//     if (categoryData.main) {
//       // Try to find the main category in database
//       const mainCategory = await Category.findOne({
//         name: categoryData.main,
//         level: 1,
//       }).select("_id name slug level hierarchyLevel");

//       if (mainCategory) {
//         hierarchy.main = {
//           _id: mainCategory._id,
//           name: mainCategory.name,
//           slug: mainCategory.slug,
//           level: mainCategory.level,
//           hierarchyLevel: mainCategory.hierarchyLevel,
//         };
//       } else {
//         // Fallback: create reference from provided data
//         hierarchy.main = {
//           _id: new mongoose.Types.ObjectId(), // Temporary ID
//           name: categoryData.main,
//           slug: categoryData.main.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//           level: 1,
//           hierarchyLevel: "main",
//         };
//       }

//       allLevels.push({
//         level: 1,
//         name: categoryData.main,
//         slug: hierarchy.main.slug,
//         _id: hierarchy.main._id,
//       });
//     }

//     // Level 2 - Subcategory
//     if (categoryData.sub) {
//       const subcategory = await Category.findOne({
//         name: categoryData.sub,
//         level: 2,
//       }).select("_id name slug level hierarchyLevel");

//       if (subcategory) {
//         hierarchy.subcategory = {
//           _id: subcategory._id,
//           name: subcategory.name,
//           slug: subcategory.slug,
//           level: subcategory.level,
//           hierarchyLevel: subcategory.hierarchyLevel,
//         };
//       } else {
//         hierarchy.subcategory = {
//           _id: new mongoose.Types.ObjectId(),
//           name: categoryData.sub,
//           slug: categoryData.sub.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//           level: 2,
//           hierarchyLevel: "subcategory",
//         };
//       }

//       allLevels.push({
//         level: 2,
//         name: categoryData.sub,
//         slug: hierarchy.subcategory.slug,
//         _id: hierarchy.subcategory._id,
//       });
//     }

//     // Level 3 - Type (optional)
//     if (categoryData.type) {
//       const typeCategory = await Category.findOne({
//         name: categoryData.type,
//         level: 3,
//       }).select("_id name slug level hierarchyLevel");

//       if (typeCategory) {
//         hierarchy.type = {
//           _id: typeCategory._id,
//           name: typeCategory.name,
//           slug: typeCategory.slug,
//           level: typeCategory.level,
//           hierarchyLevel: typeCategory.hierarchyLevel,
//         };
//       } else {
//         hierarchy.type = {
//           _id: new mongoose.Types.ObjectId(),
//           name: categoryData.type,
//           slug: categoryData.type.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//           level: 3,
//           hierarchyLevel: "type",
//         };
//       }

//       allLevels.push({
//         level: 3,
//         name: categoryData.type,
//         slug: hierarchy.type.slug,
//         _id: hierarchy.type._id,
//       });
//     }

//     // Level 4 - Variant (optional)
//     if (categoryData.variant) {
//       const variantCategory = await Category.findOne({
//         name: categoryData.variant,
//         level: 4,
//       }).select("_id name slug level hierarchyLevel");

//       if (variantCategory) {
//         hierarchy.variant = {
//           _id: variantCategory._id,
//           name: variantCategory.name,
//           slug: variantCategory.slug,
//           level: variantCategory.level,
//           hierarchyLevel: variantCategory.hierarchyLevel,
//         };
//       } else {
//         hierarchy.variant = {
//           _id: new mongoose.Types.ObjectId(),
//           name: categoryData.variant,
//           slug: categoryData.variant.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//           level: 4,
//           hierarchyLevel: "variant",
//         };
//       }

//       allLevels.push({
//         level: 4,
//         name: categoryData.variant,
//         slug: hierarchy.variant.slug,
//         _id: hierarchy.variant._id,
//       });
//     }

//     // Level 5 - Style (optional)
//     if (categoryData.style) {
//       const styleCategory = await Category.findOne({
//         name: categoryData.style,
//         level: 5,
//       }).select("_id name slug level hierarchyLevel");

//       if (styleCategory) {
//         hierarchy.style = {
//           _id: styleCategory._id,
//           name: styleCategory.name,
//           slug: styleCategory.slug,
//           level: styleCategory.level,
//           hierarchyLevel: styleCategory.hierarchyLevel,
//         };
//       } else {
//         hierarchy.style = {
//           _id: new mongoose.Types.ObjectId(),
//           name: categoryData.style,
//           slug: categoryData.style.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//           level: 5,
//           hierarchyLevel: "style",
//         };
//       }

//       allLevels.push({
//         level: 5,
//         name: categoryData.style,
//         slug: hierarchy.style.slug,
//         _id: hierarchy.style._id,
//       });
//     }

//     // Build full path
//     const fullPath = allLevels.map((level) => level.slug).join("/");

//     return {
//       hierarchy,
//       main: categoryData.main,
//       sub: categoryData.sub,
//       type: categoryData.type || "",
//       variant: categoryData.variant || "",
//       style: categoryData.style || "",
//       fullPath,
//       allLevels,
//     };
//   } catch (error) {
//     console.error("Error building category structure:", error);

//     // Fallback: create basic structure without database lookup
//     const allLevels = [];

//     if (categoryData.main) {
//       allLevels.push({
//         level: 1,
//         name: categoryData.main,
//         slug: categoryData.main.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//       });
//     }

//     if (categoryData.sub) {
//       allLevels.push({
//         level: 2,
//         name: categoryData.sub,
//         slug: categoryData.sub.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//       });
//     }

//     if (categoryData.type) {
//       allLevels.push({
//         level: 3,
//         name: categoryData.type,
//         slug: categoryData.type.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//       });
//     }

//     if (categoryData.variant) {
//       allLevels.push({
//         level: 4,
//         name: categoryData.variant,
//         slug: categoryData.variant.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//       });
//     }

//     if (categoryData.style) {
//       allLevels.push({
//         level: 5,
//         name: categoryData.style,
//         slug: categoryData.style.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
//       });
//     }

//     const fullPath = allLevels.map((level) => level.slug).join("/");

//     return {
//       hierarchy: {
//         main: null,
//         subcategory: null,
//         type: null,
//         variant: null,
//         style: null,
//       },
//       main: categoryData.main,
//       sub: categoryData.sub,
//       type: categoryData.type || "",
//       variant: categoryData.variant || "",
//       style: categoryData.style || "",
//       fullPath,
//       allLevels,
//     };
//   }
// };

const buildCategoryStructure = async (categoryData) => {
  try {
    const hierarchy = {
      main: null,
      subcategory: null,
      type: null,
      variant: null,
      style: null,
    };

    const allLevels = [];

    // Level 1 - Main Category
    if (categoryData.main) {
      // Try to find the main category in database
      const mainCategory = await Category.findOne({
        name: categoryData.main,
        level: 1,
      }).select(
        "_id name slug level hierarchyLevel productCount isActive sortOrder fullPath"
      );

      if (mainCategory) {
        hierarchy.main = {
          _id: mainCategory._id,
          name: mainCategory.name,
          slug: mainCategory.slug,
          level: mainCategory.level,
          hierarchyLevel: mainCategory.hierarchyLevel,
          productCount: mainCategory.productCount,
          isActive: mainCategory.isActive,
          sortOrder: mainCategory.sortOrder,
          fullPath: mainCategory.fullPath,
        };
      } else {
        // Fallback: create reference from provided data
        hierarchy.main = {
          _id: new mongoose.Types.ObjectId(),
          name: categoryData.main,
          slug: categoryData.main.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          level: 1,
          hierarchyLevel: "main",
          productCount: 0,
          isActive: true,
          sortOrder: 0,
          fullPath: categoryData.main.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        };
      }

      allLevels.push({
        level: 1,
        name: categoryData.main,
        slug: hierarchy.main.slug,
        _id: hierarchy.main._id,
        hierarchyLevel: "main",
      });
    }

    // Level 2 - Subcategory
    if (categoryData.sub) {
      // Search for subcategory within main category's subcategories
      let subcategory = null;

      if (hierarchy.main && hierarchy.main._id) {
        const mainCategoryWithSubs = await Category.findOne({
          _id: hierarchy.main._id,
          level: 1,
        }).select("subcategories");

        if (mainCategoryWithSubs && mainCategoryWithSubs.subcategories) {
          subcategory = mainCategoryWithSubs.subcategories.find(
            (sub) => sub.name === categoryData.sub
          );
        }
      }

      // If not found in main category, try general search
      if (!subcategory) {
        const foundSubcategory = await Category.findOne({
          name: categoryData.sub,
          level: 2,
        }).select(
          "_id name slug level hierarchyLevel productCount isActive sortOrder"
        );

        if (foundSubcategory) {
          subcategory = foundSubcategory;
        }
      }

      if (subcategory) {
        hierarchy.subcategory = {
          _id: subcategory._id,
          name: subcategory.name,
          slug: subcategory.slug,
          level: subcategory.level || 2,
          hierarchyLevel: subcategory.hierarchyLevel || "subcategory",
          productCount: subcategory.productCount || 0,
          isActive: subcategory.isActive !== false,
          sortOrder: subcategory.sortOrder || 0,
        };
      } else {
        hierarchy.subcategory = {
          _id: new mongoose.Types.ObjectId(),
          name: categoryData.sub,
          slug: categoryData.sub.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          level: 2,
          hierarchyLevel: "subcategory",
          productCount: 0,
          isActive: true,
          sortOrder: 0,
        };
      }

      allLevels.push({
        level: 2,
        name: categoryData.sub,
        slug: hierarchy.subcategory.slug,
        _id: hierarchy.subcategory._id,
        hierarchyLevel: "subcategory",
      });
    }

    // Level 3 - Type (optional)
    if (categoryData.type) {
      let typeCategory = null;

      // Search within subcategory's subcategories
      if (hierarchy.subcategory && hierarchy.subcategory._id) {
        const subcategoryWithTypes = await Category.findOne({
          "subcategories._id": hierarchy.subcategory._id,
        }).select("subcategories");

        if (subcategoryWithTypes && subcategoryWithTypes.subcategories) {
          const parentSub = subcategoryWithTypes.subcategories.find(
            (sub) => sub._id.toString() === hierarchy.subcategory._id.toString()
          );
          if (parentSub && parentSub.subcategories) {
            typeCategory = parentSub.subcategories.find(
              (type) => type.name === categoryData.type
            );
          }
        }
      }

      // If not found, try general search
      if (!typeCategory) {
        const foundType = await Category.findOne({
          name: categoryData.type,
          level: 3,
        }).select(
          "_id name slug level hierarchyLevel productCount isActive sortOrder"
        );

        if (foundType) {
          typeCategory = foundType;
        }
      }

      if (typeCategory) {
        hierarchy.type = {
          _id: typeCategory._id,
          name: typeCategory.name,
          slug: typeCategory.slug,
          level: typeCategory.level || 3,
          hierarchyLevel: typeCategory.hierarchyLevel || "type",
          productCount: typeCategory.productCount || 0,
          isActive: typeCategory.isActive !== false,
          sortOrder: typeCategory.sortOrder || 0,
        };
      } else {
        hierarchy.type = {
          _id: new mongoose.Types.ObjectId(),
          name: categoryData.type,
          slug: categoryData.type.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          level: 3,
          hierarchyLevel: "type",
          productCount: 0,
          isActive: true,
          sortOrder: 0,
        };
      }

      allLevels.push({
        level: 3,
        name: categoryData.type,
        slug: hierarchy.type.slug,
        _id: hierarchy.type._id,
        hierarchyLevel: "type",
      });
    }

    // Level 4 - Variant (optional)
    if (categoryData.variant) {
      let variantCategory = null;

      // Search within type's subcategories
      if (hierarchy.type && hierarchy.type._id) {
        const typeWithVariants = await Category.findOne({
          "subcategories.subcategories._id": hierarchy.type._id,
        }).select("subcategories");

        if (typeWithVariants && typeWithVariants.subcategories) {
          for (const sub of typeWithVariants.subcategories) {
            if (sub.subcategories) {
              const parentType = sub.subcategories.find(
                (type) => type._id.toString() === hierarchy.type._id.toString()
              );
              if (parentType && parentType.subcategories) {
                variantCategory = parentType.subcategories.find(
                  (variant) => variant.name === categoryData.variant
                );
                if (variantCategory) break;
              }
            }
          }
        }
      }

      // If not found, try general search
      if (!variantCategory) {
        const foundVariant = await Category.findOne({
          name: categoryData.variant,
          level: 4,
        }).select(
          "_id name slug level hierarchyLevel productCount isActive sortOrder"
        );

        if (foundVariant) {
          variantCategory = foundVariant;
        }
      }

      if (variantCategory) {
        hierarchy.variant = {
          _id: variantCategory._id,
          name: variantCategory.name,
          slug: variantCategory.slug,
          level: variantCategory.level || 4,
          hierarchyLevel: variantCategory.hierarchyLevel || "variant",
          productCount: variantCategory.productCount || 0,
          isActive: variantCategory.isActive !== false,
          sortOrder: variantCategory.sortOrder || 0,
        };
      } else {
        hierarchy.variant = {
          _id: new mongoose.Types.ObjectId(),
          name: categoryData.variant,
          slug: categoryData.variant.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          level: 4,
          hierarchyLevel: "variant",
          productCount: 0,
          isActive: true,
          sortOrder: 0,
        };
      }

      allLevels.push({
        level: 4,
        name: categoryData.variant,
        slug: hierarchy.variant.slug,
        _id: hierarchy.variant._id,
        hierarchyLevel: "variant",
      });
    }

    // Level 5 - Style (optional)
    if (categoryData.style) {
      let styleCategory = null;

      // Search within variant's subcategories
      if (hierarchy.variant && hierarchy.variant._id) {
        const variantWithStyles = await Category.findOne({
          "subcategories.subcategories.subcategories._id":
            hierarchy.variant._id,
        }).select("subcategories");

        if (variantWithStyles && variantWithStyles.subcategories) {
          for (const sub of variantWithStyles.subcategories) {
            if (sub.subcategories) {
              for (const type of sub.subcategories) {
                if (type.subcategories) {
                  const parentVariant = type.subcategories.find(
                    (variant) =>
                      variant._id.toString() ===
                      hierarchy.variant._id.toString()
                  );
                  if (parentVariant && parentVariant.subcategories) {
                    styleCategory = parentVariant.subcategories.find(
                      (style) => style.name === categoryData.style
                    );
                    if (styleCategory) break;
                  }
                }
              }
              if (styleCategory) break;
            }
          }
        }
      }

      // If not found, try general search
      if (!styleCategory) {
        const foundStyle = await Category.findOne({
          name: categoryData.style,
          level: 5,
        }).select(
          "_id name slug level hierarchyLevel productCount isActive sortOrder"
        );

        if (foundStyle) {
          styleCategory = foundStyle;
        }
      }

      if (styleCategory) {
        hierarchy.style = {
          _id: styleCategory._id,
          name: styleCategory.name,
          slug: styleCategory.slug,
          level: styleCategory.level || 5,
          hierarchyLevel: styleCategory.hierarchyLevel || "style",
          productCount: styleCategory.productCount || 0,
          isActive: styleCategory.isActive !== false,
          sortOrder: styleCategory.sortOrder || 0,
        };
      } else {
        hierarchy.style = {
          _id: new mongoose.Types.ObjectId(),
          name: categoryData.style,
          slug: categoryData.style.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          level: 5,
          hierarchyLevel: "style",
          productCount: 0,
          isActive: true,
          sortOrder: 0,
        };
      }

      allLevels.push({
        level: 5,
        name: categoryData.style,
        slug: hierarchy.style.slug,
        _id: hierarchy.style._id,
        hierarchyLevel: "style",
      });
    }

    // Build full path using slugs from all levels
    const fullPath = allLevels.map((level) => level.slug).join("/");

    // FIX: Return the original string values along with the hierarchy objects
    return {
      // Keep the original string values (required by Product model)
      main: categoryData.main,
      sub: categoryData.sub,
      type: categoryData.type || "",
      variant: categoryData.variant || "",
      style: categoryData.style || "",
      fullPath: categoryData.fullPath || fullPath,

      // Add the hierarchy objects (for reference)
      hierarchy: hierarchy,
      allLevels: allLevels,
    };
  } catch (error) {
    console.error("Error building category structure:", error);

    // Fallback: return the original category data as strings
    return {
      main: categoryData.main,
      sub: categoryData.sub,
      type: categoryData.type || "",
      variant: categoryData.variant || "",
      style: categoryData.style || "",
      fullPath: categoryData.fullPath || "",
      hierarchy: {
        main: null,
        subcategory: null,
        type: null,
        variant: null,
        style: null,
      },
      allLevels: [],
    };
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
// @desc    Create product
// @route   POST /api/products
// @access  Private (Vendor)
const createProduct = async (req, res, next) => {
  console.log(req.file, req.body);
  try {
    // Attach vendor data
    req.body.vendor = req.user._id;
    req.body.vendorName = req.user.vendorInfo.shopName;

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
        "category",
      ].forEach(parseJSONField);
    } catch (parseError) {
      console.error("Error parsing JSON fields:", parseError);
      return res.status(400).json({
        success: false,
        message:
          "Invalid JSON in tags, colorVariants, categoryFields, commonSpecs, or category",
      });
    }

    // Validate required category fields
    if (
      !req.body.category ||
      !req.body.category.main ||
      !req.body.category.sub
    ) {
      return res.status(400).json({
        success: false,
        message: "Main category and subcategory are required",
      });
    }

    // Build complete category structure for new schema
    const categoryData = await buildCategoryStructure(req.body.category);

    // FIX: Merge the built category data with the original category data
    // This preserves the string fields while adding the hierarchy
    req.body.category = {
      ...req.body.category, // Keep the original string values
      ...categoryData, // Add hierarchy and allLevels
    };

    console.log("Final category data:", req.body.category); // Debug log

    // Handle image uploads and links for color variants
    if (Array.isArray(req.body.colorVariants)) {
      const uploadFolder = `LUXE/products/${req.user._id}/${Date.now()}`;

      for (
        let colorIndex = 0;
        colorIndex < req.body.colorVariants.length;
        colorIndex++
      ) {
        const variant = req.body.colorVariants[colorIndex];

        if (!variant.images) {
          variant.images = [];
        }

        // Process uploaded files for this color variant
        const colorVariantFiles = req.files
          ? req.files.filter((file) =>
              file.fieldname.startsWith(`colorImages_${colorIndex}`)
            )
          : [];

        // Upload new images to Cloudinary
        for (const file of colorVariantFiles) {
          try {
            const uploadResult = await uploadToCloudinary(
              file.buffer,
              uploadFolder
            );

            const imageData = {
              url: uploadResult.secure_url,
              secure_url: uploadResult.secure_url,
              publicId: uploadResult.public_id,
              alt: `${req.body.name || "Product"} - ${
                variant.colorName || `Color ${colorIndex + 1}`
              }`,
              isPrimary: variant.images.length === 0,
              source: "upload", // Track source
            };

            variant.images.push(imageData);
          } catch (uploadError) {
            console.error("Error uploading image:", uploadError);
          }
        }

        // Process image links (already in variant.images with source: "link")
        // Set primary image if none exists
        const hasPrimary = variant.images.some((img) => img.isPrimary);
        if (variant.images.length > 0 && !hasPrimary) {
          variant.images[0].isPrimary = true;
        }

        // Validate that each color variant has at least one image
        if (variant.images.length === 0) {
          return res.status(400).json({
            success: false,
            message: `Each color variant must have at least one image.`,
          });
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

    // Set hasVariants flag
    req.body.hasVariants =
      req.body.colorVariants && req.body.colorVariants.length > 0;

    // Ensure commonSpecs has proper structure
    if (!req.body.commonSpecs) {
      req.body.commonSpecs = {};
    }
    if (!req.body.commonSpecs.weight) {
      req.body.commonSpecs.weight = { value: 0, unit: "kg" };
    }
    if (!req.body.commonSpecs.features) {
      req.body.commonSpecs.features = [];
    }

    // Ensure categoryFields has proper structure
    if (!req.body.categoryFields) {
      req.body.categoryFields = {};
    }

    // Ensure tags is an array
    if (!req.body.tags) {
      req.body.tags = [];
    }

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

    // ✅ If only single/simple field (like status, price etc.) is coming → update directly
    if (req.body && Object.keys(req.body).length === 1 && req.body.status) {
      product.status = req.body.status;
      await product.save();
      return res.status(200).json({ success: true, product });
    }

    // ---- Otherwise do the full update logic with images/variants ----

    const colorVariantsData = JSON.parse(req.body.colorVariants || "[]");
    const categoryFields = JSON.parse(req.body.categoryFields || "{}");
    const commonSpecs = JSON.parse(req.body.commonSpecs || "{}");
    const tags = JSON.parse(req.body.tags || "[]");

    const keptImages = req.body.keptImages
      ? JSON.parse(req.body.keptImages)
      : [];
    const deletedImages = req.body.deletedImages
      ? JSON.parse(req.body.deletedImages)
      : [];

    // Delete images marked for deletion
    if (deletedImages.length > 0) {
      await Promise.all(
        deletedImages.map((image) =>
          image.publicId && image.source === "upload" // Only delete uploaded images from Cloudinary
            ? deleteFromCloudinary(image.publicId)
            : Promise.resolve()
        )
      );
    }

    const updatedColorVariants = await Promise.all(
      colorVariantsData.map(async (variant, colorIndex) => {
        let variantImages = [];

        // 1. Add kept images (both uploaded and linked)
        const variantKeptImages = keptImages.filter(
          (img) => img.colorIndex === colorIndex
        );

        if (variantKeptImages.length > 0) {
          variantImages.push(
            ...variantKeptImages.map((img) => ({
              url: img.url || img.secure_url,
              secure_url: img.secure_url || img.url,
              alt: img.alt,
              isPrimary: img.isPrimary || false,
              order: img.order || 0,
              publicId: img.publicId,
              source: img.source || "upload", // Preserve source info
            }))
          );
        } else {
          // Fallback: keep existing images that aren't deleted
          const existingVariantImages =
            product.colorVariants[colorIndex]?.images || [];
          variantImages = existingVariantImages.filter(
            (existingImg) =>
              !deletedImages.some(
                (deletedImg) =>
                  (deletedImg.publicId &&
                    deletedImg.publicId === existingImg.publicId) ||
                  (deletedImg.url && deletedImg.url === existingImg.url)
              )
          );
        }

        // 2. Process new uploaded files for this color variant
        const colorVariantFiles = req.files
          ? req.files.filter((file) =>
              file.fieldname.startsWith(`colorImages_${colorIndex}`)
            )
          : [];

        if (colorVariantFiles.length > 0) {
          const uploadFolder = `LUXE/products/${req.user._id}/${Date.now()}`;
          const newImages = await Promise.all(
            colorVariantFiles.map((file) =>
              uploadToCloudinary(file.buffer, uploadFolder)
            )
          );

          const hasExistingPrimary = variantImages.some((img) => img.isPrimary);

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
              source: "upload", // Mark as uploaded image
            });
          });
        }

        // 3. Process linked images from the variant data (already included in keptImages or need to be added)
        // Linked images are already in variantImages from keptImages, but we need to ensure
        // any new linked images from the frontend are included
        if (variant.images && Array.isArray(variant.images)) {
          variant.images.forEach((img) => {
            if (img.source === "link" && !img.publicId) {
              // This is a linked image, check if it already exists
              const exists = variantImages.some(
                (existingImg) => existingImg.url === img.url
              );
              if (!exists) {
                variantImages.push({
                  url: img.url,
                  secure_url: img.url,
                  alt: img.alt || `${req.body.name} - ${variant.colorName}`,
                  isPrimary: img.isPrimary || false,
                  order: img.order || variantImages.length,
                  publicId: null, // Linked images don't have publicId
                  source: "link", // Mark as linked image
                });
              }
            }
          });
        }

        // 4. Reorder images and ensure proper primary image
        variantImages = variantImages.map((img, index) => ({
          ...img,
          order: index,
        }));

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

        // 5. Validate that each color variant has at least one image
        if (variantImages.length === 0) {
          throw new Error(
            `Color variant ${colorIndex + 1} must have at least one image`
          );
        }

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

    // Calculate total stock
    const totalStock = updatedColorVariants.reduce((sum, variant) => {
      const variantStock = (variant.sizeVariants || []).reduce(
        (sizeSum, sizeVariant) => sizeSum + (sizeVariant.stock || 0),
        0
      );
      return sum + variantStock;
    }, 0);

    // Build category structure if category is being updated
    let categoryData = product.category;
    if (req.body.category) {
      const parsedCategory = JSON.parse(req.body.category);
      categoryData = await buildCategoryStructure(parsedCategory);
    }

    // Prepare update data
    const updateData = {
      name: req.body.name ?? product.name,
      description: req.body.description ?? product.description,
      price: req.body.price ? Number(req.body.price) : product.price,
      category: categoryData,
      originalPrice: req.body.originalPrice
        ? Number(req.body.originalPrice)
        : product.originalPrice,
      brand: req.body.brand ?? product.brand,
      badge: req.body.badge ?? product.badge,
      status: req.body.status ?? product.status,
      categoryFields: Object.keys(categoryFields).length
        ? categoryFields
        : product.categoryFields,
      commonSpecs: Object.keys(commonSpecs).length
        ? {
            weight: commonSpecs.weight || { value: "", unit: "kg" },
            material: commonSpecs.material || "",
            warranty: commonSpecs.warranty || "",
            features: commonSpecs.features || [],
          }
        : product.commonSpecs,
      tags: tags.length ? tags : product.tags,
      colorVariants: updatedColorVariants.length
        ? updatedColorVariants
        : product.colorVariants,
      stock: totalStock || product.stock,
      hasVariants: updatedColorVariants.length > 0 ? true : product.hasVariants,
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    ).populate("vendor", "name email vendorInfo");

    res.status(200).json({ success: true, product: updatedProduct });
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

// @desc    Search products with advanced filtering
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res, next) => {
  try {
    const {
      q,
      category,
      mainCategory,
      subCategory,
      type,
      variant,
      style,
      minPrice,
      maxPrice,
      brand,
      color,
      size,
      inStock,
      minRating,
      sort,
      badge,
      tags,
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    let query = { status: "active" };

    // Advanced text search across multiple fields
    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), "i");
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { tags: { $in: [searchRegex] } },
        { "category.main": searchRegex },
        { "category.sub": searchRegex },
        { "category.type": searchRegex },
        { "category.variant": searchRegex },
        { "category.style": searchRegex },
        { "colorVariants.colorName": searchRegex },
        { "categoryFields.fabric": searchRegex },
        { "categoryFields.pattern": searchRegex },
        { "commonSpecs.material": searchRegex },
      ];
    }

    // Category hierarchy filtering
    if (mainCategory) {
      query["category.main"] = new RegExp(mainCategory, "i");
    }
    if (subCategory) {
      query["category.sub"] = new RegExp(subCategory, "i");
    }
    if (type) {
      query["category.type"] = new RegExp(type, "i");
    }
    if (variant) {
      query["category.variant"] = new RegExp(variant, "i");
    }
    if (style) {
      query["category.style"] = new RegExp(style, "i");
    }

    // Backward compatible category filter
    if (category && category !== "all") {
      query.$or = [
        { "category.main": new RegExp(category, "i") },
        { "category.sub": new RegExp(category, "i") },
        { "category.type": new RegExp(category, "i") },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Brand filter
    if (brand) {
      query.brand = new RegExp(brand, "i");
    }

    // Color filter
    if (color) {
      query["colorVariants.colorName"] = new RegExp(color, "i");
    }

    // Size filter
    if (size) {
      query["colorVariants.sizeVariants.size"] = size;
    }

    // Stock filter
    if (inStock === "true") {
      query.stock = { $gt: 0 };
    }

    // Rating filter
    if (minRating) {
      query["rating.average"] = { $gte: parseFloat(minRating) };
    }

    // Badge filter
    if (badge && badge !== "all") {
      query.badge = badge;
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(",");
      query.tags = { $in: tagArray.map((tag) => new RegExp(tag, "i")) };
    }

    // Sort options
    let sortOption = {};
    switch (sort) {
      case "price-low":
        sortOption = { price: 1 };
        break;
      case "price-high":
        sortOption = { price: -1 };
        break;
      case "rating":
        sortOption = { "rating.average": -1, "rating.count": -1 };
        break;
      case "popularity":
        sortOption = { salesCount: -1, viewCount: -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "name-asc":
        sortOption = { name: 1 };
        break;
      case "name-desc":
        sortOption = { name: -1 };
        break;
      default:
        // Default: relevance for search, newest otherwise
        sortOption = q
          ? { "rating.average": -1, salesCount: -1 }
          : { createdAt: -1 };
    }

    const products = await Product.find(query)
      .populate("vendor", "vendorInfo.shopName")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    // Get aggregation data for filters
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
            { $limit: 20 },
          ],
          categories: [
            { $group: { _id: "$category.main", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          colors: [
            { $unwind: "$colorVariants" },
            { $group: { _id: "$colorVariants.colorName", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 15 },
          ],
          ratings: [
            {
              $bucket: {
                groupBy: "$rating.average",
                boundaries: [0, 1, 2, 3, 4, 5],
                default: "other",
                output: {
                  count: { $sum: 1 },
                },
              },
            },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
      filters: filterAggregations[0] || {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get search suggestions
// @route   GET /api/products/search-suggestions
// @access  Public
// Note: Search suggestions moved to dedicated search routes

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
