// src/middlewares/auth.ts
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";

// Your decoded JWT structure
export type AuthUser = { id: number; email: string; isAdmin?: boolean };

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser; // for jwt.sign(...)
    user: AuthUser;    // for req.user after verify
  }
}

export default fp(async function (fastify) {
  // ✅ Register JWT plugin
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "super-secret",
  });

  // ✅ Add helpers to Fastify instance
  fastify.decorate(
    "authenticate",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }
  );

  fastify.decorate(
    "adminGuard",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
        if (!req.user?.isAdmin) {
          return reply.status(403).send({ error: "Forbidden: Admins only" });
        }
      } catch (err) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }
  );
});
