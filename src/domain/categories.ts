import { normalizeText } from "../utils/normalize.js";

export interface CategoryEntry {
  category: string;
  subcategory: string;
  isActive: boolean;
}

export interface NormalizedCategoryEntry extends CategoryEntry {
  categoryNormalized: string;
  subcategoryNormalized: string;
}

export function normalizeCategoryEntry(entry: CategoryEntry): NormalizedCategoryEntry {
  return {
    ...entry,
    categoryNormalized: normalizeText(entry.category),
    subcategoryNormalized: normalizeText(entry.subcategory),
  };
}

export function normalizeCategoryKey(category: string, subcategory?: string): string {
  const categoryNormalized = normalizeText(category);
  const subcategoryNormalized = normalizeText(subcategory ?? "");
  return `${categoryNormalized}::${subcategoryNormalized}`;
}
