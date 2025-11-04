import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ---------------------------
   CREATE INQUIRY
--------------------------- */
export const createInquiry = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { companyName, fullName, email, phone, message } = request.body as {
      companyName?: string;
      fullName: string;
      email: string;
      phone?: string;
      message?: string;
    };

    if (!fullName || !email) {
      return reply.code(400).send({ error: "Full name and email are required." });
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        companyName: companyName ?? null,
        fullName,
        email,
        phone: phone ?? null,
        message: message ?? null,
      },
    });

    return reply.code(201).send({ success: true, data: inquiry });
  } catch (err: any) {
    request.log.error(err);
    return reply.code(500).send({
      error: "Failed to submit inquiry",
      detail: err.message,
    });
  }
};

/* ---------------------------
   LIST INQUIRIES
--------------------------- */
export const listInquiries = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const inquiries = await prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: inquiries });
  } catch (err: any) {
    return reply.code(500).send({
      error: "Failed to fetch inquiries",
      detail: err.message,
    });
  }
};

/* ---------------------------
   GET SINGLE INQUIRY
--------------------------- */
export const getInquiry = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: Number(id) },
    });
    if (!inquiry) {
      return reply.code(404).send({ error: "Inquiry not found" });
    }
    return reply.send({ data: inquiry });
  } catch (err: any) {
    return reply.code(500).send({
      error: "Failed to fetch inquiry",
      detail: err.message,
    });
  }
};

/* ---------------------------
   DELETE INQUIRY
--------------------------- */
export const deleteInquiry = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    await prisma.inquiry.delete({ where: { id: Number(id) } });
    return reply.code(204).send();
  } catch (err: any) {
    return reply.code(500).send({
      error: "Failed to delete inquiry",
      detail: err.message,
    });
  }
};
