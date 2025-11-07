// src/controllers/googleAuthController.ts

import { FastifyRequest, FastifyReply } from "fastify";

export default {
  googleAuth: async (_req: FastifyRequest, reply: FastifyReply) => {
    // ✅ prefixed with underscore to silence unused variable warning
    return reply.send({ message: "Google Auth route not yet implemented" });
  },

  googleCallback: async (_req: FastifyRequest, reply: FastifyReply) => {
    // ✅ same here
    return reply.send({ message: "Google callback route not yet implemented" });
  },
};
