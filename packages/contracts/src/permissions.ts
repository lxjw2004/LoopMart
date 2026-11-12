export function assertMember(
  actor: unknown,
): asserts actor is { id: string; emailVerified: true; banned: false } {
  if (
    !actor ||
    typeof actor !== "object" ||
    !("id" in actor) ||
    typeof actor.id !== "string" ||
    !actor.id ||
    !("emailVerified" in actor) ||
    actor.emailVerified !== true ||
    !("banned" in actor) ||
    actor.banned !== false
  )
    throw new Error("Verified active membership required");
}
