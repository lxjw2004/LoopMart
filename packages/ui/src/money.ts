export function dollarsToCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match)
    throw new Error(
      "Enter a non-negative USD amount with at most two decimal places",
    );
  const cents =
    BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount is too large");
  return Number(cents);
}
export function centsToDollars(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid amount");
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
export function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}
