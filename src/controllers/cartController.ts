import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

/* ---------------------------
   Logging / small utils
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
   Serializer
--------------------------- */
function serializeCartForClient(raw: any) {
  if (!raw) return raw;
  return {
    id: raw.id,
    userId: raw.userId ?? null,
    sessionId: raw.sessionId ?? null,
    items: Array.isArray(raw.items)
      ? raw.items.map((it: any) => ({
          id: it.id,
          variantId: it.variantId,
          quantity: it.quantity,
          price: it.price != null ? String(it.price) : it.price,
          remarks: it.remarks ?? "", // ✅ include remarks for client
          variant: it.variant
            ? {
                id: it.variant.id,
                name: it.variant.name,
                sku: it.variant.sku,
                price: it.variant.price != null ? String(it.variant.price) : it.variant.price,
              }
            : null,
        }))
      : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/* ---------------------------
   Cart lookup / create
--------------------------- */
async function findCart({ userId, sessionId }: { userId?: number; sessionId?: string }) {
  if (userId) {
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { variant: true } } },
    });
    if (cart) return cart;
  }
  if (sessionId) {
    const cart = await prisma.cart.findFirst({
      where: { sessionId },
      include: { items: { include: { variant: true } } },
    });
    if (cart) return cart;
  }
  return null;
}

async function createCart({ userId, sessionId }: { userId?: number; sessionId?: string }) {
  const data: any = {};
  if (userId) data.userId = userId;
  if (sessionId) data.sessionId = sessionId;
  return prisma.cart.create({
    data,
    include: { items: { include: { variant: true } } },
  });
}

/* ---------------------------
   Merge guest cart into user cart
--------------------------- */
export async function mergeGuestCartIntoUserCart(sessionId: string, userId: number) {
  if (!sessionId) return;
  const guestCart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: true },
  });
  if (!guestCart || !guestCart.items.length) return;

  let userCart = await prisma.cart.findFirst({ where: { userId }, include: { items: true } });
  if (!userCart) {
    userCart = await prisma.cart.create({ data: { userId }, include: { items: true } });
  }

  await prisma.$transaction(async (tx) => {
    for (const gi of guestCart.items) {
      const existing = await tx.cartItem.findFirst({
        where: { cartId: userCart.id, variantId: gi.variantId },
      });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + gi.quantity, price: gi.price, remarks: gi.remarks },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            variantId: gi.variantId,
            quantity: gi.quantity,
            price: gi.price,
            remarks: gi.remarks,
          },
        });
      }
    }
    await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}

/* ---------------------------
   GET CART (User Only)
--------------------------- */
export const getCart = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    let cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { variant: true } } },
    });

    if (!cart) {
      const empty = { id: null, userId: userId ?? null, sessionId: null, items: [] };
      return reply.send({ data: empty });
    }

    return reply.send({ data: serializeCartForClient(cart) });
  } catch (err: any) {
    safeLogError(request, err, "getCart");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   ADD TO CART (with remarks)
--------------------------- */
export const addToCart = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const variantId = Number(body.variantId);
    let qty = Number(body.quantity ?? 1);
    const remarks = String(body.remarks || "").trim(); // ✅ new field

    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    if (!variantId || Number.isNaN(variantId)) return reply.code(400).send({ error: "variantId required" });
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;

    const variant = await prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) return reply.code(404).send({ error: "Variant not found" });

    let cart = await findCart({ userId });
    if (!cart) {
      cart = await createCart({ userId });
    }

    const updatedCart = await prisma.$transaction(async (tx) => {
      const existingItem = await tx.cartItem.findFirst({ where: { cartId: cart!.id, variantId } });
      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + qty,
            price: String(variant.price),
            remarks: remarks || existingItem.remarks, // ✅ update remarks if provided
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart!.id,
            variantId,
            quantity: qty,
            price: String(variant.price),
            remarks, // ✅ store remarks
          },
        });
      }

      return tx.cart.findUnique({
        where: { id: cart!.id },
        include: { items: { include: { variant: true } } },
      });
    });

    return reply.send({ data: serializeCartForClient(updatedCart) });
  } catch (err: any) {
    safeLogError(request, err, "addToCart");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   UPDATE CART ITEM (quantity or remarks)
--------------------------- */
export const updateCartItem = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const itemId = Number((request.params as any).id);
    const body: any = request.body || {};
    const qty = Number(body.quantity);
    const remarks = body.remarks !== undefined ? String(body.remarks).trim() : undefined;

    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    if (!itemId || Number.isNaN(itemId)) return reply.code(400).send({ error: "Invalid item id" });
    if (!Number.isFinite(qty) || qty < 0) return reply.code(400).send({ error: "Invalid quantity" });

    if (qty === 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      const data: any = { quantity: qty };
      if (remarks !== undefined) data.remarks = remarks; // ✅ allow updating remarks
      await prisma.cartItem.update({ where: { id: itemId }, data });
    }

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { variant: true } } },
    });

    return reply.send({ data: serializeCartForClient(cart) });
  } catch (err: any) {
    safeLogError(request, err, "updateCartItem");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   REMOVE FROM CART
--------------------------- */
export const removeFromCart = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const itemId = Number((request.params as any).id);
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    if (!itemId || Number.isNaN(itemId)) return reply.code(400).send({ error: "Invalid item id" });

    const existing = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!existing) return reply.code(404).send({ error: "Cart item not found" });

    await prisma.cartItem.delete({ where: { id: itemId } });

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { variant: true } } },
    });

    return reply.send({ data: serializeCartForClient(cart) });
  } catch (err: any) {
    safeLogError(request, err, "removeFromCart");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   CLEAR CART
--------------------------- */
export const clearCart = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user?.id;
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) return reply.send({ data: { id: null, userId, items: [] } });

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    const fresh = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { variant: true } } },
    });

    return reply.send({ data: serializeCartForClient(fresh) });
  } catch (err: any) {
    safeLogError(request, err, "clearCart");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeGuestCartIntoUserCart,
};
