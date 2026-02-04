import { describe, it, expect } from "vitest";
import { parseExpenseInput } from "../src/domain/parsing.js";

describe("parseExpenseInput", () => {
  it("parses integer amount with category", () => {
    const result = parseExpenseInput("1000 groceries");
    expect(result).toEqual({
      amount: 1000,
      category: "groceries",
      subcategory: undefined,
      amountOnly: false,
    });
  });

  it("parses decimal with comma", () => {
    const result = parseExpenseInput("12,5 coffee");
    expect(result?.amount).toBeCloseTo(12.5);
    expect(result?.category).toBe("coffee");
  });

  it("parses amount-only", () => {
    const result = parseExpenseInput("500");
    expect(result).toEqual({
      amount: 500,
      amountOnly: true,
    });
  });
});
