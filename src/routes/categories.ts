import { FastifyInstance } from "fastify";
import {
  listCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController";

export default async function categoriesRoutes(app: FastifyInstance) {
  /* -------------------------------
     🌍 Public Category Routes
  ------------------------------- */
  app.get("/categories", listCategories);
  app.get("/categories/:slug", getCategoryBySlug);

  /* -------------------------------
     🔒 Admin Category Routes
  ------------------------------- */
  app.get("/admin/categories", { preHandler: [app.adminGuard] }, listCategories);
  app.post("/admin/categories", { preHandler: [app.adminGuard] }, createCategory);
  app.put("/admin/categories/:id", { preHandler: [app.adminGuard] }, updateCategory);
  app.delete("/admin/categories/:id", { preHandler: [app.adminGuard] }, deleteCategory);
}
