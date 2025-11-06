import { FastifyRequest, FastifyReply } from "fastify";

export const getUsers = async (req: FastifyRequest, reply: FastifyReply) => {
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
  } catch (error) {
    if (reply.sent) return; // avoid duplicate responses
    return reply.status(500).send({
      error: "Failed to fetch users",
      details: error instanceof Error ? error.message : error,
    });
  }
};
