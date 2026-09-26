const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-fallback-secret-key";

// Route protection middleware
const authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains { userId, email }
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

module.exports = { authenticate, JWT_SECRET };
