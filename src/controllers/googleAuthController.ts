// src/controllers/googleAuthController.ts

import { FastifyRequest, FastifyReply } from "fastify";

export default {
  googleAuth: async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ message: "Google Auth route not yet implemented" });
  },

  googleCallback: async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ message: "Google callback route not yet implemented" });
  },
};
