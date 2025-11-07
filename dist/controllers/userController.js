"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = void 0;
const getUsers = async (req, reply) => {
    try {
        // ✅ Ensure the request is from a logged-in user
        await req.server.requireAuth(req, reply);
        const users = await req.server.prisma.user.findMany({
            select: { id: true, name: true, email: true, isAdmin: true },
        });
        return reply.status(200).send({
            message: "Users fetched successfully",
            users,
        });
    }
    catch (error) {
        if (reply.sent)
            return; // avoid duplicate responses
        return reply.status(500).send({
            error: "Failed to fetch users",
            details: error instanceof Error ? error.message : error,
        });
    }
};
exports.getUsers = getUsers;
//# sourceMappingURL=userController.js.map