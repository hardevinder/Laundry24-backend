"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = userRoutes;
const userController_1 = require("../controllers/userController");
async function userRoutes(fastify) {
    fastify.get("/users", { preHandler: [fastify.adminGuard] }, userController_1.getUsers);
}
//# sourceMappingURL=users.js.map