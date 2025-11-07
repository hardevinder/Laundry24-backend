"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const authController_1 = require("../controllers/authController");
async function authRoutes(app) {
    // 🔹 Regular JWT-based authentication routes
    app.post("/signup", authController_1.signup);
    app.post("/login", authController_1.login);
    app.post("/logout", authController_1.logout);
    // Protect `/me` with JWT middleware
    app.get("/me", { preHandler: [app.authenticate] }, authController_1.me);
    // 🔹 Google OAuth: Token-based login from frontend
    app.post("/google-login", authController_1.googleLogin);
    // (Optional) Browser redirect-based Google OAuth (for web redirects)
    app.get("/auth/google", async (_req, _reply) => {
        _reply.send({ message: "Google Auth route not implemented yet" });
    });
    app.get("/auth/google/callback", async (_req, _reply) => {
        _reply.send({ message: "Google callback route not implemented yet" });
    });
}
//# sourceMappingURL=auth.js.map