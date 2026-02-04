import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { SheetsClient } from "./repo/sheetsClient.js";
import { ensureSheetTemplate } from "./services/templateProvisioning.js";
import { CategoriesService } from "./services/categoriesService.js";
import { ExpenseService } from "./services/expenseService.js";
import { UsersService } from "./services/usersService.js";
import { StatsService } from "./services/statsService.js";
import { createBot } from "./bot/index.js";
import { log } from "./utils/logger.js";

async function main() {
  const env = loadEnv();
  const sheetsClient = await SheetsClient.create({
    serviceAccountJsonPath: env.googleServiceAccountJsonPath,
    spreadsheetId: env.spreadsheetId,
  });

  await ensureSheetTemplate(sheetsClient);

  const categoriesService = new CategoriesService(sheetsClient);
  const expenseService = new ExpenseService(sheetsClient);
  const usersService = new UsersService(sheetsClient);
  const statsService = new StatsService(sheetsClient);

  const bot = createBot({
    botToken: env.telegramBotToken,
    categoriesService,
    expenseService,
    usersService,
    statsService,
    allowedUserIds: env.allowedUserIds,
  });

  await bot.launch();
  log("info", "Bot started");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((error) => {
  log("error", "Bot failed", { error: String(error) });
  process.exit(1);
});
