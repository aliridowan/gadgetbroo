import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";
import { passwordSchema } from "../zodSchemas/passwordSchema";
import { EmailService } from "@/lib/services/emailService";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Wires POST /api/auth/request-password-reset (currently 400s with
    // "Reset password isn't enabled" without this) to actually send mail.
    // `url` here is already the full, correct link — better-auth builds
    // it (token creation + expiry + the validate-then-redirect hop
    // through GET /api/auth/reset-password/:token) before calling this;
    // EmailService's only job is turning it into an email.
    sendResetPassword: async ({ user, url }) => {
      await EmailService.sendPasswordResetEmail({
        to: user.email,
        fullName: user.name,
        resetUrl: url,
      });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // This ensures ANY new user (Email OR Google) gets the customer role automatically
          const customerRole = await prisma.role.findUnique({
            where: { name: "customer" },
          });
          if (customerRole && !user.roleId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { roleId: customerRole.id },
            });
          }
        }
      }
    }
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: {
      trustedProxies: ["127.0.0.1", "::1", "0.0.0.0"],
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },

  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:2323",
    "https://dev.gadgetbroo.com",
    "http://dev.gadgetbroo.com"
  ],
  // backend zod validation on hooks
  // hooks er kahini hocce backend a check korar jonno mane zod schema backend a use korar jonno hooks abong safeParse use kora lage

  rateLimit: {
    // Turned off for now — the per-IP resolution this depends on
    // (advanced.ipAddress.trustedProxies/ipAddressHeaders above) isn't
    // configured correctly for wherever this actually deploys yet, so
    // instead of enforcing per-IP limits it was falling back to one
    // shared bucket for every visitor — meaning a handful of requests
    // from anyone could lock out sign-in for everyone, the opposite of
    // what this is supposed to protect against. Revisit once the real
    // deployment's reverse proxy / CDN setup is known and trustedProxies
    // is configured to match it — everything below is left as-is so
    // turning it back on later is just this one flag.
    enabled: false,
    window: 60,                 // seconds
    max: 100,                   // requests per window
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },   // strict
      "/sign-up/email": { window: 60, max: 5 },    // strict
      "/get-session": false,   // no limit on reads
    },

    storage: "database",          // stores in a `rateLimit` table
    modelName: "rateLimit",    // default table name

  },
  hooks: {

    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path === "/sign-up/email" ||
        ctx.path === "/reset-password" ||
        ctx.path === "/change-password"
      ) {
        const password = ctx.body.password || ctx.body.newPassword;

        const result = passwordSchema.safeParse(password);

        if (!result.success) {
          throw new APIError("BAD_REQUEST", {
            message: "Password is not strong enough",
          });
        }
      }
    }),

  }
});

// type define kore dea laglo jate kore akhn ay type gulo use kora jai j gula role k indicate kore 
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;

