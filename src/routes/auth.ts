// src/routes/auth.ts
import { FastifyInstance } from "fastify";
import { signup, login, logout, me, googleLogin } from "../controllers/authController";

export default async function authRoutes(app: FastifyInstance) {
  // 🔹 Regular JWT-based authentication routes
  app.post("/signup", signup);
  app.post("/login", login);
  app.post("/logout", logout);

  // Protect `/me` with JWT middleware
  app.get("/me", { preHandler: [app.authenticate] }, me);

  // 🔹 Google OAuth: Token-based login from frontend
  app.post("/google-login", googleLogin);

  // (Optional) Browser redirect-based Google OAuth (for web redirects)
  app.get("/auth/google", async (_req, _reply) => {
    _reply.send({ message: "Google Auth route not implemented yet" });
  });

  app.get("/auth/google/callback", async (_req, _reply) => {
    _reply.send({ message: "Google callback route not implemented yet" });
  });
}
