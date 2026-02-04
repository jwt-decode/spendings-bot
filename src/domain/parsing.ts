export interface ParsedExpenseInput {
  amount: number;
  category?: string;
  subcategory?: string;
  amountOnly: boolean;
}

const AMOUNT_REGEX = /^(\d+(?:[\.,]\d+)?)\s*(.*)$/;

export function parseExpenseInput(text: string): ParsedExpenseInput | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(AMOUNT_REGEX);
  if (!match) {
    return null;
  }

  const rawAmount = match[1];
  const rest = match[2]?.trim() ?? "";

  const normalizedAmount = rawAmount.replace(",", ".");
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount)) {
    return null;
  }

  if (!rest) {
    return {
      amount,
      amountOnly: true,
    };
  }

  const parts = rest.split(/\s+/).filter(Boolean);
  const category = parts.shift();
  if (!category) {
    return null;
  }
  const subcategory = parts.length ? parts.join(" ") : undefined;

  return {
    amount,
    category,
    subcategory,
    amountOnly: false,
  };
}
