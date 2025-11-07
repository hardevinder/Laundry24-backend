"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// src/config/prisma.ts
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient();
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    // Make Prisma available globally in Fastify instance
    fastify.decorate("prisma", exports.prisma);
    fastify.addHook("onClose", async (app) => {
        await app.prisma.$disconnect();
    });
});
//# sourceMappingURL=prisma.js.map