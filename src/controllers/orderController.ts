import { FastifyRequest, FastifyReply } from "fastify";
import { Prisma, Order } from "@prisma/client"; // Prisma.Decimal, Order type

/* ---------------------------
   Type: PlaceOrderBody
--------------------------- */
type PlaceOrderBody = {
  userId?: number;
  items: { variantId: number; quantity: number }[];
  shippingAddress?: {
    name?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string | number;
    country?: string;
    isDefault?: boolean;
  };
  paymentMethod?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  pickupTime?: string; // "Morning" | "Evening" | "Night" | "SameDay"
};

/* ---------------------------
   Helper: Validate Pincode
--------------------------- */
function parseAndValidatePincode(value: any): number | null {
  if (value === undefined || value === null) return null;
  const s = String(value).replace(/\D/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n)) return null;
  if (n < 10000 || n > 999999) return null;
  return n;
}

/* --------------------------------------------------
   ✅ Place Order (For Logged-in Customer)
-------------------------------------------------- */
export const placeOrder = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = (req.body ?? {}) as PlaceOrderBody;
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: "Items array is required" });
    }

    // strictly use logged-in user
    const userId = (req as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized: missing user" });
    }

    const prisma = (req.server as any).prisma;

    // Validate items
    for (const it of items) {
      if (
        !it ||
        typeof it.variantId !== "number" ||
        typeof it.quantity !== "number" ||
        it.quantity <= 0
      ) {
        return reply.status(400).send({ error: "Invalid variantId or quantity" });
      }
    }

    const variantIds = items.map((i) => i.variantId);
    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });

    if (variants.length !== variantIds.length) {
      return reply.status(400).send({ error: "Some product variants not found" });
    }

    const byId = new Map<number, any>(variants.map((v: any) => [v.id, v]));
    let subtotal = new Prisma.Decimal(0);
    for (const it of items) {
      const v = byId.get(it.variantId);
      subtotal = subtotal.add(new Prisma.Decimal(v.price).mul(it.quantity));
    }

    // Determine shipping address
    let shippingAddr = body.shippingAddress ?? null;
    if (!shippingAddr) {
      const addr = await prisma.address.findFirst({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      });
      if (addr) shippingAddr = addr;
    }

    if (!shippingAddr || !shippingAddr.postalCode) {
      return reply.status(400).send({ error: "Shipping address required" });
    }

    const pincode = parseAndValidatePincode(shippingAddr.postalCode);
    if (pincode === null)
      return reply.status(400).send({ error: "Invalid postal code" });

    // Check shipping rule
    const matchingRule = await prisma.shippingRule.findFirst({
      where: {
        isActive: true,
        pincodeFrom: { lte: pincode },
        pincodeTo: { gte: pincode },
      },
      orderBy: [{ priority: "desc" }, { id: "desc" }],
    });

    const shipping = matchingRule?.charge
      ? new Prisma.Decimal(matchingRule.charge)
      : new Prisma.Decimal(0);
    const tax = new Prisma.Decimal(0);
    const discount = new Prisma.Decimal(0);
    const grandTotal = subtotal.add(shipping).add(tax).sub(discount);

    // Create order
    const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

    const createdOrder = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        customerName: body.customerName ?? null,
        customerEmail: body.customerEmail ?? null,
        customerPhone: body.customerPhone ?? null,
        shippingAddress: {
          name: shippingAddr.name ?? null,
          phone: shippingAddr.phone ?? null,
          line1: shippingAddr.line1 ?? null,
          line2: shippingAddr.line2 ?? null,
          city: shippingAddr.city ?? null,
          state: shippingAddr.state ?? null,
          postalCode: String(shippingAddr.postalCode),
          country: shippingAddr.country ?? "IN",
        },
        subtotal,
        shipping,
        tax,
        discount,
        grandTotal,
        paymentMethod: body.paymentMethod ?? "unknown",
        paymentStatus: "pending",
        orderStatus: "pending",
        pickupTime: body.pickupTime ?? "Morning", // 🕒 Added new field
        items: {
          create: items.map((it) => {
            const v = byId.get(it.variantId);
            const price = new Prisma.Decimal(v.price);
            return {
              variantId: v.id,
              productName: v.product.name,
              sku: v.sku,
              quantity: it.quantity,
              price,
              total: price.mul(it.quantity),
            };
          }),
        },
      },
      include: { items: true },
    });

    return reply.status(201).send({
      message: "Order placed successfully",
      order: createdOrder,
      appliedShippingRule: matchingRule
        ? {
            id: matchingRule.id,
            name: matchingRule.name,
            charge: String(matchingRule.charge ?? "0"),
          }
        : null,
    });
  } catch (err: any) {
    (req as any).log?.error?.({ err }, "placeOrder failed");
    return reply.status(500).send({
      error: "Failed to place order",
      details: err?.message ?? String(err),
    });
  }
};

/* --------------------------------------------------
   ✅ Get My Orders (List of Customer Orders)
-------------------------------------------------- */
export const getMyOrders = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId =
      (req as any).user?.id ??
      (req as any).user?.userId ??
      (req as any).userId ??
      null;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized: missing user" });
    }

    const prisma = (req.server as any).prisma;

    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        paymentStatus: true,
        orderStatus: true,
        pickupTime: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 🧩 FIXED: Explicitly typed map callback
    return reply.send({
      message: "Customer orders fetched successfully",
      userId,
      data: orders.map((o: Order & { items: { productName: string; quantity: number; price: Prisma.Decimal }[] }) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        grandTotal: String(o.grandTotal),
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        pickupTime: o.pickupTime,
        createdAt: o.createdAt,
        itemCount: o.items.length,
        items: o.items,
      })),
    });
  } catch (err: any) {
    (req as any).log?.error?.({ err }, "getMyOrders failed");

    return reply.status(500).send({
      error: "Failed to fetch customer orders",
      details: err?.message ?? String(err),
    });
  }
};

export default { placeOrder, getMyOrders };
