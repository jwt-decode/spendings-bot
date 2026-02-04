import { describe, it, expect } from "vitest";
import { normalizeText } from "../src/utils/normalize.js";


describe("normalizeText", () => {
  it("normalizes category text", () => {
    expect(normalizeText("  Coffee  ")).toBe("coffee");
    expect(normalizeText("Dog   Food")).toBe("dog food");
  });
});
