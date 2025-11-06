import { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

type JwtPayload = { id: number; email: string; isAdmin: boolean };

/* =========================
   👤 Signup (auto-login)
========================= */
export const signup = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, email, password } = (req.body ?? {}) as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return reply.status(400).send({ error: "Name, email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await req.server.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await req.server.prisma.user.create({
      data: { name, email: normalizedEmail, password: hashed, provider: "credentials" },
      select: { id: true, name: true, email: true, isAdmin: true },
    });

    // ✅ Use req.server.jwt.sign instead of req.jwt.sign
    const accessToken = req.server.jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.isAdmin } as JwtPayload,
      { expiresIn: "7d" }
    );

    return reply.status(201).send({
      message: "User registered successfully",
      user,
      accessToken,
    });
  } catch (error) {
    req.log.error(error);
    return reply.status(500).send({
      error: "Signup failed",
      details: (error as Error).message,
    });
  }
};

/* =========================
   🔐 Login (JWT Bearer)
========================= */
export const login = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userRecord = await req.server.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!userRecord) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    if (userRecord.provider === "google" || !userRecord.password) {
      return reply.status(400).send({ error: "Use Google login for this account" });
    }

    const valid = await bcrypt.compare(password, userRecord.password);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    // ✅ Use req.server.jwt.sign
    const accessToken = req.server.jwt.sign(
      { id: userRecord.id, email: userRecord.email, isAdmin: userRecord.isAdmin } as JwtPayload,
      { expiresIn: "7d" }
    );

    const user = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      isAdmin: userRecord.isAdmin,
    };

    return reply.status(200).send({
      message: "Login successful",
      user,
      accessToken,
    });
  } catch (error) {
    req.log.error(error);
    return reply.status(500).send({
      error: "Login failed",
      details: (error as Error).message,
    });
  }
};

/* =========================
   🔑 Google Login (JWT Bearer)
========================= */
export const googleLogin = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { token, idToken } = (req.body ?? {}) as { token?: string; idToken?: string };
    const googleToken = token || idToken;

    if (!googleToken) return reply.status(400).send({ error: "Missing Google token" });
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID is not set in environment variables");
    }

    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return reply.status(401).send({ error: "Invalid Google token: no email" });
    }
    if (payload.email_verified === false) {
      return reply.status(401).send({ error: "Google email not verified" });
    }

    const email = payload.email.trim().toLowerCase();
    const name = payload.name ?? "Google User";
    const avatar = payload.picture ?? null;

    const user = await req.server.prisma.user.upsert({
      where: { email },
      update: { name, avatar, provider: "google" },
      create: {
        name,
        email,
        avatar,
        provider: "google",
        password: await bcrypt.hash(Math.random().toString(36).slice(-10), 10),
      },
      select: { id: true, name: true, email: true, isAdmin: true },
    });

    // ✅ Use req.server.jwt.sign here too
    const accessToken = req.server.jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.isAdmin } as JwtPayload,
      { expiresIn: "7d" }
    );

    return reply.status(200).send({
      message: "Google login successful",
      user,
      accessToken,
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Google login failed");

    const isAuthError =
      error.message?.includes("invalid") ||
      error.message?.includes("expired") ||
      error.message?.includes("audience") ||
      error.message?.includes("token");

    return reply.status(isAuthError ? 401 : 500).send({
      error: "Google login failed",
      details: (error as Error).message,
    });
  }
};

/* =========================
   🚪 Logout (stateless)
========================= */
export const logout = async (_req: FastifyRequest, reply: FastifyReply) => {
  return reply.send({ message: "Logged out successfully" });
};

/* =========================
   🙋 Me (from Bearer token)
========================= */
export const me = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await req.jwtVerify<JwtPayload>();
    const id = (req.user as any).id as number;

    const user = await req.server.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isAdmin: true, avatar: true },
    });

    if (!user) return reply.code(404).send({ error: "User not found" });

    return reply.send({ user });
  } catch (error) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
};
