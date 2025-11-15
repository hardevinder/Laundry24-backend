// src/controllers/passwordController.ts

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "../services/emailService";

type ForgotPasswordBody = { email: string };
type ResetPasswordBody = { token: string; password: string };

export function createPasswordController(fastify: FastifyInstance) {
  const prisma = fastify.prisma; // use prisma via fastify plugin

  // =====================================
  // 1️⃣ Forgot Password
  // =====================================
  async function forgotPasswordHandler(
    request: FastifyRequest<{ Body: ForgotPasswordBody }>,
    reply: FastifyReply
  ) {
    const { email } = request.body || {};

    if (!email) {
      return reply.code(400).send({ error: "Email is required" });
    }

    const genericMessage =
      "If an account exists with this email, a reset link has been sent.";

    const user = await prisma.user.findUnique({ where: { email } });

    // do not leak whether user exists
    if (!user) {
      return reply.send({ message: genericMessage });
    }

    // remove existing reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(
      token
    )}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name || undefined,
        resetLink,
      });
    } catch (error) {
      // ✅ Only log – do NOT send 500 to client
      request.log.error(
        { error },
        "Failed to send reset email (SMTP config issue?)"
      );
      // We still fall through and return genericMessage below
    }

    // ✅ Always return generic success message
    return reply.send({ message: genericMessage });
  }

  // =====================================
  // 2️⃣ Reset Password
  // =====================================
  async function resetPasswordHandler(
    request: FastifyRequest<{ Body: ResetPasswordBody }>,
    reply: FastifyReply
  ) {
    const { token, password } = request.body || {};

    if (!token || !password) {
      return reply
        .code(400)
        .send({ error: "Token and new password are required" });
    }

    if (password.length < 6) {
      return reply
        .code(400)
        .send({ error: "Password must be at least 6 characters long." });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || !resetToken.user) {
      return reply.code(400).send({ error: "Invalid or expired reset link." });
    }

    if (resetToken.expiresAt < new Date()) {
      return reply.code(400).send({ error: "Reset link has expired." });
    }

    if (resetToken.usedAt) {
      return reply.code(400).send({
        error: "Reset link has already been used.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return reply.send({ message: "Password has been reset successfully." });
  }

  return {
    forgotPasswordHandler,
    resetPasswordHandler,
  };
}
