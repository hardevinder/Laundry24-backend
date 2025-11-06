import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { generateInvoicePdf as generateInvoicePdfForOrder } from "../services/invoiceService";
import { sendOrderConfirmationEmail } from "../services/emailService";

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

/* ---------------------------
   Logging Helper
--------------------------- */
function safeLogError(request: any, err: any, ctx?: string) {
  try {
    const shortStack =
      (err && err.stack && String(err.stack).split("\n").slice(0, 2).join("\n")) || undefined;
    const message = String(err && err.message ? err.message : err);
    request.log?.error?.({ message, shortStack, ctx, errCode: err?.code, meta: err?.meta });
  } catch (_) {
    console.error("safeLogError fallback:", String(err));
  }
}

/* ---------------------------
   Helper Functions
--------------------------- */
function computeTotals(cartItems: any[]) {
  const subtotal = cartItems.reduce((s: number, it: any) => {
    const price = Number(it.price || 0);
    const qty = Number(it.quantity || 0);
    return s + price * qty;
  }, 0);
  const shipping = 0;
  const tax = 0;
  const discount = 0;
  const grandTotal = subtotal + shipping + tax - discount;
  return { subtotal, shipping, tax, discount, grandTotal };
}

function formatOrderNumber(orderId: number, date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  const idPart = String(orderId).padStart(6, "0");
  return `ORD-${d}-${idPart}`;
}

/* ---------------------------
   CHECKOUT CONTROLLER (No Stock Logic)
--------------------------- */
export const checkout = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const userId = (request as any).userId ? Number((request as any).userId) : undefined;

    if (!userId) {
      return reply.code(401).send({ error: "Login required to checkout" });
    }

    const paymentMethod = String(body.paymentMethod ?? "card");
    const customer = body.customer;
    request.log.info({ body }, "🧾 Incoming checkout body");

    if (!customer || !customer.name || !customer.email) {
      return reply.code(400).send({ error: "customer.name and customer.email required" });
    }

    // 🧠 Fetch user + cart
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        carts: {
          include: {
            items: {
              include: { variant: true },
            },
          },
        },
      },
    });

    if (!user) return reply.code(404).send({ error: "User not found" });

    const cart = user.carts[0];
    if (!cart || !cart.items?.length) {
      return reply.code(400).send({ error: "Your cart is empty" });
    }

    // ✅ Include remarks from cart items
    const cartItems = cart.items.map((it: any) => ({
      variantId: it.variantId,
      quantity: it.quantity,
      price: it.price,
      variant: it.variant,
      remarks: it.remarks ?? null, // ✅ added
    }));

    const totals = computeTotals(cartItems);

    // ✅ Allow empty postal code
    let shippingAddress =
      customer.address ?? body.address ?? {
        street: "",
        city: "",
        state: "",
        postalCode: "",
      };

    shippingAddress = {
      street: shippingAddress.street || "",
      city: shippingAddress.city || "",
      state: shippingAddress.state || "",
      postalCode: shippingAddress.postalCode || "",
    };

    /* ---------------------------
       🚚 Optional shipping rule
    --------------------------- */
    let shippingNumeric = 0;
    if (shippingAddress.postalCode && shippingAddress.postalCode.trim() !== "") {
      const postalCode = String(shippingAddress.postalCode || "").trim().toUpperCase();
      const postalPrefix = postalCode.slice(0, 3);

      const matchingRule = postalPrefix
        ? await prisma.shippingRule.findFirst({
            where: { isActive: true, name: { startsWith: postalPrefix } },
            orderBy: [{ priority: "desc" }, { id: "desc" }],
          })
        : null;

      if (matchingRule) {
        const ruleCharge = Number(matchingRule.charge ?? 0);
        const mov = Number(matchingRule.minOrderValue ?? 0);
        const subtotal = totals.subtotal;
        shippingNumeric = subtotal >= mov ? 0 : ruleCharge;
      }
    }

    const taxNumeric = 0;
    const discountNumeric = 0;
    const grandTotalNumeric = totals.subtotal + shippingNumeric + taxNumeric - discountNumeric;

    /* ---------------------------
       💳 Stripe Payment Flow
    --------------------------- */
    let stripeCustomerId = user.stripeId;
    if (!stripeCustomerId) {
      const customerStripe = await stripe.customers.create({
        email: user.email,
        name: user.name,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeId: customerStripe.id },
      });
      stripeCustomerId = customerStripe.id;
    }

    const deliveryFee = shippingNumeric > 0 ? shippingNumeric : 10;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(deliveryFee * 100),
      currency: "cad",
      customer: stripeCustomerId,
      description: "Laundry Pickup & Delivery Fee (CAD)",
      confirm: true,
      payment_method_data: {
        type: "card",
        card: { token: body.stripeToken },
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    /* ---------------------------
       🧾 Create Order (no stock checks)
    --------------------------- */
    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: "TEMP",
          userId,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone ?? null, // ✅ phone optional for Canada
          shippingAddress,
          subtotal: totals.subtotal,
          shipping: shippingNumeric,
          tax: taxNumeric,
          discount: discountNumeric,
          grandTotal: grandTotalNumeric,
          paymentMethod,
          paymentStatus: "partial",
          cartId: cart.id,
          orderStatus: "pending",
        },
      });

      // ✅ Create order items with remarks
      for (const ci of cartItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: ci.variantId,
            productName: ci.variant?.name ?? "Product",
            sku: ci.variant?.sku ?? null,
            quantity: ci.quantity,
            price: ci.price,
            total: ci.quantity * Number(ci.price),
            remarks: ci.remarks ?? null, // ✅ added
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      const orderNumber = formatOrderNumber(order.id);
      return tx.order.update({
        where: { id: order.id },
        data: { orderNumber },
        include: { items: true },
      });
    });

    /* ---------------------------
       🧾 Generate Invoice + Email
    --------------------------- */
    try {
      const pdfFilename = await generateInvoicePdfForOrder(createdOrder);
      if (pdfFilename) {
        await prisma.order.update({
          where: { id: createdOrder.id },
          data: { invoicePdfPath: pdfFilename },
        });
      }
    } catch (err) {
      safeLogError(request, err, "generateInvoicePdf");
    }

    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/api\/?$/i, "");
      const link = `${baseUrl}/orders/${createdOrder.orderNumber}`;
      await sendOrderConfirmationEmail({
        to: createdOrder.customerEmail,
        name: createdOrder.customerName,
        orderNumber: createdOrder.orderNumber,
        link,
        pdfFilename: createdOrder.invoicePdfPath ?? null,
      });
    } catch (e) {
      safeLogError(request, e, "sendOrderConfirmationEmail");
    }

    return reply.send({
      success: true,
      message: "Order placed successfully",
      order: createdOrder,
      deliveryPaymentIntent: paymentIntent.id,
    });
  } catch (err: any) {
    safeLogError(request, err, "checkout");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};
