"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = categoriesRoutes;
const categoryController_1 = require("../controllers/categoryController");
async function categoriesRoutes(app) {
    /* -------------------------------
       🌍 Public Category Routes
    ------------------------------- */
    app.get("/categories", categoryController_1.listCategories);
    app.get("/categories/:slug", categoryController_1.getCategoryBySlug);
    /* -------------------------------
       🔒 Admin Category Routes
    ------------------------------- */
    app.get("/admin/categories", { preHandler: [app.adminGuard] }, categoryController_1.listCategories);
    app.post("/admin/categories", { preHandler: [app.adminGuard] }, categoryController_1.createCategory);
    app.put("/admin/categories/:id", { preHandler: [app.adminGuard] }, categoryController_1.updateCategory);
    app.delete("/admin/categories/:id", { preHandler: [app.adminGuard] }, categoryController_1.deleteCategory);
}
//# sourceMappingURL=categories.js.map