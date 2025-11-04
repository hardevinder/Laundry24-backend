import { FastifyInstance } from "fastify";
import ordersController from "../controllers/ordersController";
import orderController from "../controllers/orderController"; // new controller (placeOrder, getMyOrders)

/**
 * 🧩 Order Routes
 */
export default async function orderRoutes(fastify: FastifyInstance) {
  /* -------------------------------
     ✅ Place order (for customers)
  ------------------------------- */
  fastify.post(
    "/orders",
    { preHandler: [fastify.authenticate] },
    async (req, reply) => orderController.placeOrder(req, reply)
  );

  /* -------------------------------
     ✅ Get customer’s own orders
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
     🧾 View single order (auth OR guest)
  ------------------------------- */
  fastify.get(
    "/orders/:orderNumber",
    {
      preHandler: [
        async (req: any, reply: any) => {
          if (typeof fastify.optionalAuthOrGuestToken === "function") {
            await fastify.optionalAuthOrGuestToken(req, reply);
          } else {
            req.log?.warn?.(
              "auth plugin not available: optionalAuthOrGuestToken missing"
            );
          }
        },
      ],
    },
    async (req, reply) => ordersController.getOrder(req, reply)
  );

  /* -------------------------------
     🧾 Download invoice PDF
  ------------------------------- */
  fastify.get(
    "/orders/:orderNumber/invoice.pdf",
    {
      preHandler: [
        async (req: any, reply: any) => {
          if (typeof fastify.optionalAuthOrGuestToken === "function") {
            await fastify.optionalAuthOrGuestToken(req, reply);
          } else {
            req.log?.warn?.(
              "auth plugin not available: optionalAuthOrGuestToken missing"
            );
          }
        },
      ],
    },
    async (req, reply) => ordersController.getInvoicePdf(req, reply)
  );
}
