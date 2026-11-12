import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Pool } from "pg";
import { emailAllowed } from "../../../packages/contracts/src/email-policy.js";
import { createMailSender } from "../../../packages/integrations/src/mail.js";
import type { AuthConfig } from "./config.js";
export function createAuth(
  config: AuthConfig,
  pool = new Pool({ connectionString: config.databaseURL }),
) {
  const send = createMailSender(config.mail);
  return betterAuth({
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/request-password-reset" &&
          (!config.mail.url || !config.mail.from)
        )
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: "Password reset is unavailable",
          });
      }),
    },
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [config.baseURL],
    database: pool,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      sendResetPassword: async ({ user, url }) =>
        send({
          to: user.email,
          subject: "Reset your LoopMart password",
          text: url,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        send({
          to: user.email,
          subject: "Verify your LoopMart email",
          text: url,
        }),
    },
    user: {
      additionalFields: {
        banned: { type: "boolean", defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const result = await pool.query(
              'SELECT "emailVerified", banned FROM "user" WHERE id = $1',
              [session.userId],
            );
            const user = result.rows[0];
            if (!user || user.emailVerified !== true || user.banned !== false)
              throw new APIError("FORBIDDEN", {
                message: "Verified active membership required",
              });
            return { data: session };
          },
        },
      },
      user: {
        create: {
          before: async (user) => {
            if (!emailAllowed(user.email, config.domains))
              throw new APIError("FORBIDDEN", {
                message: "Email domain is not allowed",
              });
            if (!config.mail.url || !config.mail.from)
              throw new APIError("SERVICE_UNAVAILABLE", {
                message: "Registration is unavailable",
              });
            return {
              data: {
                ...user,
                email: user.email.toLowerCase(),
                emailVerified: false,
              },
            };
          },
        },
      },
    },
  });
}
