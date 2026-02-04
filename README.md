# Spendings Bot (Telegram + Google Sheets)

Personal expense tracking Telegram bot that stores data in Google Sheets.

## Design summary (requirements → decisions)
- **Personal use / private chat**: Bot responds only to `private` chat type and politely redirects group chats.
- **Single currency (RSD)**: Currency is always stored as `RSD` and confirmed in responses.
- **No edits/deletes**: Expenses are append-only in Sheets.
- **Google Sheets template provisioning**: On startup the bot ensures all tabs and headers exist; missing headers are appended without deleting user data.
- **Assisted input**: Inline keyboards are used for category/subcategory selection; free-text still works and auto-registers new categories.
- **Idempotency**: In-memory LRU cache keyed by `(chat_id, message_id)` avoids duplicate writes.
- **Sequential processing**: Updates are queued per chat to avoid race conditions.
- **Multi-user**: Each expense row stores `user_id` and `user_name`. Users are registered on first interaction.

## Repo structure
```
src/
  bot/           Telegram handlers & session state
  domain/        Parsing, normalization, month helpers
  repo/          Google Sheets client
  services/      Template provisioning, categories, expenses, stats, users
  utils/         Logging, retry, normalization
tests/           Vitest unit tests
```

## Google Sheets template
The bot auto-provisions the following tabs with headers:

- **Expenses**: `timestamp_iso`, `date`, `month`, `amount`, `currency`, `category`, `subcategory`, `user_id`, `user_name`, `raw_message`, `message_id`, `chat_id`
- **Categories**: `category`, `subcategory`, `is_active`, `created_at_iso`, `created_by_user_id`
- **Users**: `user_id`, `user_name`, `display_name`, `is_active`, `created_at_iso`, `last_seen_at_iso`
- **Config**: `key`, `value` (auto-filled with timezone + currency)

## Environment variables
Copy `.env.example` to `.env` and fill in values:

- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (absolute path to the service account JSON file)
- `SPREADSHEET_ID`
- `ALLOWED_USER_IDS` (optional comma-separated list)

## Setup
1. **Create a Telegram bot** using BotFather and get the token.
2. **Create a Google service account** and enable the Google Sheets API.
3. **Share your spreadsheet** with the service account email.
4. **Set env vars** in `.env` (see above).

## Run locally
```bash
npm install
npm run dev
```

## Docker (local always-on)
```bash
docker build -t spendings-bot .
docker run --env-file .env spendings-bot
```

## Free-ish deployment ideas
- **Local always-on**: run the Docker container on a low-power machine or NAS.
- **Render / Railway free tiers**: possible but may sleep or throttle; you may need to switch to a webhook setup or use paid tiers for reliability.
- **GitHub Actions + self-hosted runner**: use a spare machine as a runner for a no-cost “always-on” host.

## How to use
- Send: `1000 groceries`
- Send: `2500 dog food`
- Send: `12.5 coffee`
- Send: `500` → the bot will prompt you to pick a category.

Commands:
- `/start` — quick intro
- `/help` — short help
- `/month` — current month totals and breakdown
- `/categories` — list known categories/subcategories

## Testing
```bash
npm test
```
