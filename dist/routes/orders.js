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
       🔁 Repeat an order -> create new cart
       POST /orders/:orderId/repeat
    ------------------------------- */
    fastify.post("/orders/:orderId/repeat", { preHandler: [fastify.authenticate] }, async (req, reply) => ordersController_1.default.repeatOrder(req, reply));
    /* -------------------------------
       🧾 View single order (auth required)
       Delegates to ordersController.getOrder
    ------------------------------- */
    fastify.get("/orders/:orderNumber", { preHandler: [fastify.authenticate] }, async (req, reply) => ordersController_1.default.getOrder(req, reply));
    /* -------------------------------
       🧾 Download invoice PDF (auth required)
       Delegates to ordersController.getInvoicePdf
    ------------------------------- */
    fastify.get("/orders/:orderNumber/invoice.pdf", { preHandler: [fastify.authenticate] }, async (req, reply) => ordersController_1.default.getInvoicePdf(req, reply));
}
//# sourceMappingURL=orders.js.map