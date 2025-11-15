// src/controllers/ordersController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";

const prisma = new PrismaClient();

/* Safe logger */
function safeLogError(request: any, err: any, ctx?: string) {
  try {
    const shortStack =
      (err && err.stack && String(err.stack).split("\n").slice(0, 2).join("\n")) ||
      undefined;
    const message = String(err && err.message ? err.message : err);
    request.log?.error?.({ message, shortStack, ctx, errCode: err?.code, meta: err?.meta });
  } catch (_) {
    // eslint-disable-next-line no-console
    console.error("safeLogError fallback:", String(err));
  }
}

/* Serialize */
function serializeOrderForClient(raw: any) {
  if (!raw) return raw;
  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    guestAccessToken: raw.guestAccessToken ?? null,
    userId: raw.userId ?? null,
    customerName: raw.customerName,
    customerEmail: raw.customerEmail,
    customerPhone: raw.customerPhone ?? null,
    shippingAddress: raw.shippingAddress ?? null,
    subtotal: raw.subtotal != null ? String(raw.subtotal) : raw.subtotal,
    shipping: raw.shipping != null ? String(raw.shipping) : raw.shipping,
    tax: raw.tax != null ? String(raw.tax) : raw.tax,
    discount: raw.discount != null ? String(raw.discount) : raw.discount,
    grandTotal: raw.grandTotal != null ? String(raw.grandTotal) : raw.grandTotal,
    paymentMethod: raw.paymentMethod,
    paymentStatus: raw.paymentStatus,
    invoicePdfPath: raw.invoicePdfPath ?? null,
    items: Array.isArray(raw.items)
      ? raw.items.map((it: any) => ({
          id: it.id,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          price: it.price != null ? String(it.price) : it.price,
          total: it.total != null ? String(it.total) : it.total,
        }))
      : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/* invoice path resolver (safe) */
async function resolveInvoiceFilePath(invoicePdfPath: string | null | undefined) {
  const invoicesDir = process.env.INVOICE_UPLOAD_DIR
    ? path.resolve(process.env.INVOICE_UPLOAD_DIR)
    : path.join(process.cwd(), "uploads", "invoices");

  if (!invoicePdfPath) return null;

  const absoluteCandidate = path.resolve(invoicePdfPath);
  const relFromInvoices = path.relative(invoicesDir, absoluteCandidate);
  if (!relFromInvoices.startsWith("..") && relFromInvoices !== "") {
    return absoluteCandidate;
  }

  const normalized = path.normalize(invoicePdfPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.resolve(invoicesDir, normalized);
  const rel = path.relative(invoicesDir, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return candidate;
}

/* ---------------------------
   LIST ORDERS (Admin / internal)
   Supports optional q (text search), page, pageSize
--------------------------- */
export const listOrders = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (request.query as any)?.q ?? undefined;
    const page = Math.max(Number((request.query as any)?.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number((request.query as any)?.pageSize ?? 20), 1), 200);
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // NOTE: ❌ No userId filter here now
    // Admin guard already protects this route

    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return reply.send({
      data: orders.map(serializeOrderForClient),
      meta: { total, page, pageSize },
    });
  } catch (err: any) {
    safeLogError(request, err, "listOrders");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* GET /api/orders/:orderNumber */
export const getOrder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params: any = request.params || {};
    const orderNumber = String(params.orderNumber || "");
    if (!orderNumber) return reply.code(400).send({ error: "orderNumber required" });

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, user: true },
    });
    if (!order) return reply.code(404).send({ error: "Order not found" });

    const reqAny: any = request;
    const userId: number | undefined = reqAny.userId;
    const guestToken: string | undefined =
      reqAny.guestToken ?? (request.query && (request.query as any).token);

    if (userId) {
      if (order.userId !== null && Number(order.userId) === Number(userId)) {
        // allowed
      } else if (order.guestAccessToken && guestToken && order.guestAccessToken === guestToken) {
        // allowed
      } else {
        return reply.code(403).send({ error: "Forbidden" });
      }
    } else {
      if (!guestToken || order.guestAccessToken !== guestToken) {
        return reply.code(403).send({ error: "Forbidden - guest token required" });
      }
    }

    return reply.send({ data: serializeOrderForClient(order) });
  } catch (err: any) {
    safeLogError(request, err, "getOrder");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* GET /api/orders/:orderNumber/invoice.pdf */
export const getInvoicePdf = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params: any = request.params || {};
    const orderNumber = String(params.orderNumber || "");
    if (!orderNumber) return reply.code(400).send({ error: "orderNumber required" });

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) return reply.code(404).send({ error: "Order not found" });

    const reqAny: any = request;
    const userId: number | undefined = reqAny.userId;
    const guestToken: string | undefined =
      reqAny.guestToken ?? (request.query && (request.query as any).token);

    if (userId) {
      if (order.userId !== null && Number(order.userId) === Number(userId)) {
        // ok
      } else if (order.guestAccessToken && guestToken && order.guestAccessToken === guestToken) {
        // ok
      } else {
        return reply.code(403).send({ error: "Forbidden" });
      }
    } else {
      if (!guestToken || order.guestAccessToken !== guestToken) {
        return reply.code(403).send({ error: "Forbidden - guest token required" });
      }
    }

    if (!order.invoicePdfPath) {
      request.log?.info?.({ orderNumber }, "order has no invoicePdfPath");
      return reply.code(404).send({ error: "Invoice PDF not found" });
    }

    const resolved = await resolveInvoiceFilePath(order.invoicePdfPath);
    if (!resolved) {
      request.log?.warn?.(
        { orderNumber, invoicePdfPath: order.invoicePdfPath },
        "invoice path refused or invalid",
      );
      return reply.code(400).send({ error: "Invalid invoice path" });
    }

    let stats;
    try {
      stats = await fs.stat(resolved);
      if (!stats.isFile()) {
        request.log?.warn?.({ resolved }, "invoice path is not a file");
        return reply.code(404).send({ error: "Invoice PDF not found" });
      }
    } catch (err) {
      request.log?.info?.({ resolved, err }, "invoice file missing");
      return reply.code(404).send({ error: "Invoice PDF not found" });
    }

    reply.header("Content-Type", "application/pdf");
    const filename = `${order.orderNumber}.pdf`.replace(/["\\]/g, "");
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    reply.header("Content-Length", String(stats.size));

    const stream = createReadStream(resolved);
    stream.once("error", (err) => {
      safeLogError(request, err, "invoiceStreamError");
      try {
        reply.code(500).send({ error: "Error streaming invoice PDF" });
      } catch (_) {}
    });

    return reply.send(stream);
  } catch (err: any) {
    safeLogError(request, err, "getInvoicePdf");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   POST /api/orders/:orderId/repeat
   Create a new Cart from an existing order
--------------------------- */
export const repeatOrder = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const params: any = request.params || {};
    const orderIdNum = Number(params.orderId || params.id);
    if (!orderIdNum) {
      return reply.code(400).send({ error: "orderId required" });
    }

    const reqAny: any = request;
    const userId = reqAny.userId ? Number(reqAny.userId) : undefined;
    if (!userId) {
      return reply.code(401).send({ error: "Login required" });
    }

    // 🔎 Make sure order belongs to this user
    const oldOrder = await prisma.order.findFirst({
      where: {
        id: orderIdNum,
        userId,
      },
      include: {
        items: true,
      },
    });

    if (!oldOrder) {
      return reply.code(404).send({ error: "Order not found" });
    }

    // 🛒 Create new cart for this user
    const newCart = await prisma.cart.create({
      data: {
        userId,
      },
    });

    // ♻ Copy items from order to cart
    for (const item of oldOrder.items) {
      if (!item.variantId) continue;

      const variant = await prisma.variant.findUnique({
        where: { id: item.variantId },
      });

      if (!variant) {
        // Variant deleted / not available -> skip
        continue;
      }

      // Price decision: prefer salePrice, then price, then old order item price
      const priceDecimal =
        (variant.salePrice as any) ??
        (variant.price as any) ??
        (item.price as any);

      await prisma.cartItem.create({
        data: {
          cartId: newCart.id,
          variantId: variant.id,
          quantity: item.quantity,
          price: priceDecimal,
          remarks: item.remarks ?? null,
        },
      });
    }

    return reply.send({
      success: true,
      message: "Cart created from previous order",
      cartId: newCart.id,
    });
  } catch (err: any) {
    safeLogError(request, err, "repeatOrder");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

export default {
  listOrders,
  getOrder,
  getInvoicePdf,
  repeatOrder,
};
