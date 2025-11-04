"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = orderRoutes;
const ordersController_1 = __importDefault(require("../controllers/ordersController"));
const orderController_1 = __importDefault(require("../controllers/orderController")); // new controller (placeOrder, getMyOrders)
/**
 * 🧩 Order Routes
 */
async function orderRoutes(fastify) {
    /* -------------------------------
       ✅ Place order (for customers)
    ------------------------------- */
    fastify.post("/orders", { preHandler: [fastify.authenticate] }, async (req, reply) => orderController_1.default.placeOrder(req, reply));
    /* -------------------------------
       ✅ Get customer’s own orders
    ------------------------------- */
    fastify.get("/orders/my", { preHandler: [fastify.authenticate] }, async (req, reply) => orderController_1.default.getMyOrders(req, reply));
    /* -------------------------------
       🔒 Admin: list all orders
    ------------------------------- */
    fastify.get("/orders", { preHandler: [fastify.adminGuard] }, async (req, reply) => ordersController_1.default.listOrders(req, reply));
    /* -------------------------------
       🧾 View single order (auth OR guest)
    ------------------------------- */
    fastify.get("/orders/:orderNumber", {
        preHandler: [
            async (req, reply) => {
                if (typeof fastify.optionalAuthOrGuestToken === "function") {
                    await fastify.optionalAuthOrGuestToken(req, reply);
                }
                else {
                    req.log?.warn?.("auth plugin not available: optionalAuthOrGuestToken missing");
                }
            },
        ],
    }, async (req, reply) => ordersController_1.default.getOrder(req, reply));
    /* -------------------------------
       🧾 Download invoice PDF
    ------------------------------- */
    fastify.get("/orders/:orderNumber/invoice.pdf", {
        preHandler: [
            async (req, reply) => {
                if (typeof fastify.optionalAuthOrGuestToken === "function") {
                    await fastify.optionalAuthOrGuestToken(req, reply);
                }
                else {
                    req.log?.warn?.("auth plugin not available: optionalAuthOrGuestToken missing");
                }
            },
        ],
    }, async (req, reply) => ordersController_1.default.getInvoicePdf(req, reply));
}
//# sourceMappingURL=orders.js.map