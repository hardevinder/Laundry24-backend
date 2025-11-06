// src/plugins/auth.ts
import fp from "fastify-plugin";
import { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminGuard: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthOrGuestToken: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    userId?: number | null;
    guestToken?: string | null;
    user?: any;
  }
}

export default fp(async function (fastify) {
  // ✅ Removed fastifyJwt registration — handled globally in server.ts

  // =====================================================
  // 🔹 Helper to extract userId from token payload
  // =====================================================
  async function extractUserId(req: FastifyRequest) {
    try {
      const payload: any = await req.jwtVerify();
      const uid = payload?.userId ?? payload?.id ?? payload?.sub;
      if (uid) {
        req.userId = Number(uid);
        req.user = payload;
      }
      return uid;
    } catch (err: any) {
      console.error("❌ JWT verification failed:", err.message);
      return null;
    }
  }

  // =====================================================
  // 🔸 Basic user authentication
  // =====================================================
  fastify.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    const ok = await extractUserId(req);
    if (!ok) return reply.status(401).send({ error: "Unauthorized" });
  });

  // =====================================================
  // 🔸 Admin-only guard
  // =====================================================
  fastify.decorate("adminGuard", async (req: FastifyRequest, reply: FastifyReply) => {
    const ok = await extractUserId(req);
    if (!ok) return reply.status(401).send({ error: "Unauthorized" });
    if (!req.user?.isAdmin) return reply.status(403).send({ error: "Forbidden: Admins only" });
  });

  // =====================================================
  // 🔸 Require auth (sets userId)
  // =====================================================
  fastify.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
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
