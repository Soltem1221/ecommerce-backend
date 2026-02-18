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
        host: process.env.DB_HOST, // trolley.proxy.rlwy.net
        port: port, // 17216
        user: process.env.DB_USER, // root
        password: process.env.DB_PASSWORD, // SQNmmjIsWSIQAKfPJynxXTzPkQYXKdmn
        database: process.env.DB_NAME, // railway
        ssl: {
          rejectUnauthorized: false, // Required for Render MySQL
        },
        connectTimeout: 60000, // 60 seconds timeout
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
    console.log(`📋 Checking if tables exist in '${dbName}'...`);

    // Check if users table exists
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [dbName],
    );

    if (tables.length === 0) {
      console.log("🔄 No tables found. Creating database schema...");

      // Your complete schema SQL (keep your existing schema)
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

        -- Continue with all your other CREATE TABLE statements...
        -- (Keep ALL your existing table creation code here)
        
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

        -- ... (rest of your tables)
      `;

      // Execute schema creation
      console.log("📝 Creating tables...");

      // Split schema into individual statements to handle errors better
      const statements = schemaSQL.split(";").filter((stmt) => stmt.trim());

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (stmt) {
          try {
            await connection.query(stmt);
            console.log(`  ✅ Created table ${i + 1}/${statements.length}`);
          } catch (stmtError) {
            // If table already exists, continue
            if (!stmtError.message.includes("already exists")) {
              console.error(
                `  ❌ Error with statement:`,
                stmt.substring(0, 50) + "...",
              );
              throw stmtError;
            }
          }
        }
      }

      console.log("✅ All tables created successfully");

      // Insert default data
      console.log("📦 Inserting default data...");

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

      // Check if categories exist
      const [categoriesExist] = await connection.query(
        "SELECT id FROM categories LIMIT 1",
      );

      if (categoriesExist.length === 0) {
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

      // Check if CMS pages exist
      const [cmsExist] = await connection.query(
        "SELECT id FROM cms_pages LIMIT 1",
      );

      if (cmsExist.length === 0) {
        await connection.query(`
          INSERT INTO cms_pages (slug, title, content, is_active) VALUES 
          ('about-us', 'About Us', '<h1>About Our Marketplace</h1><p>Welcome to our e-commerce platform.</p>', TRUE),
          ('privacy-policy', 'Privacy Policy', '<h1>Privacy Policy</h1><p>Your privacy is important to us.</p>', TRUE),
          ('terms-conditions', 'Terms & Conditions', '<h1>Terms & Conditions</h1><p>Please read these terms carefully.</p>', TRUE),
          ('contact', 'Contact Us', '<h1>Contact Us</h1><p>Get in touch with us.</p>', TRUE)
        `);
        console.log("✅ Default CMS pages created");
      }
    } else {
      console.log("✅ Tables already exist, skipping initialization");
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
