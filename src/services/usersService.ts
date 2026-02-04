import { DateTime } from "luxon";
import { SheetsClient } from "../repo/sheetsClient.js";

interface UsersCache {
  userIds: Set<string>;
  expiresAt: number;
}

export class UsersService {
  private cache: UsersCache | null = null;
  private ttlMs: number;

  constructor(private client: SheetsClient, ttlMs = 3 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  private async loadUsers(): Promise<Set<string>> {
    const values = await this.client.getValues("Users!A2:A");
    const userIds = new Set(values.map((row) => row[0]).filter(Boolean));
    return userIds as Set<string>;
  }

  private async getCachedUsers(): Promise<Set<string>> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.userIds;
    }

    const userIds = await this.loadUsers();
    this.cache = {
      userIds,
      expiresAt: now + this.ttlMs,
    };
    return userIds;
  }

  async ensureUser(userId: string, userName: string | undefined): Promise<void> {
    const userIds = await this.getCachedUsers();
    const nowIso = DateTime.now().toISO() ?? "";
    if (!userIds.has(userId)) {
      await this.client.appendValues("Users!A2:F", [
        [userId, userName ?? "", "", true, nowIso, nowIso],
      ]);
      this.cache = null;
      return;
    }
  }

  async updateLastSeen(userId: string, userName: string | undefined): Promise<void> {
    const userIds = await this.getCachedUsers();
    if (!userIds.has(userId)) {
      await this.ensureUser(userId, userName);
      return;
    }

    const values = await this.client.getValues("Users!A2:F");
    const rowIndex = values.findIndex((row) => row[0] === userId);
    if (rowIndex === -1) {
      await this.ensureUser(userId, userName);
      return;
    }

    const nowIso = DateTime.now().toISO() ?? "";
    const rowNumber = rowIndex + 2;
    await this.client.updateValues(`Users!A${rowNumber}:F${rowNumber}`, [
      [userId, userName ?? values[rowIndex][1] ?? "", values[rowIndex][2] ?? "", true, values[rowIndex][4] ?? nowIso, nowIso],
    ]);
  }
}
