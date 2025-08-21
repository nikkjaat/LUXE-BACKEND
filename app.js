const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth.js");
const userRoutes = require("./routes/user.js");
const productRoutes = require("./routes/products.js");
const adminRoutes = require("./routes/admin.js");
const customerRoutes = require("./routes/Customer.js");
// const orderRoutes = require('./routes/orders.js');
// const vendorRoutes = require('./routes/vendors.js');
// const reviewRoutes = require('./routes/reviews.js');
// const socialRoutes = require('./routes/social.js');
// const promotionRoutes = require('./routes/promotions.js');
// const analyticsRoutes = require('./routes/analytics.js');
// const notificationRoutes = require('./routes/notifications.js');

// Import middleware
const { errorHandler } = require("./middleware/errorHandler.js");
const { notFound } = require("./middleware/notFound.js");
const corsOptions = require("./middleware/allowedCors.js");

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Connect to MongoDB
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/luxe-ecommerce"
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api", adminRoutes);
app.use("/api/customer", customerRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/vendors', vendorRoutes);
// app.use('/api/reviews', reviewRoutes);
// app.use('/api/social', socialRoutes);
// app.use('/api/promotions', promotionRoutes);
// app.use('/api/analytics', analyticsRoutes);
// app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "LUXE API is running",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
});
