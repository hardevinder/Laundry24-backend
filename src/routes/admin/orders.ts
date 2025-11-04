import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  shipOrder,
  cancelOrder,
} from "../../controllers/adminOrdersController";

// 🧩 Reusable schema for :id parameter
const idParamSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer" } },
};

export default async function adminOrdersRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /* -----------------------------
     🔒 Admin: list all orders
  ----------------------------- */
  fastify.get(
    "/orders",
    { preHandler: [fastify.adminGuard], schema: { tags: ["admin", "orders"] } as any },
    listOrders
  );

  /* -----------------------------
     🔒 Admin: get single order
  ----------------------------- */
  fastify.get(
    "/orders/:id",
    {
      preHandler: [fastify.adminGuard],
      schema: { tags: ["admin", "orders"], params: idParamSchema } as any,
    },
    getOrder
  );

  /* -----------------------------
     🔒 Admin: update order status
  ----------------------------- */
  fastify.patch(
    "/orders/:id/status",
    {
      preHandler: [fastify.adminGuard],
      schema: {
        tags: ["admin", "orders"],
        params: idParamSchema,
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
            },
          },
        },
      } as any,
    },
    updateOrderStatus
  );

  /* -----------------------------
     🔒 Admin: update payment status
  ----------------------------- */
  fastify.patch(
    "/orders/:id/payment",
    {
      preHandler: [fastify.adminGuard],
      schema: {
        tags: ["admin", "orders"],
        params: idParamSchema,
        body: {
          type: "object",
          required: ["paymentStatus"],
          properties: {
            paymentStatus: {
              type: "string",
              enum: ["pending", "paid", "failed", "refunded"],
            },
          },
        },
      } as any,
    },
    updatePaymentStatus
  );

  /* -----------------------------
     🔒 Admin: mark order as shipped
  ----------------------------- */
  fastify.patch(
    "/orders/:id/ship",
    {
      preHandler: [fastify.adminGuard],
      schema: {
        tags: ["admin", "orders"],
        params: idParamSchema,
        body: {
          type: "object",
          properties: {
            trackingNumber: { type: ["string", "null"] },
          },
        },
      } as any,
    },
    shipOrder
  );

  /* -----------------------------
     🔒 Admin: cancel order
  ----------------------------- */
  fastify.post(
    "/orders/:id/cancel",
    {
      preHandler: [fastify.adminGuard],
      schema: {
        tags: ["admin", "orders"],
        params: idParamSchema,
        body: {
          type: "object",
          properties: { restock: { type: "boolean", default: true } },
        },
      } as any,
    },
    cancelOrder
  );
}
