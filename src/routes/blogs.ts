// src/routes/blogs.ts
import { FastifyInstance } from "fastify";
import { getBlogs, addBlog } from "../controllers/blogController";

export default async function blogRoutes(fastify: FastifyInstance) {
  // Public: anyone can view blogs
  fastify.get("/blogs", getBlogs);

  // Admin only: requires fastify.adminGuard
  fastify.post("/blogs", { preHandler: [fastify.adminGuard] }, addBlog);
}
