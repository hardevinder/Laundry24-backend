// src/plugins/auth.ts
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
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
  }
}

export default fp(async function (fastify) {
  // ✅ JWT setup
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "super-secret",
  });

  // 🔸 Basic user auth
  fastify.decorate(
    "authenticate",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }
  );

  // 🔸 Admin-only guard
  fastify.decorate(
    "adminGuard",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
        if (!req.user?.isAdmin) {
          return reply.status(403).send({ error: "Forbidden: Admins only" });
        }
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }
  );

  // 🔸 requireAuth (same as authenticate but stores userId)
  fastify.decorate("requireAuth", async (req: any, reply: any) => {
    try {
      const payload: any = await req.jwtVerify();
      const uid = payload?.userId ?? payload?.id ?? payload?.sub;
      if (!uid) return reply.code(401).send({ error: "Invalid token" });
      req.userId = Number(uid);
    } catch (err) {
      req.log?.info?.({ err }, "requireAuth failed");
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // 🔸 optionalAuthOrGuestToken
  fastify.decorate("optionalAuthOrGuestToken", async (req: any, _reply: any) => {
    try {
      const payload: any = await req.jwtVerify();
      const uid = payload?.userId ?? payload?.id ?? payload?.sub;
      if (uid) req.userId = Number(uid);
    } catch (err) {
      req.log?.debug?.("optionalAuth: no valid JWT");
    }

    const qtoken = (req.query && (req.query as any).token) || null;
    const hdrToken =
      (req.headers && (req.headers["x-guest-token"] || req.headers["X-Guest-Token"])) || null;
    const authHeaderRaw =
      (req.headers && (req.headers.authorization || (req.headers as any).Authorization)) || null;

    if (qtoken && typeof qtoken === "string") req.guestToken = qtoken;
    else if (hdrToken && typeof hdrToken === "string") req.guestToken = hdrToken;
    else if (typeof authHeaderRaw === "string") {
      const parts = authHeaderRaw.split(/\s+/);
      if (Array.isArray(parts) && parts.length === 2 && parts[0]?.toLowerCase() === "guest") {
        req.guestToken = parts[1];
      }
    }
  });
});
