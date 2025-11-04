import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listInquiries,
  getInquiry,
  deleteInquiry,
  createInquiry,
} from "../../controllers/inquiryController";

// JSON schema for route params
const idParamSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer" } },
};

export default async function adminInquiriesRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /* -----------------------------
     ✅ Public route: submit inquiry
  ----------------------------- */
  fastify.post(
    "/inquiry",
    {
      schema: {
        tags: ["public", "inquiry"],
        body: {
          type: "object",
          required: ["fullName", "email"],
          properties: {
            companyName: { type: ["string", "null"] },
            fullName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: ["string", "null"] },
            message: { type: ["string", "null"] },
          },
        },
      } as any,
    },
    createInquiry
  );

  /* -----------------------------
     🔒 Admin-only: list all inquiries
  ----------------------------- */
  fastify.get(
    "/admin/inquiries",
    {
      preHandler: [fastify.adminGuard],
      schema: { tags: ["admin", "inquiries"] } as any,
    },
    listInquiries
  );

  /* -----------------------------
     🔒 Admin-only: get single inquiry
  ----------------------------- */
  fastify.get(
    "/admin/inquiries/:id",
    {
      preHandler: [fastify.adminGuard],
      schema: { tags: ["admin", "inquiries"], params: idParamSchema } as any,
    },
    getInquiry
  );

  /* -----------------------------
     🔒 Admin-only: delete inquiry
  ----------------------------- */
  fastify.delete(
    "/admin/inquiries/:id",
    {
      preHandler: [fastify.adminGuard],
      schema: { tags: ["admin", "inquiries"], params: idParamSchema } as any,
    },
    deleteInquiry
  );
}
