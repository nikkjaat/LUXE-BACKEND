const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
dotenv.config();

/* ---------------- Import Routes ---------------- */
const authRoutes = require("./routes/auth.js");
const userRoutes = require("./routes/user.js");
const productRoutes = require("./routes/products.js");
const adminRoutes = require("./routes/admin.js");
const customerRoutes = require("./routes/Customer.js");
const searchRoutes = require("./routes/search.js");
const searchHistoryRoutes = require("./routes/searchHistory.js");

/* ---------------- Import Middleware ---------------- */
const { errorHandler } = require("./middleware/errorHandler.js");
const { notFound } = require("./middleware/notFound.js");
const corsOptions = require("./middleware/allowedCors.js");

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------- Security Middleware ---------------- */
app.use(helmet());
app.use(compression());

/* ---------------- CORS ---------------- */
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ---------------- Rate Limiters ---------------- */
// Strict → for sensitive routes (auth)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // only 20 attempts
  handler: (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(429).json({
      success: false,
      message: "Too many login/register attempts. Please try again later.",
    });
  },
});

// Admin → medium/high limit
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  handler: (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(429).json({
      success: false,
      message: "Too many requests to admin APIs. Please slow down.",
    });
  },
});

// Public → very high or effectively unlimited
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  handler: (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(429).json({
      success: false,
      message: "Too many requests to public API. Please slow down.",
    });
  },
});

/* ---------------- Body Parsing ---------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ---------------- Logging ---------------- */
// if (process.env.NODE_ENV === "development") {
//   app.use(morgan("dev"));
// }

/* ---------------- DB Connection ---------------- */
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/luxe-ecommerce"
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

/* ---------------- Routes ---------------- */
// Sensitive routes → strictLimiter
app.use("/api/auth", strictLimiter, authRoutes);

// Public routes → relaxedLimiter
app.use("/api/products", publicLimiter, productRoutes);

// Admin routes → adminLimiter
app.use("/api", adminLimiter, adminRoutes);

// Normal user/customer routes (no strict limit)
app.use("/api/user", userRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/search", publicLimiter, searchRoutes);
app.use("/api/search-history", searchHistoryRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "LUXE API is running",
    timestamp: new Date().toISOString(),
  });
});

/* ---------------- Error Handling ---------------- */
app.use(notFound);
app.use(errorHandler);

/* ---------------- Start Server ---------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
});
