import { SheetsClient } from "../repo/sheetsClient.js";
import { currentMonthKey, DEFAULT_TIMEZONE } from "../domain/month.js";
import { DateTime } from "luxon";

export interface MonthStats {
  monthKey: string;
  total: number;
  byCategory: Map<string, Map<string, number>>;
  byUser: Map<string, number>;
}

export class StatsService {
  constructor(private client: SheetsClient) {}

  async getCurrentMonthStats(timezone = DEFAULT_TIMEZONE, now = DateTime.now()): Promise<MonthStats> {
    const monthKey = currentMonthKey(timezone, now);
    const values = await this.client.getValues("Expenses!A2:L");

    const byCategory = new Map<string, Map<string, number>>();
    const byUser = new Map<string, number>();
    let total = 0;

    for (const row of values) {
      const rowMonth = row[2];
      if (rowMonth !== monthKey) {
        continue;
      }
      const amount = Number(row[3]);
      if (!Number.isFinite(amount)) {
        continue;
      }
      total += amount;

      const category = row[5] ?? "Uncategorized";
      const subcategory = row[6] ?? "";
      if (!byCategory.has(category)) {
        byCategory.set(category, new Map());
      }
      const subMap = byCategory.get(category) ?? new Map();
      const key = subcategory || "(none)";
      subMap.set(key, (subMap.get(key) ?? 0) + amount);
      byCategory.set(category, subMap);

      const userLabel = row[8] || row[7] || "unknown";
      byUser.set(userLabel, (byUser.get(userLabel) ?? 0) + amount);
    }

    return {
      monthKey,
      total,
      byCategory,
      byUser,
    };
  }
}
