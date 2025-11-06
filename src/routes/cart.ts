// src/routes/cart.ts
import { FastifyPluginAsync } from "fastify";
import cartController from "../controllers/cartController";

const cartRoutes: FastifyPluginAsync = async (fastify) => {
  // ✅ Protected routes — use Fastify's built-in JWT authentication
  fastify.get(
    "/cart",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => cartController.getCart(req, reply)
  );

  fastify.post(
    "/cart/add",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => cartController.addToCart(req, reply)
  );

  fastify.put(
    "/cart/item/:id",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => cartController.updateCartItem(req, reply)
  );

  fastify.delete(
    "/cart/item/:id",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => cartController.removeFromCart(req, reply)
  );

  fastify.delete(
    "/cart/clear",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => cartController.clearCart(req, reply)
  );
};

export default cartRoutes;
