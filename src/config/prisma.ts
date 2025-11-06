// src/config/prisma.ts
import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export default fp(async (fastify) => {
  // Make Prisma available globally in Fastify instance
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (app) => {
    await app.prisma.$disconnect();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
