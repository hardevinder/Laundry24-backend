// src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

import prismaPlugin from "./config/prisma";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import productRoutes from "./routes/products";
import orderRoutes from "./routes/orders";
import blogRoutes from "./routes/blogs";
import categoriesRoutes from "./routes/categories";
import cartRoutes from "./routes/cart";
import checkoutRoutes from "./routes/checkout";

import shippingRulesRoutes from "./routes/admin/shippingRules";
import * as shippingCtrl from "./controllers/admin/shippingRulesController";
import adminOrdersRoutes from "./routes/admin/orders";
import adminInquiriesRoutes from "./routes/admin/inquiries";
import stripeRoutes from "./routes/stripe";

// ✅ Auth plugin (guards, decorators)
import authPlugin from "./plugins/auth";

const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 7121);
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({
  logger: true,
  trustProxy: true,
});

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "products");
const INVOICES_DIR =
  process.env.INVOICE_UPLOAD_DIR ||
  path.join(process.cwd(), "uploads", "invoices");

// -----------------------------------------------------
// 🔹 Ensure directories exist
// -----------------------------------------------------
async function ensureDir(dirPath: string) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
  await fs.access(dirPath).catch(() => fs.mkdir(dirPath, { recursive: true }));
}

// -----------------------------------------------------
// 🔹 Start Fastify server
// -----------------------------------------------------
async function start() {
  try {
    process.on("unhandledRejection", (err: any) =>
      app.log.error(err, "unhandledRejection")
    );
    process.on("uncaughtException", (err: any) =>
      app.log.error(err, "uncaughtException")
    );

    // 1️⃣ Security headers
    await app.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    });

    // 2️⃣ Rate limiting
    await app.register(rateLimit, {
      max: 300,
      timeWindow: "1 minute",
      allowList: (req: any) => {
        const ip = String(req.ip || "");
        return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
      },
    });

    // 3️⃣ CORS setup
    await app.register(cors, {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowedOrigins = [
          "https://laundry24.ca",
          "https://www.laundry24.ca",
          "https://laundry24.in",
          "https://www.laundry24.in",
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ];
        if (allowedOrigins.includes(origin)) cb(null, true);
        else {
          console.warn("⚠️ CORS: Unlisted origin =>", origin);
          cb(null, true);
        }
      },
      methods: [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Cookie",
      ],
      exposedHeaders: ["set-cookie"],
      credentials: true,
      maxAge: 86400,
    });

    // 4️⃣ JWT globally
    await app.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || "supersecretlaundrykey",
    });

    // 5️⃣ Auth plugin (guards, decorators)
    await app.register(authPlugin);

    // 6️⃣ Prisma ORM
    await app.register(prismaPlugin);

    // 7️⃣ File uploads
    await app.register(fastifyMultipart, {
      limits: {
        fileSize: Number(
          process.env.UPLOAD_FILE_SIZE_LIMIT || 50 * 1024 * 1024
        ),
        files: Number(process.env.UPLOAD_MAX_FILES || 10),
      },
      attachFieldsToBody: true,
    });

    // 8️⃣ Cookies
    const cookieOptions: Record<string, unknown> = {};
    if (process.env.COOKIE_SECRET && process.env.COOKIE_SECRET !== "") {
      cookieOptions.secret = process.env.COOKIE_SECRET;
    }
    await app.register(fastifyCookie as any, cookieOptions as any);

    // 9️⃣ Ensure upload dirs
    await ensureDir(UPLOAD_DIR);
    await ensureDir(INVOICES_DIR);

    // 🔟 Serve static files
    await app.register(fastifyStatic, {
      root: path.join(process.cwd(), "uploads", "products"),
      prefix: "/uploads/products/",
      decorateReply: false,
    });

    await app.register(fastifyStatic, {
      root: path.join(process.cwd(), "uploads", "invoices"),
      prefix: "/uploads/invoices/",
      decorateReply: false,
    });

    // 🧾 Admin routes
    app.register(shippingRulesRoutes, { prefix: "/api/admin" });
    app.register(adminOrdersRoutes, { prefix: "/api/admin" });
    app.register(adminInquiriesRoutes, { prefix: "/api" });

    // 🚚 Shipping calculator (Canada)
    app.get("/api/shipping/calculate", async (request, reply) => {
      try {
        const q: any = request.query || {};
        const pincodeRaw = q.pincode;
        const subtotalRaw = q.subtotal;

        if (!pincodeRaw || String(pincodeRaw).trim() === "") {
          return reply.code(400).send({ error: "pincode required" });
        }

        const postalCode = String(pincodeRaw).trim().toUpperCase();
        const postalRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/;
        if (!postalRegex.test(postalCode)) {
          console.log("❌ Invalid postal format:", postalCode);
          return reply.code(400).send({ error: "invalid pincode format" });
        }

        let subtotal = 0;
        if (subtotalRaw && String(subtotalRaw).trim() !== "") {
          const parsed = Number(subtotalRaw);
          if (Number.isFinite(parsed)) subtotal = parsed;
        }

        const result = await shippingCtrl.computeShippingForPostalCode(
          postalCode,
          subtotal
        );

        return reply.send({
          data: {
            pincode: postalCode,
            subtotal,
            shipping: result?.shipping ?? 0,
            appliedRule: result?.appliedRule ?? null,
          },
        });
      } catch (err: any) {
        console.error("💥 shipping/calculate error:", err);
        (request as any).log?.error?.({
          err: err?.message ?? err,
          ctx: "shippingCalculate",
        });
        return reply
          .code(500)
          .send({ error: err?.message || "Internal error" });
      }
    });

    // 🌐 Main API routes
    app.register(authRoutes, { prefix: "/api/auth" });
    app.register(userRoutes, { prefix: "/api" });
    app.register(productRoutes, { prefix: "/api" });
    app.register(orderRoutes, { prefix: "/api" });
    app.register(blogRoutes, { prefix: "/api" });
    app.register(categoriesRoutes, { prefix: "/api" });
    app.register(cartRoutes, { prefix: "/api" });
    app.register(checkoutRoutes, { prefix: "/api" });
    app.register(stripeRoutes, { prefix: "/api/stripe" });

    // ✅ Health check route
    app.get("/health", async () => ({ ok: true }));

    await app.ready();
    if (!isProd) {
      console.log("\n=== ROUTES ===");
      console.log(app.printRoutes());
      console.log("==============\n");
    }

    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server running at http://${HOST}:${PORT}`);

    const close = async () => {
      try {
        await app.close();
        process.exit(0);
      } catch (e) {
        app.log.error(e);
        process.exit(1);
      }
    };

    process.on("SIGTERM", close);
    process.on("SIGINT", close);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
