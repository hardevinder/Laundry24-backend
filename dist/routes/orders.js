"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = orderRoutes;
const ordersController_1 = __importDefault(require("../controllers/ordersController"));
const orderController_1 = __importDefault(require("../controllers/orderController"));
/**
 * 🧩 Order Routes
 * Fully protected by JWT authentication
 */
async function orderRoutes(fastify) {
    /* -------------------------------
       ✅ Place order (customer only)
    ------------------------------- */
    fastify.post("/orders", { preHandler: [fastify.authenticate] }, async (req, reply) => orderController_1.default.placeOrder(req, reply));
    /* -------------------------------
       ✅ Get logged-in customer’s orders
    ------------------------------- */
    fastify.get("/orders/my", { preHandler: [fastify.authenticate] }, async (req, reply) => orderController_1.default.getMyOrders(req, reply));
    /* -------------------------------
       🔒 Admin: list all orders
    ------------------------------- */
    fastify.get("/orders", { preHandler: [fastify.adminGuard] }, async (req, reply) => ordersController_1.default.listOrders(req, reply));
    /* -------------------------------
       🧾 View single order (auth required)
    ------------------------------- */
    fastify.get("/orders/:orderNumber", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const user = req.user; // populated by fastify.authenticate
            const order = await fastify.prisma.order.findUnique({
                where: { orderNumber: req.params.orderNumber },
                include: { items: true },
            });
            if (!order) {
                return reply.code(404).send({ error: "Order not found" });
            }
            // Verify that the logged-in user owns the order
            if (order.userId !== user.id) {
                return reply.code(403).send({ error: "Access denied" });
            }
            return reply.send({ data: order });
        }
        catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: "Failed to fetch order" });
        }
    });
    /* -------------------------------
       🧾 Download invoice PDF (auth required)
    ------------------------------- */
    fastify.get("/orders/:orderNumber/invoice.pdf", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const user = req.user;
            const order = await fastify.prisma.order.findUnique({
                where: { orderNumber: req.params.orderNumber },
            });
            if (!order) {
                return reply.code(404).send({ error: "Order not found" });
            }
            if (order.userId !== user.id) {
                return reply.code(403).send({ error: "Access denied" });
            }
            // Forward to controller to stream or return file
            return ordersController_1.default.getInvoicePdf(req, reply);
        }
        catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: "Failed to download invoice" });
        }
    });
}
//# sourceMappingURL=orders.js.map