const express = require("express");
const cors = require("cors");
const initializeDatabase = require("./config/init");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));

app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/wallet", require("./routes/walletRoutes"));

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({
    message: "E-Commerce API is running",
    status: "OK",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      orders: "/api/orders",
      categories: "/api/categories",
      admin: "/api/admin",
    },
  });
});

// centralized error handler — always return a friendly message plus details
app.use((err, req, res, next) => {
  console.error("Error:", err.stack || err.message || err);
  const payload = {
    success: false,
    message:
      err.userMessage ||
      "An unexpected error occurred while processing your request.",
  };
  // include developer error details when available (safe in dev)
  if (process.env.NODE_ENV !== "production") {
    payload.error = err.message || err;
  }
  res.status(err.statusCode || 500).json(payload);
});

async function startServer() {
  console.log("🚀 Starting server initialization...");

  // Step 1: Initialize database (create tables if they don't exist)
  const dbInitialized = await initializeDatabase();

  if (!dbInitialized) {
    console.error("❌ Failed to initialize database. Exiting...");
    process.exit(1);
  }
}
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("\n========================================");
  console.log("  E-Commerce Backend Server");
  console.log("========================================");
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ API: http://localhost:${PORT}`);
  console.log(`✓ Database: ${process.env.DB_NAME}`);
  console.log("========================================\n");
});
