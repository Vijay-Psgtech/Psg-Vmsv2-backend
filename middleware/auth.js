/**
 * AUTH MIDDLEWARE - PRODUCTION FIXED
 * File: backend/middleware/auth.js
 *
 * FIXES:
 * 1. requireRole now correctly accepts BOTH a string AND an array
 *    Old: requireRole("superadmin") worked, requireRole(["superadmin","admin"]) did NOT
 *    New: both work correctly
 * 2. Admin/superadmin bypass is now consistent
 */

import jwt from "jsonwebtoken";

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
};

export const requireAuth = (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        message: "Authorization header missing or invalid",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");

    // Support both _id and id in JWT payload (backward compat)
    req.user = {
      ...decoded,
      _id: decoded._id || decoded.id,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Token expired", message: "Please login again" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }
    console.error("Auth error:", error);
    res.status(500).json({ success: false, error: "Authentication failed" });
  }
};

/**
 * requireRole - accepts a string or an array of strings
 * Examples:
 *   router.use(requireRole("superadmin"))
 *   router.use(requireRole(["superadmin", "admin"]))
 *   router.get("/x", requireAuth, requireRole(["admin","hostadmin"]), handler)
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      const userRole = req.user.role;

      // Superadmin always passes
      if (userRole === "superadmin") return next();

      // Normalise to array
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions",
          requiredRoles: roles,
          userRole,
        });
      }

      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ success: false, error: "Authorization error" });
    }
  };
};

export const verifyToken = (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ success: false, valid: false, message: "Token not provided" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    res.json({ success: true, valid: true, user: decoded, expiresAt: new Date(decoded.exp * 1000) });
  } catch (error) {
    res.status(401).json({ success: false, valid: false, message: error.message });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
      req.user = { ...decoded, _id: decoded._id || decoded.id };
    }
  } catch {
    // optional — ignore failures
  }
  next();
};

export const checkAuthStatus = (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.json({ success: true, authenticated: false });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    res.json({
      success: true,
      authenticated: true,
      user: {
        _id: decoded._id || decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      },
      expiresAt: new Date(decoded.exp * 1000),
    });
  } catch {
    res.json({ success: true, authenticated: false });
  }
};

export default { requireAuth, requireRole, verifyToken, optionalAuth, checkAuthStatus };