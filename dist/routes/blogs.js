"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = blogRoutes;
const blogController_1 = require("../controllers/blogController");
async function blogRoutes(fastify) {
    // Public: anyone can view blogs
    fastify.get("/blogs", blogController_1.getBlogs);
    // Admin only: requires fastify.adminGuard
    fastify.post("/blogs", { preHandler: [fastify.adminGuard] }, blogController_1.addBlog);
}
//# sourceMappingURL=blogs.js.map