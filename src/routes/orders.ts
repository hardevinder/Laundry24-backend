import { FastifyInstance } from "fastify";
import ordersController from "../controllers/ordersController";
import orderController from "../controllers/orderController";

/**
 * 🧩 Order Routes
 * Fully protected by JWT authentication
 */
export default async function orderRoutes(fastify: FastifyInstance) {
  /* -------------------------------
     ✅ Place order (customer only)
  ------------------------------- */
  fastify.post(
    "/orders",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => orderController.placeOrder(req, reply)
  );

  /* -------------------------------
     ✅ Get logged-in customer’s orders
  ------------------------------- */
  fastify.get(
    "/orders/my",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => orderController.getMyOrders(req, reply)
  );

  /* -------------------------------
     🔒 Admin: list all orders
  ------------------------------- */
  fastify.get(
    "/orders",
    { preHandler: [fastify.adminGuard] },
    async (req, reply) => ordersController.listOrders(req, reply)
  );

  /* -------------------------------
     🔁 Repeat an order -> create new cart
     POST /orders/:orderId/repeat
  ------------------------------- */
  fastify.post(
    "/orders/:orderId/repeat",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => ordersController.repeatOrder(req, reply)
  );

  /* -------------------------------
     🧾 View single order (auth required)
     Delegates to ordersController.getOrder
  ------------------------------- */
  fastify.get(
    "/orders/:orderNumber",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => ordersController.getOrder(req, reply)
  );

  /* -------------------------------
     🧾 Download invoice PDF (auth required)
     Delegates to ordersController.getInvoicePdf
  ------------------------------- */
  fastify.get(
    "/orders/:orderNumber/invoice.pdf",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => ordersController.getInvoicePdf(req, reply)
  );
}
