const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, run } = require("../db/connection"); // Destructure get and run directly
const { authenticate, JWT_SECRET } = require("../middleware/auth");
const { ALLOWED_EMAILS } = require("../config.js");

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/register
router.post(
  "/register",
  handle(async (req, res) => {
    /*const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }*/

    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // 1. Whitelist Check (normalize to lowercase to prevent casing mismatches)
    if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
      return res.status(403).json({
        error: "Access restricted. This email address is not authorized to register.",
      });
    }

    // 2. Check if user exists
    const existingUser = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    // 3. Hash password & insert user
    const passwordHash = await bcrypt.hash(password, 10);
    /* const result = await run(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, passwordHash]
    ); */
    const result = await run(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)",
      [email, passwordHash, firstName.trim(), lastName.trim()]
    );

    res.status(201).json({
      message: "User registered successfully",
      userId: result.lastID,
    });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  handle(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Verify user
    // const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    const user = await get("SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?", [email]);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  authenticate, // uses your existing middleware to verify the cookie's JWT
  handle(async (req, res) => {
    // req.user was set by the authenticate middleware: { userId, email }
    const user = await get(
      "SELECT id, email, first_name, last_name FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  })
);

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

module.exports = router;