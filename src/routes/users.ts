import { FastifyInstance } from "fastify";
import { getUsers } from "../controllers/userController";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/users", { preHandler: [fastify.adminGuard] }, getUsers);
}
