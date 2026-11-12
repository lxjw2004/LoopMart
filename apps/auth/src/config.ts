export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = (key: string) => {
    const value = env[key];
    if (!value) throw new Error("Missing configuration: " + key);
    return value;
  };
  const secret = required("BETTER_AUTH_SECRET");
  if (secret.length < 32)
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  const baseURL = required("BETTER_AUTH_URL");
  const url = new URL(baseURL);
  if (
    url.origin !== baseURL ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(
      "BETTER_AUTH_URL must be an HTTPS origin or local HTTP origin",
    );
  const trustedOrigins = [baseURL, ...(env.TRUSTED_ORIGINS ?? "").split(",").map(x => x.trim()).filter(Boolean)];
  for (const origin of trustedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.username || parsed.password ||
        (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))))
      throw new Error("TRUSTED_ORIGINS must contain HTTPS or local HTTP origins");
  }
  const databaseURL = required("DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(new URL(databaseURL).protocol))
    throw new Error("DATABASE_URL must use PostgreSQL");
  const domains = (env.ALLOWED_EMAIL_DOMAINS ?? "purdue.edu")
    .split(",")
    .map((x) => x.trim().toLowerCase());
  if (domains.some((x) => !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(x)))
    throw new Error("Invalid email domain policy");
  if (Boolean(env.SMTP_URL) !== Boolean(env.MAIL_FROM))
    throw new Error("SMTP_URL and MAIL_FROM must be configured together");
  return {
    secret,
    trustedOrigins,
    baseURL,
    databaseURL,
    domains,
    mail: { url: env.SMTP_URL, from: env.MAIL_FROM },
  };
}
export type AuthConfig = ReturnType<typeof loadConfig>;
