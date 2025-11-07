// src/plugins/auth.ts
import fp from "fastify-plugin";

// -------------------------------------------------------------
// ✅ Extend @fastify/jwt user typing safely (fixes TS2687/TS2717)
// -------------------------------------------------------------
declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      id: number;
      email?: string;
      role?: string;
      isAdmin?: boolean;
    };
  }
}

// -------------------------------------------------------------
// ✅ Extend Fastify interfaces (without redefining user)
// -------------------------------------------------------------
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      req: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;

    adminGuard: (
      req: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;

    requireAuth: (
      req: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;

    optionalAuthOrGuestToken: (
      req: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;
  }

  interface FastifyRequest {
    userId?: number | null;
    guestToken?: string | null;
  }
}

// -------------------------------------------------------------
// ✅ Plugin Implementation
// -------------------------------------------------------------
export default fp(async function (fastify) {
  // ⚙️ JWT handled globally in server.ts

  // =====================================================
  // 🔹 Helper to extract userId from JWT
  // =====================================================
  async function extractUserId(req: import("fastify").FastifyRequest) {
    try {
      const payload = await req.jwtVerify();
      const uid = (payload as any)?.userId ?? (payload as any)?.id ?? (payload as any)?.sub;
      if (uid) {
        req.userId = Number(uid);
        (req as any).user = payload; // assign safely
      }
      return uid;
    } catch (err: any) {
      console.error("❌ JWT verification failed:", err.message);
      return null;
    }
  }

  // =====================================================
  // 🔸 Basic Auth
  // =====================================================
  fastify.decorate("authenticate", async (req, reply) => {
    const ok = await extractUserId(req);
    if (!ok) return reply.status(401).send({ error: "Unauthorized" });
  });

  // =====================================================
  // 🔸 Admin-only Guard
  // =====================================================
  fastify.decorate("adminGuard", async (req, reply) => {
    const ok = await extractUserId(req);
    if (!ok) return reply.status(401).send({ error: "Unauthorized" });
    if (!(req as any).user?.isAdmin)
      return reply.status(403).send({ error: "Forbidden: Admins only" });
  });

  // =====================================================
  // 🔸 Require Auth
  // =====================================================
  fastify.decorate("requireAuth", async (req, reply) => {
    const ok = await extractUserId(req);
    if (!ok) return reply.code(401).send({ error: "Unauthorized" });
  });

  // =====================================================
  // 🔸 Optional Auth or Guest Token
  // =====================================================
  fastify.decorate("optionalAuthOrGuestToken", async (req: any, _reply: any) => {
    await extractUserId(req);

    const qtoken = req.query?.token || null;
    const hdrToken =
      req.headers["x-guest-token"] ||
      req.headers["X-Guest-Token"] ||
      null;
    const authHeaderRaw =
      req.headers.authorization ||
      (req.headers as any).Authorization ||
      null;

    if (typeof qtoken === "string") req.guestToken = qtoken;
    else if (typeof hdrToken === "string") req.guestToken = hdrToken;
    else if (typeof authHeaderRaw === "string") {
      const parts = authHeaderRaw.split(/\s+/);
      if (parts.length === 2 && parts[0]?.toLowerCase() === "guest") {
        req.guestToken = parts[1];
      }
    }
  });
});
