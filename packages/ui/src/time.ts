/** Convert a wall-clock input in an IANA zone without silently normalizing DST gaps. */
export function departureInstant(value: string, timeZone: string) {
  const parts = value.split(/[-T:]/).map(Number);
  if (parts.length < 5) throw new Error("Invalid departure time");
  const target = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(
      format.formatToParts(instant).map((x) => [x.type, x.value]),
    );
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    const correction = target - shown;
    if (correction === 0) return new Date(instant).toISOString();
    instant += correction;
  }
  throw new Error("Departure time does not exist in this time zone");
}
export function departureLocal(value: string, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatDeparture(
  value: string,
  timeZone: string,
  english: boolean,
) {
  return new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
