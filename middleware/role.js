export const role = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: "Access denied: insufficient permissions",
        });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: "Role middleware error" });
    }
  };
};
