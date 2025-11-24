import { FastifyRequest, FastifyReply } from "fastify";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
// 👇 Adjust import to your prisma client file
import prisma from "../prisma"; // or "../db/prismaClient"

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

interface GoogleLoginBody {
  token: string; // Google ID token from frontend
}

export const googleLogin = async (
  req: FastifyRequest<{ Body: GoogleLoginBody }>,
  reply: FastifyReply
) => {
  try {
    const { token } = req.body;

    if (!token) {
      return reply.status(400).send({ error: "Missing Google token" });
    }

    // 1️⃣ Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return reply.status(400).send({ error: "Invalid Google token" });
    }

    const email = payload.email;
    const name = payload.name || "";
    const picture = payload.picture || null;

    // 2️⃣ Find or create user in DB
    // ⚠️ adjust field names to match your User model
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar: picture,          // change/remove if field not present
          authProvider: "google",   // change/remove if field not present
        },
      });
    }

    // 3️⃣ Create your own JWT access token
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4️⃣ Return token + user
    return reply.send({
      accessToken,
      user,
    });
  } catch (err) {
    console.error("googleLogin error:", err);
    return reply.status(500).send({ error: "Google login failed" });
  }
};
