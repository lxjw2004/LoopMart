export function emailAllowed(
  email: string,
  policy: readonly string[] = ["purdue.edu"],
): boolean {
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  const domain = email.split("@")[1]!.toLowerCase();
  return policy.some((allowed) => allowed.toLowerCase() === domain);
}
