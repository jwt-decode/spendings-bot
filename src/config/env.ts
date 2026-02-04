import process from "node:process";

export interface EnvConfig {
  telegramBotToken: string;
  googleServiceAccountJsonPath: string;
  spreadsheetId: string;
  allowedUserIds: Set<string> | null;
}

export function loadEnv(): EnvConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const googleServiceAccountJsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!telegramBotToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }
  if (!googleServiceAccountJsonPath) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  if (!spreadsheetId) {
    throw new Error("Missing SPREADSHEET_ID");
  }

  const allowedUserIdsRaw = process.env.ALLOWED_USER_IDS;
  const allowedUserIds = allowedUserIdsRaw
    ? new Set(allowedUserIdsRaw.split(",").map((value) => value.trim()).filter(Boolean))
    : null;

  return {
    telegramBotToken,
    googleServiceAccountJsonPath,
    spreadsheetId,
    allowedUserIds,
  };
}
