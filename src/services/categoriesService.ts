import { DateTime } from "luxon";
import { SheetsClient } from "../repo/sheetsClient.js";
import { normalizeCategoryEntry, normalizeCategoryKey } from "../domain/categories.js";
import { normalizeText } from "../utils/normalize.js";

export interface CategoryCacheEntry {
  category: string;
  subcategory: string;
  isActive: boolean;
  categoryNormalized: string;
  subcategoryNormalized: string;
}

interface CategoryCache {
  entries: CategoryCacheEntry[];
  expiresAt: number;
}

export class CategoriesService {
  private cache: CategoryCache | null = null;
  private ttlMs: number;

  constructor(private client: SheetsClient, ttlMs = 3 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  async getCategories(): Promise<CategoryCacheEntry[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.entries;
    }

    const values = await this.client.getValues("Categories!A2:E");
    const entries = values
      .filter((row) => row[0])
      .map((row) => {
        const entry = {
          category: row[0] ?? "",
          subcategory: row[1] ?? "",
          isActive: String(row[2]).toLowerCase() !== "false",
        };
        return normalizeCategoryEntry(entry);
      });

    const normalizedEntries = entries.map((entry) => ({
      category: entry.category,
      subcategory: entry.subcategory,
      isActive: entry.isActive,
      categoryNormalized: entry.categoryNormalized,
      subcategoryNormalized: entry.subcategoryNormalized,
    }));

    this.cache = {
      entries: normalizedEntries,
      expiresAt: now + this.ttlMs,
    };

    return normalizedEntries;
  }

  async ensureCategory(category: string, subcategory: string, createdByUserId: string): Promise<void> {
    const entries = await this.getCategories();
    const key = normalizeCategoryKey(category, subcategory);
    const exists = entries.some(
      (entry) => normalizeCategoryKey(entry.category, entry.subcategory) === key
    );
    if (exists) {
      return;
    }

    const nowIso = DateTime.now().toISO();
    await this.client.appendValues("Categories!A2:E", [
      [category, subcategory, true, nowIso ?? "", createdByUserId],
    ]);
    this.cache = null;
  }

  async getCategorySuggestions(): Promise<Map<string, Set<string>>> {
    const entries = await this.getCategories();
    const map = new Map<string, Set<string>>();
    entries
      .filter((entry) => entry.isActive)
      .forEach((entry) => {
        const category = entry.category;
        if (!map.has(category)) {
          map.set(category, new Set());
        }
        if (entry.subcategory) {
          map.get(category)?.add(entry.subcategory);
        }
      });
    return map;
  }

  async hasCategory(category: string): Promise<boolean> {
    const entries = await this.getCategories();
    const normalized = normalizeText(category);
    return entries.some((entry) => entry.categoryNormalized === normalized);
  }
}
