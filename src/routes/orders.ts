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
     🧾 View single order (auth required)
  ------------------------------- */
  fastify.get(
    "/orders/:orderNumber",
    { preHandler: [fastify.authenticate] },
    async (req: any, reply: any) => {
      try {
        const user = req.user; // populated by fastify.authenticate

        const order = await fastify.prisma.order.findUnique({
          where: { orderNumber: req.params.orderNumber },
          include: { items: true },
        });

        if (!order) {
          return reply.code(404).send({ error: "Order not found" });
        }

        // Verify that the logged-in user owns the order
        if (order.userId !== user.id) {
          return reply.code(403).send({ error: "Access denied" });
        }

        return reply.send({ data: order });
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({ error: "Failed to fetch order" });
      }
    }
  );

  /* -------------------------------
     🧾 Download invoice PDF (auth required)
  ------------------------------- */
  fastify.get(
    "/orders/:orderNumber/invoice.pdf",
    { preHandler: [fastify.authenticate] },
    async (req: any, reply: any) => {
      try {
        const user = req.user;

        const order = await fastify.prisma.order.findUnique({
          where: { orderNumber: req.params.orderNumber },
        });

        if (!order) {
          return reply.code(404).send({ error: "Order not found" });
        }

        if (order.userId !== user.id) {
          return reply.code(403).send({ error: "Access denied" });
        }

        // Forward to controller to stream or return file
        return ordersController.getInvoicePdf(req, reply);
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({ error: "Failed to download invoice" });
      }
    }
  );
}
