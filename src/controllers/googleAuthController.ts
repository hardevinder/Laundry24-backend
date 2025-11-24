// src/controllers/googleAuthController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import jwt from "jsonwebtoken";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
const JWT_SECRET = (process.env.JWT_SECRET as string) || "change_me";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

interface GoogleLoginBody {
  token: string; // Google ID token from frontend
}

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
};

/**
 * 📝 NOTE:
 * Abhi yeh DB use nahi kar raha.
 * Sirf Google payload se AppUser bana ke JWT generate kar raha hai.
 * Baad mein tu yahan pe apna real DB (Prisma/Sequelize) laga sakda.
 */
function mapPayloadToUser(payload: TokenPayload): AppUser {
  const id = (payload.sub as string) || (payload.email as string);
  return {
    id,
    email: payload.email as string,
    name: payload.name || null,
    avatar: payload.picture || null,
  };
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

    if (!GOOGLE_CLIENT_ID) {
      return reply
        .status(500)
        .send({ error: "GOOGLE_CLIENT_ID is not configured on server" });
    }

    // 1️⃣ Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID, // cast to string so TS is happy
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return reply.status(400).send({ error: "Invalid Google token" });
    }

    // 2️⃣ Map Google payload → AppUser (no DB yet)
    const user = mapPayloadToUser(payload);

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
