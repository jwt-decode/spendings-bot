import { DateTime } from "luxon";
import { SheetsClient } from "../repo/sheetsClient.js";
import { DEFAULT_TIMEZONE } from "../domain/month.js";

export interface ExpenseRecord {
  amount: number;
  category: string;
  subcategory: string;
  userId: string;
  userName: string;
  rawMessage: string;
  messageId: number;
  chatId: number;
}

export class ExpenseService {
  constructor(private client: SheetsClient) {}

  async appendExpense(record: ExpenseRecord, timezone = DEFAULT_TIMEZONE): Promise<void> {
    const now = DateTime.now().setZone(timezone);
    const timestampIso = now.toISO();
    const date = now.toFormat("yyyy-MM-dd");
    const month = now.toFormat("yyyy-MM");

    await this.client.appendValues("Expenses!A2:L", [
      [
        timestampIso ?? "",
        date,
        month,
        record.amount,
        "RSD",
        record.category,
        record.subcategory,
        record.userId,
        record.userName,
        record.rawMessage,
        record.messageId,
        record.chatId,
      ],
    ]);
  }
}
