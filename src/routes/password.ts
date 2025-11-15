// src/routes/password.ts
import { FastifyInstance } from "fastify";
import { createPasswordController } from "../controllers/passwordController";

export default async function passwordRoutes(fastify: FastifyInstance) {
  const controller = createPasswordController(fastify);

  // With prefix "/api/auth" in server.ts,
  // final URLs become:
  // POST /api/auth/forgot-password
  // POST /api/auth/reset-password
  fastify.post("/forgot-password", controller.forgotPasswordHandler);
  fastify.post("/reset-password", controller.resetPasswordHandler);
}
