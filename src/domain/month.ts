import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "Europe/Belgrade";

export function currentMonthKey(timezone = DEFAULT_TIMEZONE, now = DateTime.now()): string {
  return now.setZone(timezone).toFormat("yyyy-MM");
}

export function currentMonthStart(timezone = DEFAULT_TIMEZONE, now = DateTime.now()): DateTime {
  const zoned = now.setZone(timezone);
  return zoned.startOf("month");
}
