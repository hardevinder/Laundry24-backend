import { FastifyInstance, FastifyPluginOptions } from "fastify";
import * as shippingCtrl from "../../controllers/admin/shippingRulesController";

/**
 * Admin routes for ShippingRule management.
 *
 * All routes are protected by `fastify.adminGuard`.
 *
 * Additionally, this file exposes a **public** endpoint:
 *   GET /api/shipping/calculate?pincode=XXXX&subtotal=NNN
 * which returns computed shipping for the provided postal code & subtotal.
 */
export default async function shippingRulesRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* -----------------------------
     🔒 Admin: List & filter shipping rules
  ----------------------------- */
  fastify.get(
    "/shipping-rules",
    { preHandler: [fastify.adminGuard], schema: { tags: ["admin", "shipping"] } as any },
    shippingCtrl.listShippingRules
  );

  /* -----------------------------
     🔒 Admin: Create new shipping rule
  ----------------------------- */
  fastify.post(
    "/shipping-rules",
    { preHandler: [fastify.adminGuard], schema: { tags: ["admin", "shipping"] } as any },
    shippingCtrl.createShippingRule
  );

  /* -----------------------------
     🔒 Admin: Get single shipping rule
  ----------------------------- */
  fastify.get(
    "/shipping-rules/:id",
    { preHandler: [fastify.adminGuard], schema: { tags: ["admin", "shipping"] } as any },
    shippingCtrl.getShippingRule
  );

  /* -----------------------------
     🔒 Admin: Update shipping rule
  ----------------------------- */
  fastify.put(
    "/shipping-rules/:id",
    { preHandler: [fastify.adminGuard], schema: { tags: ["admin", "shipping"] } as any },
    shippingCtrl.updateShippingRule
  );

  /* -----------------------------
     🔒 Admin: Delete shipping rule
  ----------------------------- */
  fastify.delete(
    "/shipping-rules/:id",
    { preHandler: [fastify.adminGuard], schema: { tags: ["admin", "shipping"] } as any },
    shippingCtrl.deleteShippingRule
  );

  /* -----------------------------
     🌍 Public: Shipping calculation (Canada postal support)
  ----------------------------- */
  fastify.get(
    "/shipping/calculate",
    {
      schema: {
        tags: ["shipping"],
        querystring: {
          type: "object",
          properties: {
            pincode: { type: "string" },
            subtotal: { type: "string" },
          },
          required: ["pincode"],
        },
      } as any,
    },
    async (request, reply) => {
      try {
        const q: any = request.query || {};
        const pincodeRaw = q.pincode;
        const subtotalRaw = q.subtotal;

        if (!pincodeRaw || String(pincodeRaw).trim() === "") {
          return reply.code(400).send({ error: "pincode required" });
        }

        // ✅ Accept Canadian postal format: V6B1A1 or V6B 1A1
        const pincode = String(pincodeRaw).trim().toUpperCase();
        const postalRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/;
        if (!postalRegex.test(pincode)) {
          return reply.code(400).send({ error: "invalid pincode format" });
        }

        // ✅ Parse subtotal safely
        let subtotal = 0;
        if (subtotalRaw && String(subtotalRaw).trim() !== "") {
          const parsed = Number(subtotalRaw);
          if (Number.isFinite(parsed)) subtotal = parsed;
        }

        // ✅ Use correct function name from controller
        const result = await shippingCtrl.computeShippingForPostalCode(pincode, subtotal);
        const shippingNumber = result?.shipping != null ? Number(result.shipping) : 0;

        return reply.send({
          data: {
            pincode,
            subtotal,
            shipping: shippingNumber,
            appliedRule: result?.appliedRule ?? null,
          },
        });
      } catch (err: any) {
        try {
          (request as any).log?.error?.({
            err: err?.message ?? err,
            ctx: "shippingCalculate",
          });
        } catch {}
        return reply.code(500).send({ error: err?.message ?? "Internal error" });
      }
    }
  );
}
