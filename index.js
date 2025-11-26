require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const { scrapeUrl } = require('./scrapper');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing. Set it in your environment before starting the bot.');
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply(
        `Welcome to the Web Scraper Bot! 🤖\n\n` +
        `To use this bot, simply send any URL (starting with http:// or https://) as a message, and I'll reply with details and a summary of the web page.\n\n` +
        `*How to use:*\n` +
        `1️⃣ Send a message with a URL (for example: https://www.example.com)\n` +
        `2️⃣ Wait a few seconds while the bot scrapes the page.\n` +
        `3️⃣ Receive a summary with metadata, headings, links, and more!\n\n` +
        `No commands are needed – just send the URL.`
    );
});

bot.on('text', async (ctx) => {
    const message = ctx.message.text.trim();

    // Very simple URL detection (starts with http or https, and <some>.<tld>)
    const urlPattern = /^(https?:\/\/[^\s]+)/i;
    if (!urlPattern.test(message)) {
        return ctx.reply('Please send a valid URL only. This bot works only if you send a URL, and will reply with details about the page.');
    }

    try {
        const data = await scrapeUrl(message);
        ctx.reply(`Scraped data:\n${data.join('\n')}`, { parse_mode: 'Markdown' });
    } catch (error) {
        ctx.reply(error.message);
    }
});

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Oops, something went wrong. Please try again later.');
});

bot.launch();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Telegram Scraper Bot is running!',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Bot and Express API are running at http://localhost:${PORT}`);
});