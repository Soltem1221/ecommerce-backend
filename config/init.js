// database/init.js
const mysql = require("mysql2/promise");
require("dotenv").config();

async function initializeDatabase() {
  let connection;
  try {
    console.log("🔍 Checking database environment variables...");

    // Log available variables (without exposing full password)
    console.log("DB_HOST:", process.env.DB_HOST);
    console.log("DB_USER:", process.env.DB_USER);
    console.log("DB_NAME:", process.env.DB_NAME);
    console.log("DB_PORT:", process.env.DB_PORT);
    console.log("DB_PASSWORD exists:", !!process.env.DB_PASSWORD);

    // Use your Render MySQL connection details with DB_ prefix
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) {
      console.log("🔌 Using DB_ environment variables for Render MySQL...");

      // Parse port as number
      const port = parseInt(process.env.DB_PORT || "17216");

      const dbConfig = {
        host: process.env.DB_HOST,
        port: port,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: {
          rejectUnauthorized: false,
        },
        connectTimeout: 60000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      };

      console.log("📊 Database connection config:", {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        database: dbConfig.database,
        ssl: !!dbConfig.ssl,
      });

      console.log("🔌 Connecting to database...");
      connection = await mysql.createConnection(dbConfig);
    }
    // Try DATABASE_URL as fallback
    else if (process.env.DATABASE_URL) {
      console.log("🔌 Using DATABASE_URL...");
      const url = new URL(process.env.DATABASE_URL);
      const dbConfig = {
        host: url.hostname,
        port: parseInt(url.port || "3306"),
        user: url.username,
        password: url.password,
        database: url.pathname.substring(1),
        ssl: {
          rejectUnauthorized: false,
        },
        connectTimeout: 60000,
      };
      connection = await mysql.createConnection(dbConfig);
    } else {
      throw new Error(
        "No database connection configuration found. Set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME environment variables.",
      );
    }

    // Test the connection
    console.log("✅ Connected to database, testing query...");
    const [testResult] = await connection.query("SELECT 1 as connection_test");
    console.log("✅ Database connection test successful:", testResult[0]);

    // Get database name
    const dbName = process.env.DB_NAME || "railway";
    console.log(`📋 Checking database schema in '${dbName}'...`);

    // Get list of existing tables
    const [existingTables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?",
      [dbName],
    );

    const existingTableNames = existingTables.map((t) => t.TABLE_NAME);
    console.log("📊 Existing tables:", existingTableNames);

    // Define all tables that should exist (from your schema)
    const requiredTables = [
      "users",
      "seller_details",
      "addresses",
      "categories",
      "brands",
      "products",
      "product_images",
      "product_variants",
      "product_attributes",
      "tags",
      "product_tags",
      "cart",
      "wishlist",
      "orders",
      "order_items",
      "reviews",
      "payments",
      "seller_wallet",
      "wallet_transactions",
      "withdrawal_requests",
      "banners",
      "flash_sales",
      "notifications",
      "cms_pages",
      "shipping_zones",
      "shipping_rates",
    ];

    // Find missing tables
    const missingTables = requiredTables.filter(
      (table) => !existingTableNames.includes(table),
    );

    if (missingTables.length > 0) {
      console.log(
        `🔄 Found ${missingTables.length} missing tables:`,
        missingTables,
      );
      console.log("📝 Creating missing tables...");

      // Your complete schema SQL
      const schemaSQL = `
  -- Users table (customers, sellers, admin)
  CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('customer', 'seller', 'admin') NOT NULL DEFAULT 'customer',
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
  );

  -- Seller details
  CREATE TABLE IF NOT EXISTS seller_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_email VARCHAR(255),
    business_phone VARCHAR(20),
    business_address TEXT,
    tax_id VARCHAR(100),
    bank_account VARCHAR(100),
    is_approved BOOLEAN DEFAULT FALSE,
    approval_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Addresses
  CREATE TABLE IF NOT EXISTS addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Ethiopia',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Categories
  CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_id INT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_parent (parent_id),
    INDEX idx_slug (slug)
  );

  -- Brands
  CREATE TABLE IF NOT EXISTS brands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Products
  CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT NOT NULL,
    category_id INT NOT NULL,
    brand_id INT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2) NULL,
    stock_quantity INT DEFAULT 0,
    weight DECIMAL(8,2),
    dimensions VARCHAR(100),
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    views_count INT DEFAULT 0,
    sales_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
    INDEX idx_seller (seller_id),
    INDEX idx_category (category_id),
    INDEX idx_slug (slug),
    INDEX idx_sku (sku)
  );

  -- Product images
  CREATE TABLE IF NOT EXISTS product_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Product variants (size, color, etc.)
  CREATE TABLE IF NOT EXISTS product_variants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    variant_value VARCHAR(100) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Product attributes
  CREATE TABLE IF NOT EXISTS product_attributes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Tags
  CREATE TABLE IF NOT EXISTS tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS product_tags (
    product_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (product_id, tag_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  -- Cart
  CREATE TABLE IF NOT EXISTS cart (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cart_item (user_id, product_id, variant_id)
  );

  -- Wishlist
  CREATE TABLE IF NOT EXISTS wishlist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_wishlist_item (user_id, product_id)
  );

  -- Orders
  CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    shipping_address_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned') DEFAULT 'pending',
    payment_method VARCHAR(50) NOT NULL,
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    payment_transaction_id VARCHAR(255),
    transaction_ref VARCHAR(255),
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses(id),
    INDEX idx_order_number (order_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
  );

  -- Order items
  CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    seller_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2),
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  -- Reviews
  CREATE TABLE IF NOT EXISTS reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE KEY unique_review (product_id, user_id, order_id)
  );

  -- Payments
  CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
    status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
    chapa_reference VARCHAR(255),
    response_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Seller wallet
  CREATE TABLE IF NOT EXISTS seller_wallet (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT UNIQUE NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0,
    pending_balance DECIMAL(10,2) DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0,
    total_withdrawn DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Wallet transactions
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT NOT NULL,
    order_id INT NULL,
    type ENUM('credit', 'debit', 'withdrawal') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
  );

  -- Withdrawal requests
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    bank_account VARCHAR(100),
    notes TEXT,
    processed_by INT NULL,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id)
  );

  -- Banners
  CREATE TABLE IF NOT EXISTS banners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    position VARCHAR(50) DEFAULT 'home_slider',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Flash sales
  CREATE TABLE IF NOT EXISTS flash_sales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    discount_percentage INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    stock_limit INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_url VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read)
  );

  -- CMS Pages
  CREATE TABLE IF NOT EXISTS cms_pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );

  -- Shipping zones
  CREATE TABLE IF NOT EXISTS shipping_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    countries TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Shipping rates
  CREATE TABLE IF NOT EXISTS shipping_rates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id INT NOT NULL,
    min_weight DECIMAL(8,2) DEFAULT 0,
    max_weight DECIMAL(8,2),
    rate DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES shipping_zones(id) ON DELETE CASCADE
  );
`;

      // Split schema into individual statements
      const statements = schemaSQL.split(";").filter((stmt) => stmt.trim());

      let createdCount = 0;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (stmt) {
          try {
            await connection.query(stmt);
            // Extract table name for logging
            const tableNameMatch = stmt.match(
              /CREATE TABLE IF NOT EXISTS (\w+)/i,
            );
            if (tableNameMatch) {
              const tableName = tableNameMatch[1];
              if (missingTables.includes(tableName)) {
                console.log(`  ✅ Created missing table: ${tableName}`);
                createdCount++;
              }
            }
          } catch (stmtError) {
            // If table already exists, it's fine - just continue
            if (!stmtError.message.includes("already exists")) {
              console.error(
                `  ❌ Error creating table:`,
                stmt.substring(0, 50) + "...",
                stmtError.message,
              );
              // Don't throw - continue with other tables
            }
          }
        }
      }

      console.log(`✅ Created ${createdCount} missing tables successfully`);

      // Insert default data for new tables
      console.log("📦 Inserting default data for new tables...");

      // Check if admin exists
      const [adminExists] = await connection.query(
        "SELECT id FROM users WHERE email = 'sol@gmail.com'",
      );

      if (adminExists.length === 0) {
        await connection.query(`
          INSERT INTO users (email, password, role, name, is_verified, is_active) 
          VALUES ('sol@gmail.com', '$2a$10$kU5svPZqG0X6Q294zzGaNO9Tg10wuq7kacdImpiRob9eqPJxMG4nO', 'admin', 'System Admin', TRUE, TRUE)
        `);
        console.log("✅ Admin user created");
      }

      // Check if categories exist and table was just created
      if (missingTables.includes("categories")) {
        const [categoriesExist] = await connection.query(
          "SELECT COUNT(*) as count FROM categories",
        );
        if (categoriesExist[0].count === 0) {
          await connection.query(`
            INSERT INTO categories (name, slug, description, is_active) VALUES 
            ('Electronics', 'electronics', 'Electronic devices and accessories', TRUE),
            ('Fashion', 'fashion', 'Clothing and fashion items', TRUE),
            ('Home & Kitchen', 'home-kitchen', 'Home appliances and kitchen items', TRUE),
            ('Books', 'books', 'Books and educational materials', TRUE),
            ('Sports', 'sports', 'Sports equipment and accessories', TRUE),
            ('Beauty', 'beauty', 'Beauty and personal care products', TRUE)
          `);
          console.log("✅ Default categories created");
        }
      }

      // Check if CMS pages exist and table was just created
      if (missingTables.includes("cms_pages")) {
        const [cmsExist] = await connection.query(
          "SELECT COUNT(*) as count FROM cms_pages",
        );
        if (cmsExist[0].count === 0) {
          await connection.query(`
            INSERT INTO cms_pages (slug, title, content, is_active) VALUES 
            ('about-us', 'About Us', '<h1>About Our Marketplace</h1><p>Welcome to our e-commerce platform.</p>', TRUE),
            ('privacy-policy', 'Privacy Policy', '<h1>Privacy Policy</h1><p>Your privacy is important to us.</p>', TRUE),
            ('terms-conditions', 'Terms & Conditions', '<h1>Terms & Conditions</h1><p>Please read these terms carefully.</p>', TRUE),
            ('contact', 'Contact Us', '<h1>Contact Us</h1><p>Get in touch with us.</p>', TRUE)
          `);
          console.log("✅ Default CMS pages created");
        }
      }
    } else {
      console.log("✅ All required tables already exist");
    }

    console.log("🚀 Database initialization complete");
    await connection.end();
    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // Ignore close errors
      }
    }
    return false;
  }
}

module.exports = initializeDatabase;
