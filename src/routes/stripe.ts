import { FastifyInstance } from "fastify";
import { stripe } from "../config/stripe";

/**
 * Stripe Routes Plugin
 * Handles creating SetupIntents and charging delivery/pickup fees.
 * Currency: CAD 🇨🇦
 */
export default async function stripeRoutes(app: FastifyInstance) {
  const prisma = app.prisma; // reuse Prisma from plugin registration

  /* ------------------------------------------------------------------
   * 🔹 Create SetupIntent (for saving card)
   * ------------------------------------------------------------------ */
  app.post(
    "/create-setup-intent",
    { preHandler: [app.requireAuth] },
    async (req: any, reply) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return reply.status(404).send({ error: "User not found" });

        // ✅ Create Stripe customer if not already stored
        let customerId = user.stripeId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
          });
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeId: customer.id },
          });
          customerId = customer.id;
        }

        // ✅ Create SetupIntent to securely save card for future payments
        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ["card"],
          usage: "off_session",
        });

        return reply.send({ clientSecret: setupIntent.client_secret });
      } catch (err: any) {
        console.error("❌ SetupIntent error:", err);
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  /* ------------------------------------------------------------------
   * 🔹 Charge Delivery / Pickup Fee (one-time payment)
   * ------------------------------------------------------------------ */
  app.post(
    "/charge-delivery",
    { preHandler: [app.requireAuth] },
    async (req: any, reply) => {
      try {
        const { paymentMethodId, amount } = req.body; // amount in CAD

        if (!amount || isNaN(amount) || amount <= 0) {
          return reply.status(400).send({ error: "Invalid amount" });
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) return reply.status(404).send({ error: "User not found" });

        if (!user.stripeId)
          return reply.status(400).send({ error: "User has no Stripe customer" });

        // ✅ Create and confirm PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // convert CAD → cents
          currency: "cad", // 🇨🇦 Canadian dollars
          customer: user.stripeId,
          payment_method: paymentMethodId,
          confirm: true,
          off_session: true,
          description: "Laundry Pickup/Delivery Fee",
          automatic_payment_methods: { enabled: true },
        });

        return reply.send({ success: true, paymentIntent });
      } catch (err: any) {
        console.error("❌ Charge delivery error:", err);
        return reply.status(err.statusCode || 500).send({
          error: err.message,
          code: err.code,
        });
      }
    }
  );
}
