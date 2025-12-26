import AuditLog from "../models/AuditLog.js";

export const audit = (action, entity) => (req, res, next) => {
  res.on("finish", async () => {
    try {
      if (res.statusCode < 400 && req.user) {
        await AuditLog.create({
          actorId: req.user._id,
          actorRole: req.user.role,
          action,
          entity,
          entityId: res.locals.entityId,
          meta: req.body,
          ip: req.ip,
        });
      }
    } catch (err) {
      console.error("Audit log failed:", err.message);
    }
  });

  next();
};
