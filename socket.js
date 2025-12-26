import jwt from "jsonwebtoken";
import AuditLog from "./models/AuditLog.js"; // adjust path if needed

export default function socketHandler(io) {
  /* ================================
     AUTH MIDDLEWARE
  ================================ */
  io.use(async (socket, next) => {
    const { token, role, gateId } = socket.handshake.auth || {};

    if (!token || !role) {
      return next(new Error("UNAUTHORIZED"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 🔐 Role spoof protection
      if (decoded.role !== role) {
        return next(new Error("ROLE_MISMATCH"));
      }

      // 🔐 Gate required for security
      if (role === "security" && !gateId) {
        return next(new Error("GATE_REQUIRED"));
      }

      socket.user = {
        id: decoded.id,
        role: decoded.role,
        name: decoded.name,
      };

      socket.role = role;
      socket.gateId = gateId || null;

      next();
    } catch (err) {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  /* ================================
     CONNECTION HANDLER
  ================================ */
  io.on("connection", socket => {
    console.log(
      `✅ Socket connected | role=${socket.role} | user=${socket.user.id}`
    );

    /* ----------------
       ROOM JOINING
    ----------------- */
    if (socket.role === "security") {
      socket.join(`GATE_${socket.gateId}`);
    }

    if (socket.role === "admin") {
      socket.join("ADMIN");
    }

    if (socket.role === "reception") {
      socket.join("RECEPTION");
    }

    /* ----------------
       AUDIT: CONNECT
    ----------------- */
    AuditLog.create({
      actorId: socket.user.id,
      actorRole: socket.role,
      action: "SOCKET_CONNECTED",
      entity: "Socket",
      entityId: socket.id,
      gateId: socket.gateId,
      source: "SOCKET",
      severity: "LOW",
      meta: {
        socketId: socket.id,
      },
    }).catch(() => {});

    /* ----------------
       CLIENT READY (OPTIONAL)
    ----------------- */
    socket.on("CLIENT_READY", () => {
      socket.emit("SOCKET_READY", {
        connected: true,
        role: socket.role,
        gateId: socket.gateId,
      });
    });

    /* ----------------
       DISCONNECT
    ----------------- */
    socket.on("disconnect", reason => {
      console.log(
        `❌ Socket disconnected | user=${socket.user.id} | reason=${reason}`
      );

      AuditLog.create({
        actorId: socket.user.id,
        actorRole: socket.role,
        action: "SOCKET_DISCONNECTED",
        entity: "Socket",
        entityId: socket.id,
        gateId: socket.gateId,
        source: "SOCKET",
        severity: "LOW",
        meta: {
          reason,
        },
      }).catch(() => {});
    });
  });

  /* ================================
     SERVER HELPERS
  ================================ */

  io.emitToGate = (gateId, event, payload) => {
    io.to(`GATE_${gateId}`).emit(event, payload);
  };

  io.emitToAdmins = (event, payload) => {
    io.to("ADMIN").emit(event, payload);
  };

  io.emitToReception = (event, payload) => {
    io.to("RECEPTION").emit(event, payload);
  };
}
