/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY MIDDLEWARE - FIXED (NO MONGO-SANITIZE)
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ CORS allows cache-control headers
 * ✅ Security headers properly configured
 * ✅ Rate limiting setup
 * ✅ Data sanitization (without mongo-sanitize dependency)
 */

import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════════════

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        connectSrc: [
          "'self'",
          "http://localhost:*",
          "https://*",
          "ws://localhost:*",
          "wss://*",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS CONFIGURATION - ✅ FIXED FOR CACHE-CONTROL HEADERS
// ═══════════════════════════════════════════════════════════════════════════

export function corsConfig() {
  return cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5100",
        "http://localhost:5000",
        "http://localhost:3000",
        "http://localhost:3001",
        "https://vmstest.psginstitutions.in",
      ];

      // ✅ Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Origin not allowed"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    
    // ✅ CRITICAL FIX: Allow cache-control and other necessary headers
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
      "Expires",
      "If-None-Match",
      "If-Modified-Since",
      "X-API-Key",
      "Accept",
      "Accept-Language",
    ],
    
    // ✅ Expose these headers to client
    exposedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "ETag",
      "Last-Modified",
      "X-Total-Count",
      "X-Page-Number",
    ],
    
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 200,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA SANITIZATION (Without mongo-sanitize)
// ═══════════════════════════════════════════════════════════════════════════

export function dataSanitization() {
  // Simple inline sanitization middleware
  return [
    (req, res, next) => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === "object") {
          sanitizeObject(req.body);
        }
        
        // Sanitize query parameters
        if (req.query && typeof req.query === "object") {
          sanitizeObject(req.query);
        }
        
        // Sanitize URL parameters
        if (req.params && typeof req.params === "object") {
          sanitizeObject(req.params);
        }
        
        next();
      } catch (err) {
        console.error("❌ Sanitization error:", err.message);
        next();
      }
    }
  ];
}

// Helper function to sanitize objects
function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      // Remove script tags
      obj[key] = obj[key].replace(/<script[^>]*>.*?<\/script>/gi, "");
      
      // Remove SQL injection patterns
      obj[key] = obj[key].replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|FROM|WHERE)\b)/gi, "");
      
      // Remove NoSQL injection patterns like $ne, $gt, etc.
      obj[key] = obj[key].replace(/\$[a-z]+/gi, "");
      
      // Trim whitespace
      obj[key] = obj[key].trim();
    } else if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      sanitizeObject(obj[key]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ═══════════════════════════════════════════════════════════════════════════

// Global rate limiter: 500 requests per minute per IP
export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === "/health") return true;
    return false;
  },
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip || "unknown";
  },
});

// Auth rate limiter: 30 requests per 15 minutes per IP
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: "Too many authentication attempts from this IP, please try again later.",
  standardHeaders: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip || "unknown";
  },
});

// Strict rate limiter for sensitive endpoints: 5 requests per 15 minutes
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many requests to this sensitive endpoint, please try again later.",
  standardHeaders: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip || "unknown";
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST ID MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export function requestIdMiddleware(req, res, next) {
  req.id = req.headers["x-request-id"] || uuidv4();
  res.set("X-Request-ID", req.id);
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

export function loggingMiddleware(req, res, next) {
  const startTime = Date.now();

  // Capture the original res.json
  const originalJson = res.json;

  res.json = function (data) {
    const duration = Date.now() - startTime;
    const ip = req.headers["x-forwarded-for"] || req.ip || "unknown";

    const logInfo = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: ip,
    };

    // Color-coded logging based on status
    if (res.statusCode >= 400) {
      console.log(`\n❌ ${JSON.stringify(logInfo)}`);
    } else if (res.statusCode >= 300) {
      console.log(`\n⚠️ ${JSON.stringify(logInfo)}`);
    } else {
      console.log(`\n✅ ${JSON.stringify(logInfo)}`);
    }

    return originalJson.call(this, data);
  };

  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error(`\n🔴 ERROR [${req.id}]`);
  console.error(`   Status: ${status}`);
  console.error(`   Message: ${message}`);
  console.error(`   Path: ${req.path}`);
  console.error(`   Stack: ${err.stack}`);

  res.status(status).json({
    success: false,
    message,
    requestId: req.id,
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// NOT FOUND HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export function notFoundHandler(req, res) {
  console.warn(`\n⚠️ 404 NOT FOUND [${req.id}]`);
  console.warn(`   Path: ${req.path}`);
  console.warn(`   Method: ${req.method}`);

  res.status(404).json({
    success: false,
    message: `Route ${req.path} not found`,
    requestId: req.id,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT ALL
// ═══════════════════════════════════════════════════════════════════════════

export default {
  securityHeaders,
  corsConfig,
  dataSanitization,
  globalRateLimit,
  authRateLimit,
  strictRateLimit,
  requestIdMiddleware,
  loggingMiddleware,
  errorHandler,
  notFoundHandler,
};