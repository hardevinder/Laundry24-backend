// src/routes/checkout.ts
import { FastifyPluginAsync } from "fastify";
import { checkout } from "../controllers/checkoutController";

const checkoutRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/checkout",
    {
      preHandler: [
        async (req, reply) => {
          // 🧠 Log exactly what comes from frontend
          const authHeader = req.headers.authorization;
          req.log.info({ authHeader }, "🔍 Incoming Authorization header for /checkout");

          // If requireAuth plugin is available
          if (typeof fastify.requireAuth === "function") {
            try {
              // ✅ Extract Bearer token if present
              if (authHeader?.startsWith("Bearer ")) {
                req.headers.authorization = authHeader; // keep as-is
              } else if (authHeader) {
                // ⚠️ Support plain token fallback (frontend may not prefix)
                req.headers.authorization = `Bearer ${authHeader}`;
              } else {
                req.log.warn("⚠️ No Authorization header received at /checkout");
                return reply.code(401).send({ error: "Missing Authorization header" });
              }

              await fastify.requireAuth(req, reply);
              req.log.info("✅ requireAuth passed successfully for /checkout");
            } catch (err: any) {
              req.log.error({ err }, "❌ requireAuth failed for /checkout");
              return reply.code(401).send({
                error: "Unauthorized: Invalid or expired token. Please log in again.",
              });
            }
          } else {
            // 🚨 Auth plugin not configured
            req.log.warn("⚠️ requireAuth not available (auth plugin missing)");
            return reply
              .code(500)
              .send({ error: "Authentication system not configured" });
          }
        },
      ],
    },
    // Main controller
    async (req, reply) => {
      req.log.info("📦 Processing checkout request...");
      return checkout(req, reply);
    }
  );
};

export default checkoutRoutes;
