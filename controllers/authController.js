const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { generateToken } = require("../utils/helpers");

exports.register = async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    const profileImage = req.file ? `/uploads/${req.file.filename}` : null;

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (email, password, name, phone, role, profile_image) VALUES (?, ?, ?, ?, ?, ?)",
      [email, hashedPassword, name, phone, role || "customer", profileImage],
    );

    if (role === "seller" && req.body.businessName) {
      await db.query(
        "INSERT INTO seller_details (user_id, business_name, business_email, business_phone) VALUES (?, ?, ?, ?)",
        [result.insertId, req.body.businessName, email, phone],
      );
      await db.query("INSERT INTO seller_wallet (seller_id) VALUES (?)", [
        result.insertId,
      ]);
    }

    const token = generateToken(result.insertId);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: result.insertId,
        email,
        name,
        role: role || "customer",
        profileImage,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (users.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.is_active) {
      return res
        .status(401)
        .json({ success: false, message: "Account is deactivated" });
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profileImage: user.profile_image,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: error.message,
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, email, name, phone, role, profile_image as profileImage, is_verified, created_at FROM users WHERE id = ?",
      [req.user.id],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: users[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    let query = "UPDATE users SET name = ?, phone = ?";
    let params = [name, phone];

    if (req.file) {
      const profileImage = `/uploads/${req.file.filename}`;
      query += ", profile_image = ?";
      params.push(profileImage);
    }

    query += " WHERE id = ?";
    params.push(req.user.id);

    await db.query(query, params);
    res.json({
      success: true,
      message: "Profile updated successfully",
      profileImage: req.file ? `/uploads/${req.file.filename}` : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
