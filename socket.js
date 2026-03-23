/***************************************************************
 * SOCKET.JS — Socket.IO Handler with Auth
 * ✅ FIXED: Proper JWT validation, role checking, room joining
 ***************************************************************/
import jwt from "jsonwebtoken";
import AuditLog from "./models/AuditLog.js";

export default function socketHandler(io) {
  /* ================================
     🔐 AUTH MIDDLEWARE
  ================================ */
  io.use(async (socket, next) => {
    try {
      // Get token from socket handshake auth
      const token = socket.handshake.auth?.token;

      if (!token) {
        console.error("❌ Socket error: UNAUTHORIZED - No token provided");
        return next(new Error("UNAUTHORIZED"));
      }

      // ✅ Verify JWT token with same secret as backend
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");

      // 🔐 Attach decoded user info to socket
      socket.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      };

      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;

      console.log(`✅ Socket authenticated: ${decoded.email} (Role: ${decoded.role})`);
      next();
    } catch (error) {
      console.error(`❌ Socket auth error: ${error.message}`);
      return next(new Error("UNAUTHORIZED"));
    }
  });

  /* ================================
     📡 CONNECTION HANDLER
  ================================ */
  io.on("connection", (socket) => {
    console.log(`
✅ Socket connected
   📍 Socket ID: ${socket.id}
   👤 User: ${socket.userEmail}
   🔑 Role: ${socket.userRole}
    `);

    /* ----------------
       🏢 ROOM JOINING
    ----------------- */

    // All authenticated users join their role room
    socket.join(`ROLE_${socket.userRole}`);

    // Admin/SuperAdmin join ADMIN room
    if (["admin", "superadmin"].includes(socket.userRole)) {
      socket.join("ADMIN");
    }

    // Security users join SECURITY room
    if (socket.userRole === "security") {
      socket.join("SECURITY");
    }

    // Reception users join RECEPTION room
    if (socket.userRole === "reception") {
      socket.join("RECEPTION");
    }

    // Employee users join EMPLOYEE room
    if (socket.userRole === "employee") {
      socket.join("EMPLOYEE");
    }

    /* ----------------
       📋 AUDIT LOG
    ----------------- */
    AuditLog.create({
      actorId: socket.userId,
      actorRole: socket.userRole,
      action: "SOCKET_CONNECTED",
      entity: "Socket",
      entityId: socket.id,
      source: "SOCKET",
      severity: "LOW",
      meta: {
        socketId: socket.id,
        email: socket.userEmail,
      },
    }).catch((err) => {
      console.error("Audit log error:", err.message);
    });

    /* ----------------
       🤝 CLIENT READY
    ----------------- */
    socket.on("CLIENT_READY", () => {
      socket.emit("SOCKET_READY", {
        connected: true,
        socketId: socket.id,
        role: socket.userRole,
        email: socket.userEmail,
        timestamp: new Date().toISOString(),
      });

      console.log(`📨 Client ready: ${socket.userEmail}`);
    });

    /* ----------------
       👋 DISCONNECT
    ----------------- */
    socket.on("disconnect", (reason) => {
      console.log(`
❌ Socket disconnected
   👤 User: ${socket.userEmail}
   🔑 Role: ${socket.userRole}
   📍 Reason: ${reason}
      `);

      AuditLog.create({
        actorId: socket.userId,
        actorRole: socket.userRole,
        action: "SOCKET_DISCONNECTED",
        entity: "Socket",
        entityId: socket.id,
        source: "SOCKET",
        severity: "LOW",
        meta: {
          reason,
          email: socket.userEmail,
        },
      }).catch((err) => {
        console.error("Audit log error:", err.message);
      });
    });

    /* ----------------
       ⚠️ ERROR HANDLER
    ----------------- */
    socket.on("error", (error) => {
      console.error(`❌ Socket error from ${socket.userEmail}:`, error);
    });
  });

  /* ================================
     🛠️ SERVER HELPER FUNCTIONS
  ================================ */

  /**
   * Emit to specific role
   * Usage: io.emitToRole("admin", "event_name", data)
   */
  io.emitToRole = (role, event, payload) => {
    io.to(`ROLE_${role}`).emit(event, payload);
  };

  /**
   * Emit to all admins
   * Usage: io.emitToAdmins("event_name", data)
   */
  io.emitToAdmins = (event, payload) => {
    io.to("ADMIN").emit(event, payload);
  };

  /**
   * Emit to all security
   * Usage: io.emitToSecurity("event_name", data)
   */
  io.emitToSecurity = (event, payload) => {
    io.to("SECURITY").emit(event, payload);
  };

  /**
   * Emit to reception
   * Usage: io.emitToReception("event_name", data)
   */
  io.emitToReception = (event, payload) => {
    io.to("RECEPTION").emit(event, payload);
  };

  /**
   * Emit to all connected users
   * Usage: io.emitToAll("event_name", data)
   */
  io.emitToAll = (event, payload) => {
    io.emit(event, payload);
  };

  return io;
}
