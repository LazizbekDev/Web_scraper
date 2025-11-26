# Telegram Scraper Bot

An extensible Telegram bot that scrapes any public webpage and returns a structured, human-readable report directly inside Telegram. The bot supports both API-based scraping services and a built-in headless browser (Puppeteer) so you can reliably extract full content, even from React/SPAs that render client-side.

---

## Features
- **/scrape `<url>` command** – returns title, metadata, language, canonical URL, robots rules, structured data stats, heading hierarchy, content preview, link summary, and image accessibility stats.
- **Dual fetching strategies** – switch between a web scraping API service, Puppeteer, or a hybrid fallback flow.
- **Markdown-safe output** – response text is escaped to display cleanly inside Telegram chats.
- **Configurable rendering** – tweak user agent, wait conditions, timeouts, geographic routing, device type, and JS rendering needs via environment variables.
- **Production-ready structure** – clean separation between Telegram bot logic and scraping utilities for easy maintenance or reuse elsewhere.

---

## Requirements
- Node.js 18+ (Puppeteer’s default Chromium bundle requires modern Node).
- Telegram Bot token (create via [@BotFather](https://t.me/BotFather)).
- Optional: Account + API key for a scraping provider (e.g., scraperapi.com) if you want fully managed proxying, geographic routing, or large-volume scraping.

---

## Quick Start
```bash
git clone https://github.com/<you>/telegram-scraper-bot.git
cd telegram-scraper-bot
npm install
cp .env.example .env                # Create your environment file
# Edit .env with your tokens/keys/settings
npm start
```
Open Telegram, message your bot, and run `/scrape https://example.com`.

---

## Environment Variables (`.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | ✅ | Token from BotFather so the bot can log in. |
| `SCRAPER_FETCH_MODE` | ➖ | `service`, `browser`, or `hybrid`. Defaults to `service` when `SCRAPER_API_KEY` exists, otherwise `browser`. |
| `SCRAPER_API_KEY` | ➖ | API key for your web scraping service (required for `service` or `hybrid` modes). |
| `SCRAPER_API_URL` | ➖ | Override service base URL (defaults to `https://api.scraperapi.com`). |
| `SCRAPER_RENDER_JS` | ➖ | When `true`, asks the scraping service to return JS-rendered HTML (if supported). |
| `SCRAPER_COUNTRY_CODE` | ➖ | Country routing hint for the service (e.g., `us`, `gb`). |
| `SCRAPER_DEVICE_TYPE` | ➖ | Device profile for the service (e.g., `desktop`, `mobile`). |
| `SCRAPER_TIMEOUT_MS` | ➖ | Request timeout in milliseconds (default `60000`). Applies to both service and browser modes. |
| `SCRAPER_BROWSER_WAIT_UNTIL` | ➖ | Puppeteer `waitUntil` event (`load`, `domcontentloaded`, `networkidle0`, `networkidle2`). Default `networkidle2`. |
| `SCRAPER_BROWSER_WAIT_MS` | ➖ | Extra delay (ms) after the initial load before HTML is captured. |
| `PUPPETEER_EXECUTABLE_PATH` | ➖ | Set when deploying somewhere that supplies Chromium separately (e.g., serverless). |

> Never commit your `.env`—the repo is configured to ignore it. Use `.env.example` as a template.

---

## Run & Deploy
- **Local development:** `npm start`
- **Process manager (PM2) example:** `pm2 start index.js --name telegram-scraper-bot`
- **Docker (optional):**
  ```bash
  docker build -t telegram-scraper-bot .
  docker run --env-file .env telegram-scraper-bot
  ```
  (Create a Dockerfile if needed; the project currently targets Node directly.)

---

## Telegram Commands
| Command | Description |
| --- | --- |
| `/start` | Greets the user and briefly explains how to use `/scrape`. |
| `/scrape <url>` | Scrapes the URL, chooses the configured fetch mode, renders the page if necessary, then replies with the structured report. |

Example response excerpt:
```
*URL*: https://example.com
*Title*: Example Domain
*Language*: en
...
*Headings Overview*:
- H1 (1): Example Domain
- H2 (0): None discovered
- H3 (0): None discovered
```

---

## Scraping Modes
1. **Service** – uses the configured scraping provider. Best for large scale, rotating proxies, or when Chromium is unavailable.
2. **Browser** – uses Puppeteer headless Chromium locally. Ideal for React/SPA content when running on a machine with enough resources.
3. **Hybrid** – tries the headless browser first for complete rendering, and falls back to the service if the browser step fails.

Use `SCRAPER_RENDER_JS=true` with service mode if your provider supports server-side JS rendering and you prefer managed infrastructure.

---

## Troubleshooting
- `SCRAPER_API_KEY is missing`: Either add the key to `.env` or set `SCRAPER_FETCH_MODE=browser`.
- `Error: Navigation timeout`: Increase `SCRAPER_TIMEOUT_MS` and/or set `SCRAPER_BROWSER_WAIT_UNTIL=domcontentloaded`.
- Puppeteer fails to launch on Linux servers: install Chromium dependencies or set `PUPPETEER_EXECUTABLE_PATH` to a system Chromium build.
- Telegram messages truncated: Telegram limits messages to ~4096 characters. Extremely verbose pages may need pruning or splitting in future features.

---

## Contributing
1. Fork the project.
2. Create a feature branch (`git checkout -b feature/my-improvement`).
3. Make changes + update tests/docs.
4. Submit a pull request describing the motivation and testing strategy.

---

## License
MIT © Your Name. Feel free to adapt the bot for personal or commercial use; attribution is appreciated but not required.

