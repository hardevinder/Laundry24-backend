// src/middlewares/auth.ts
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

// ✅ Unified type to match src/plugins/auth.ts
export type AuthUser = {
  id: number;
  email?: string;
  role?: string;
  isAdmin?: boolean;
};

// ✅ Extend @fastify/jwt typings
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser; // for jwt.sign(...)
    user: AuthUser;    // for req.user after verify
  }
}

// ✅ Extend Fastify instance typings
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
    adminGuard: (req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => Promise<void>;
  }
}

// ✅ JWT middleware plugin
export default fp(async function (fastify) {
  // Register JWT plugin globally
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "super-secret",
  });

  // =====================================================
  // 🔹 Basic authentication
  // =====================================================
  fastify.decorate("authenticate", async function (req, reply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });

  // =====================================================
  // 🔹 Admin guard
  // =====================================================
  fastify.decorate("adminGuard", async function (req, reply) {
    try {
      await req.jwtVerify();
      if (!req.user?.isAdmin) {
        return reply.status(403).send({ error: "Forbidden: Admins only" });
      }
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
});
