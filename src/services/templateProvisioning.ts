import { SheetsClient } from "../repo/sheetsClient.js";
import { log } from "../utils/logger.js";

const TAB_HEADERS: Record<string, string[]> = {
  Expenses: [
    "timestamp_iso",
    "date",
    "month",
    "amount",
    "currency",
    "category",
    "subcategory",
    "user_id",
    "user_name",
    "raw_message",
    "message_id",
    "chat_id",
  ],
  Categories: [
    "category",
    "subcategory",
    "is_active",
    "created_at_iso",
    "created_by_user_id",
  ],
  Users: [
    "user_id",
    "user_name",
    "display_name",
    "is_active",
    "created_at_iso",
    "last_seen_at_iso",
  ],
  Config: ["key", "value"],
};

const DEFAULT_CONFIG_ROWS: [string, string][] = [
  ["timezone", "Europe/Belgrade"],
  ["currency", "RSD"],
];

export async function ensureSheetTemplate(client: SheetsClient): Promise<void> {
  const spreadsheet = await client.getSpreadsheet();
  const existingSheets = spreadsheet.sheets ?? [];
  const existingTitles = new Set(existingSheets.map((sheet) => sheet.properties?.title));

  const requests = Object.keys(TAB_HEADERS)
    .filter((title) => !existingTitles.has(title))
    .map((title) => ({
      addSheet: {
        properties: {
          title,
        },
      },
    }));

  if (requests.length > 0) {
    await client.batchUpdate(requests);
    log("info", "Created missing sheets", { count: requests.length });
  }

  for (const [sheetName, headers] of Object.entries(TAB_HEADERS)) {
    const range = `${sheetName}!1:1`;
    const values = await client.getValues(range);
    const existing = values[0] ?? [];
    if (existing.length === 0) {
      await client.updateValues(`${sheetName}!1:1`, [headers]);
      continue;
    }

    const missing = headers.filter((header) => !existing.includes(header));
    if (missing.length > 0) {
      const updated = [...existing, ...missing];
      await client.updateValues(`${sheetName}!1:1`, [updated]);
    }
  }

  const configValues = await client.getValues("Config!A2:B");
  const existingConfig = new Map(configValues.map((row) => [row[0], row[1]]));
  const missingConfig = DEFAULT_CONFIG_ROWS.filter(([key]) => !existingConfig.has(key));
  if (missingConfig.length > 0) {
    await client.appendValues("Config!A2:B", missingConfig);
  }
}
