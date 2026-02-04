import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { currentMonthKey, currentMonthStart } from "../src/domain/month.js";

describe("month helpers", () => {
  it("returns month key in Europe/Belgrade", () => {
    const date = DateTime.fromISO("2024-03-31T23:00:00Z");
    const key = currentMonthKey("Europe/Belgrade", date);
    expect(key).toBe("2024-04");
  });

  it("returns month start in timezone", () => {
    const date = DateTime.fromISO("2024-04-15T12:00:00+02:00");
    const start = currentMonthStart("Europe/Belgrade", date);
    expect(start.toISO()).toContain("2024-04-01");
  });
});
