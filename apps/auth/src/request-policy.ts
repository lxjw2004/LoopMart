export function unavailableWithoutMail(
  path: string,
  configured: boolean,
): boolean {
  return (
    !configured &&
    new URL(path, "http://localhost").pathname ===
      "/api/auth/request-password-reset"
  );
}
