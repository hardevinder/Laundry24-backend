"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/middlewares/auth.ts
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
exports.default = (0, fastify_plugin_1.default)(async function (fastify) {
    // ✅ Register JWT plugin
    fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || "super-secret",
    });
    // ✅ Add helpers to Fastify instance
    fastify.decorate("authenticate", async function (req, reply) {
        try {
            await req.jwtVerify();
        }
        catch (err) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
    });
    fastify.decorate("adminGuard", async function (req, reply) {
        try {
            await req.jwtVerify();
            if (!req.user?.isAdmin) {
                return reply.status(403).send({ error: "Forbidden: Admins only" });
            }
        }
        catch (err) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
    });
});
//# sourceMappingURL=auth.js.map