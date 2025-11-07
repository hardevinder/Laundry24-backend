import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/* ---------------------------
   Safe logger
--------------------------- */
function safeLogError(request: FastifyRequest | any, err: any, ctx?: string) {
  try {
    const shortStack =
      (err && err.stack && String(err.stack).split("\n").slice(0, 2).join("\n")) || undefined;
    const message = String(err?.message || err);
    request.log?.error?.({ message, shortStack, ctx, errCode: err?.code, meta: err?.meta });
  } catch {
    console.error("safeLogError fallback:", String(err));
  }
}

/* ---------------------------
   Postal code utilities (Canada)
--------------------------- */
function extractPostalPrefix(postalCode: string | undefined | null): string | null {
  if (!postalCode) return null;

  // Remove spaces and uppercase
  const cleaned = postalCode.toUpperCase().replace(/\s+/g, "");

  // ✅ Match Canadian format like V6B1A1 or Y1A1A1
  const postalRegex = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;
  if (!postalRegex.test(cleaned)) {
    console.log("❌ Invalid Canadian postal:", postalCode);
    return null;
  }

  // ✅ Take only the first letter (V → BC, Y → Yukon, etc.)
  return cleaned.substring(0, 1);
}

/* ---------------------------
   Serializer
--------------------------- */
function serializeShippingRule(raw: any) {
  if (!raw) return raw;
  return {
    id: raw.id,
    name: raw.name ?? null,
    postalPrefix: raw.postalPrefix ?? null,
    charge: raw.charge != null ? String(raw.charge) : null,
    minOrderValue: raw.minOrderValue != null ? String(raw.minOrderValue) : null,
    priority: raw.priority,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/* ---------------------------
   Find active rule for a postal prefix
--------------------------- */
export async function findActiveShippingRuleForPostalPrefix(prefix: string) {
  if (!prefix) return null;

  const rule = await prisma.shippingRule.findFirst({
    where: {
      isActive: true,
      postalPrefix: {
        startsWith: prefix,
        mode: "insensitive",
      },
    },
    orderBy: [{ priority: "desc" }, { id: "desc" }],
  });

  return rule ?? null;
}

/* ---------------------------
   Compute shipping charge (Canada)
--------------------------- */
export async function computeShippingForPostalCode(postalCode: string, subtotal: number) {
  const prefix = extractPostalPrefix(postalCode);
  if (!prefix) {
    return { error: "invalid_postal", shipping: 0, appliedRule: null };
  }

  const rule = await findActiveShippingRuleForPostalPrefix(prefix);
  if (!rule) {
    return { shipping: 0, appliedRule: null };
  }

  const minOrderValue = rule.minOrderValue != null ? Number(String(rule.minOrderValue)) : null;
  const charge = rule.charge != null ? Number(String(rule.charge)) : 0;

  if (minOrderValue != null && Number.isFinite(subtotal) && subtotal >= minOrderValue) {
    return { shipping: 0, appliedRule: serializeShippingRule(rule) };
  }

  return { shipping: charge, appliedRule: serializeShippingRule(rule) };
}

/* ---------------------------
   LIST Shipping Rules
--------------------------- */
export const listShippingRules = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (request.query as any).q as string | undefined;
    const isActiveQ = (request.query as any).isActive as string | undefined;
    const page = Math.max(parseInt(((request.query as any).page as string) || "1", 10), 1);
    const limit = Math.min(parseInt(((request.query as any).limit as string) || "50", 10), 500);

    const where: Prisma.ShippingRuleWhereInput = {
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(isActiveQ ? { isActive: isActiveQ === "true" } : {}),
    };

    const rules = await prisma.shippingRule.findMany({
      where,
      orderBy: [{ priority: "desc" }, { postalPrefix: "asc" }],
      take: limit,
      skip: (page - 1) * limit,
    });

    const mapped = rules.map((r) => serializeShippingRule(r));
    return reply.send({ data: mapped });
  } catch (err: any) {
    safeLogError(request, err, "listShippingRules");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   GET Single Rule
--------------------------- */
export const getShippingRule = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const id = Number((request.params as any).id);
    if (!id) return reply.code(400).send({ error: "id required" });

    const rule = await prisma.shippingRule.findUnique({ where: { id } });
    if (!rule) return reply.code(404).send({ error: "Shipping rule not found" });

    return reply.send({ data: serializeShippingRule(rule) });
  } catch (err: any) {
    safeLogError(request, err, "getShippingRule");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   CREATE Rule
--------------------------- */
export const createShippingRule = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body: any = request.body || {};
    const postalPrefix = extractPostalPrefix(body.postalPrefix);
    const charge = body.charge;
    if (!postalPrefix) return reply.code(400).send({ error: "postalPrefix required or invalid" });
    if (charge === undefined || charge === null || String(charge).trim() === "")
      return reply.code(400).send({ error: "charge is required" });

    const existing = await prisma.shippingRule.findFirst({
      where: { postalPrefix, isActive: true },
    });

    const created = await prisma.shippingRule.create({
      data: {
        name: body.name ?? `Shipping: ${postalPrefix}`,
        postalPrefix,
        charge: String(charge),
        minOrderValue:
          body.minOrderValue !== undefined && body.minOrderValue !== null
            ? String(body.minOrderValue)
            : null,
        priority: body.priority !== undefined ? Number(body.priority) : 0,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    });

    const resp: any = { data: serializeShippingRule(created) };
    if (existing)
      resp.note = "Existing active rule found for this postalPrefix. Adjust priority if needed.";

    return reply.code(201).send(resp);
  } catch (err: any) {
    safeLogError(request, err, "createShippingRule");
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   UPDATE Rule
--------------------------- */
export const updateShippingRule = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const id = Number((request.params as any).id);
    if (!id) return reply.code(400).send({ error: "id required" });

    const body: any = request.body || {};
    const postalPrefix =
      body.postalPrefix !== undefined ? extractPostalPrefix(body.postalPrefix) : undefined;

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (postalPrefix !== undefined) updateData.postalPrefix = postalPrefix;
    if (body.charge !== undefined) updateData.charge = String(body.charge);
    if (body.minOrderValue !== undefined)
      updateData.minOrderValue =
        body.minOrderValue === null ? null : String(body.minOrderValue);
    if (body.priority !== undefined) updateData.priority = Number(body.priority);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    const updated = await prisma.shippingRule.update({
      where: { id },
      data: updateData,
    });

    return reply.send({ data: serializeShippingRule(updated) });
  } catch (err: any) {
    safeLogError(request, err, "updateShippingRule");
    if (err?.code === "P2025")
      return reply.code(404).send({ error: "Shipping rule not found" });
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

/* ---------------------------
   DELETE Rule
--------------------------- */
export const deleteShippingRule = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const id = Number((request.params as any).id);
    if (!id) return reply.code(400).send({ error: "id required" });

    await prisma.shippingRule.delete({ where: { id } });
    return reply.code(204).send();
  } catch (err: any) {
    safeLogError(request, err, "deleteShippingRule");
    if (err?.code === "P2025")
      return reply.code(404).send({ error: "Shipping rule not found" });
    return reply.code(500).send({ error: err?.message || "Internal error" });
  }
};

export default {
  listShippingRules,
  getShippingRule,
  createShippingRule,
  updateShippingRule,
  deleteShippingRule,
  findActiveShippingRuleForPostalPrefix,
  computeShippingForPostalCode,
};
