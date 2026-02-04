import { Telegraf, Markup, Context } from "telegraf";
import { LRUCache } from "lru-cache";
import { parseExpenseInput } from "../domain/parsing.js";
import { CategoriesService } from "../services/categoriesService.js";
import { ExpenseService } from "../services/expenseService.js";
import { UsersService } from "../services/usersService.js";
import { StatsService } from "../services/statsService.js";
import { SessionStore, SessionState } from "./sessionStore.js";
import { normalizeText } from "../utils/normalize.js";

const HELP_MESSAGE = `Send expenses like:\n\n1000 groceries\n2500 dog food\n12.5 coffee`;
const START_MESSAGE = `Hi! I can track your expenses in Google Sheets.\n\n${HELP_MESSAGE}`;

interface BotDependencies {
  botToken: string;
  categoriesService: CategoriesService;
  expenseService: ExpenseService;
  usersService: UsersService;
  statsService: StatsService;
  allowedUserIds: Set<string> | null;
}

export function createBot(deps: BotDependencies): Telegraf {
  const bot = new Telegraf(deps.botToken);
  const sessionStore = new SessionStore();
  const idempotencyCache = new LRUCache<string, true>({ max: 1000 });
  const queueByChat = new Map<number, Promise<void>>();

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return next();
    }
    const previous = queueByChat.get(chatId) ?? Promise.resolve();
    const current = previous.then(() => next());
    queueByChat.set(chatId, current.finally(() => {
      if (queueByChat.get(chatId) === current) {
        queueByChat.delete(chatId);
      }
    }));
    await current;
  });

  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await ctx.reply("Please message me in private.");
      return;
    }
    if (deps.allowedUserIds && ctx.from?.id) {
      if (!deps.allowedUserIds.has(String(ctx.from.id))) {
        await ctx.reply("Sorry, you are not allowed to use this bot.");
        return;
      }
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(START_MESSAGE);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_MESSAGE);
  });

  bot.command("categories", async (ctx) => {
    const suggestions = await deps.categoriesService.getCategorySuggestions();
    if (suggestions.size === 0) {
      await ctx.reply("No categories yet.");
      return;
    }
    const lines: string[] = [];
    for (const [category, subcategories] of suggestions.entries()) {
      if (subcategories.size === 0) {
        lines.push(`• ${category}`);
      } else {
        lines.push(`• ${category}: ${Array.from(subcategories).join(", ")}`);
      }
    }
    await ctx.reply(lines.join("\n"));
  });

  bot.command("month", async (ctx) => {
    const stats = await deps.statsService.getCurrentMonthStats();
    const lines: string[] = [];
    lines.push(`📅 ${stats.monthKey} total: ${stats.total.toFixed(2)} RSD`);

    for (const [category, subMap] of stats.byCategory.entries()) {
      const categoryTotal = Array.from(subMap.values()).reduce((sum, value) => sum + value, 0);
      lines.push(`\n${category}: ${categoryTotal.toFixed(2)} RSD`);
      for (const [subcategory, amount] of subMap.entries()) {
        if (subcategory === "(none)") {
          continue;
        }
        lines.push(`  - ${subcategory}: ${amount.toFixed(2)} RSD`);
      }
    }

    if (stats.byUser.size > 1) {
      lines.push("\nBy user:");
      for (const [userId, amount] of stats.byUser.entries()) {
        lines.push(`• ${userId}: ${amount.toFixed(2)} RSD`);
      }
    }

    await ctx.reply(lines.join("\n"));
  });

  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }
    const sessionKey = String(chatId);

    if (data === "cancel") {
      sessionStore.clear(sessionKey);
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("Cancelled.");
      return;
    }

    const session = sessionStore.get(sessionKey);
    if (!session) {
      await ctx.answerCbQuery();
      return;
    }

    if (data.startsWith("cat:")) {
      const category = data.replace("cat:", "");
      sessionStore.set(sessionKey, {
        ...session,
        step: "awaitingSubcategory",
        category,
      });
      await ctx.answerCbQuery();
      await promptSubcategory(ctx, category, sessionKey);
      return;
    }

    if (data.startsWith("sub:")) {
      const sub = data.replace("sub:", "");
      const subcategory = sub === "none" ? "" : sub;
      await ctx.answerCbQuery();
      await finalizeExpense(ctx, session, sessionKey, subcategory);
    }
  });

  bot.on("text", async (ctx) => {
    if (!ctx.message) {
      return;
    }
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const messageId = ctx.message.message_id;
    const idempotencyKey = `${chatId}:${messageId}`;
    if (idempotencyCache.has(idempotencyKey)) {
      return;
    }
    idempotencyCache.set(idempotencyKey, true);

    const userId = ctx.from?.id ? String(ctx.from.id) : "unknown";
    const userName = ctx.from?.username ?? ctx.from?.first_name ?? "";
    await deps.usersService.updateLastSeen(userId, userName);

    const sessionKey = String(chatId);
    const existingSession = sessionStore.get(sessionKey);
    if (existingSession) {
      if (existingSession.step === "awaitingCategory") {
        const category = ctx.message.text.trim();
        sessionStore.set(sessionKey, { ...existingSession, step: "awaitingSubcategory", category });
        await promptSubcategory(ctx, category, sessionKey);
        return;
      }
      if (existingSession.step === "awaitingSubcategory" && existingSession.category) {
        const subcategory = ctx.message.text.trim();
        await finalizeExpense(ctx, existingSession, sessionKey, subcategory);
        return;
      }
    }

    const parsed = parseExpenseInput(ctx.message.text);
    if (!parsed) {
      await ctx.reply(`${HELP_MESSAGE}\n\nTry again.`);
      return;
    }

    if (parsed.amountOnly) {
      sessionStore.set(sessionKey, {
        step: "awaitingCategory",
        amount: parsed.amount,
        rawMessage: ctx.message.text,
        messageId,
        chatId,
        createdAt: Date.now(),
      });
      await promptCategory(ctx);
      return;
    }

    const rawCategory = parsed.category ?? "";
    const rawSubcategory = parsed.subcategory ?? "";
    const suggestions = await deps.categoriesService.getCategorySuggestions();
    const matchedCategory = findCategoryMatch(suggestions, rawCategory) ?? rawCategory;
    const subs = suggestions.get(matchedCategory) ?? new Set();
    const category = matchedCategory;
    const subcategory = rawSubcategory;
    const hasCategory = Boolean(findCategoryMatch(suggestions, rawCategory));
    if (!hasCategory) {
      await deps.categoriesService.ensureCategory(category, subcategory, userId);
    }
    if (!subcategory && subs.size > 0) {
      sessionStore.set(sessionKey, {
        step: "awaitingSubcategory",
        amount: parsed.amount,
        category,
        rawMessage: ctx.message.text,
        messageId,
        chatId,
        createdAt: Date.now(),
      });
      await promptSubcategory(ctx, category, sessionKey);
      return;
    }

    await deps.categoriesService.ensureCategory(category, subcategory, userId);
    await deps.expenseService.appendExpense({
      amount: parsed.amount,
      category,
      subcategory,
      userId,
      userName,
      rawMessage: ctx.message.text,
      messageId,
      chatId,
    });

    const stats = await deps.statsService.getCurrentMonthStats();
    await ctx.reply(`✅ Saved: ${parsed.amount} RSD — ${category}${subcategory ? ` / ${subcategory}` : ""}\n📅 Month total: ${stats.total.toFixed(2)} RSD`);
  });

  async function promptCategory(ctx: Context) {
    const suggestions = await deps.categoriesService.getCategorySuggestions();
    if (suggestions.size === 0) {
      await ctx.reply("Send a category name (e.g., groceries).");
      return;
    }
    const buttons = Array.from(suggestions.keys()).map((category) =>
      Markup.button.callback(category, `cat:${category}`)
    );
    const keyboard = Markup.inlineKeyboard([
      ...chunk(buttons, 2),
      [Markup.button.callback("Cancel", "cancel")],
    ]);
    await ctx.reply("Choose a category:", keyboard);
  }

  async function promptSubcategory(ctx: Context, category: string, sessionKey: string) {
    const suggestions = await deps.categoriesService.getCategorySuggestions();
    const subcategories = suggestions.get(category);
    if (!subcategories || subcategories.size === 0) {
      const session = sessionStore.get(sessionKey);
      if (session) {
        await finalizeExpense(ctx, session, sessionKey, "");
      }
      return;
    }
    const buttons = Array.from(subcategories).map((sub) =>
      Markup.button.callback(sub, `sub:${sub}`)
    );
    buttons.push(Markup.button.callback("No subcategory", "sub:none"));
    const keyboard = Markup.inlineKeyboard([
      ...chunk(buttons, 2),
      [Markup.button.callback("Cancel", "cancel")],
    ]);
    await ctx.reply("Choose a subcategory:", keyboard);
  }

  async function finalizeExpense(
    ctx: Context,
    session: SessionState,
    sessionKey: string,
    subcategory: string
  ) {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id ? String(ctx.from.id) : "unknown";
    const userName = ctx.from?.username ?? ctx.from?.first_name ?? "";

    if (!session.category) {
      return;
    }

    await deps.categoriesService.ensureCategory(session.category, subcategory, userId);
    await deps.expenseService.appendExpense({
      amount: session.amount,
      category: session.category,
      subcategory,
      userId,
      userName,
      rawMessage: session.rawMessage,
      messageId: session.messageId,
      chatId: session.chatId,
    });

    const stats = await deps.statsService.getCurrentMonthStats();
    await ctx.reply(`✅ Saved: ${session.amount} RSD — ${session.category}${subcategory ? ` / ${subcategory}` : ""}\n📅 Month total: ${stats.total.toFixed(2)} RSD`);
    sessionStore.clear(sessionKey);
  }

  return bot;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function findCategoryMatch(map: Map<string, Set<string>>, input: string): string | null {
  const normalized = normalizeText(input);
  for (const key of map.keys()) {
    if (normalizeText(key) === normalized) {
      return key;
    }
  }
  return null;
}
