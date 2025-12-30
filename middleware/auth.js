import jwt from "jsonwebtoken";

/* ================================
   AUTHENTICATION (JWT)
================================ */
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No authentication token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      gateId: String(decoded.gateId || decoded.gate || ""),
    };

     next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


/* ================================
   ROLE AUTHORIZATION
================================ */
export const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };


