/** Integration tests may mutate data: never accept a development or remote target. */
export function isolatedTestDatabaseURL(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const reject = () =>
    new Error("Integration tests require local loopmart_test on port 5433");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw reject();
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
    parsed.port !== "5433" ||
    parsed.pathname !== "/loopmart_test" ||
    parsed.search ||
    parsed.hash
  )
    throw reject();
  return value;
}
