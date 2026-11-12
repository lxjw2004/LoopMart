import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Pool } from "pg";
import { emailAllowed } from "../../../packages/contracts/src/email-policy.js";
import { createMailSender } from "../../../packages/integrations/src/mail.js";
import type { AuthConfig } from "./config.js";
export function createAuth(
  config: AuthConfig,
  pool = new Pool({ connectionString: config.databaseURL }),
  mailSender?: ReturnType<typeof createMailSender>,
) {
  const send = mailSender ?? createMailSender(config.mail);
  const mailReady = Boolean(mailSender || (config.mail.url && config.mail.from));
  const allowed = async (email: string) => {
    const result = await pool.query("SELECT data FROM settings WHERE id = true");
    const policy = result.rows[0]?.data;
    return policy?.allowAllEmailDomains === true || emailAllowed(email, policy?.allowedEmailDomains ?? config.domains);
  };
  return betterAuth({
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ["/request-password-reset", "/change-email", "/send-verification-email", "/sign-up/email"].includes(ctx.path) &&
          !mailReady
        )
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: "Password reset is unavailable",
          });
        if (ctx.path === "/change-email" && !(await allowed(String(ctx.body?.newEmail ?? ""))))
          throw new APIError("FORBIDDEN", { message: "Email domain is not allowed" });
      }),
    },
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    advanced: { useSecureCookies: config.baseURL.startsWith("https:") },
    database: pool,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
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
      changeEmail: { enabled: true, updateEmailWithoutVerification: false },
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
            if (!(await allowed(user.email)))
              throw new APIError("FORBIDDEN", {
                message: "Email domain is not allowed",
              });
            if (!mailReady)
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
