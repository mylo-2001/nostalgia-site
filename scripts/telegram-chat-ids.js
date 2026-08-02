#!/usr/bin/env node
"use strict";

/**
 * Prints the Telegram chat id of everyone who has recently messaged the bot,
 * so those ids can be pasted into TELEGRAM_CHAT_ORDERS / TELEGRAM_CHAT_TECH.
 *
 * A bot can never start a conversation — each person must send it a message
 * first. Then:
 *   node scripts/telegram-chat-ids.js
 *
 * Reads TELEGRAM_BOT_TOKEN from .env, or takes it as the first argument:
 *   node scripts/telegram-chat-ids.js 123456:ABC...
 */

const fs = require("node:fs");
const path = require("node:path");

function loadEnvToken() {
  const fromArg = (process.argv[2] || "").trim();
  if (fromArg) return fromArg;
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN.trim();
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return "";
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => /^TELEGRAM_BOT_TOKEN=/.test(l.trim()));
  return line ? line.split("=").slice(1).join("=").trim() : "";
}

async function main() {
  const token = loadEnvToken();
  if (!token) {
    console.error("Δεν βρέθηκε TELEGRAM_BOT_TOKEN.");
    console.error("Βάλ' το στο .env ή δώσ' το ως όρισμα:");
    console.error("  node scripts/telegram-chat-ids.js 123456:ABC...");
    process.exit(1);
  }

  const res = await fetch("https://api.telegram.org/bot" + token + "/getUpdates");
  const data = await res.json().catch(() => null);

  if (!data || !data.ok) {
    console.error("Το Telegram απέρριψε το αίτημα:",
      (data && data.description) || ("HTTP " + res.status));
    if (data && data.error_code === 401) {
      console.error("→ Λάθος token. Έλεγξέ το ξανά στο @BotFather.");
    }
    process.exit(1);
  }

  /* One person can appear in many updates — key by chat id to dedupe. */
  const chats = new Map();
  for (const update of data.result || []) {
    const msg = update.message || update.edited_message || update.channel_post;
    const chat = msg && msg.chat;
    if (!chat) continue;
    const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ")
      || chat.title || chat.username || "(χωρίς όνομα)";
    chats.set(chat.id, { name, type: chat.type });
  }

  if (!chats.size) {
    console.log("Κανένα μήνυμα δεν βρέθηκε.");
    console.log("");
    console.log("Βεβαιώσου ότι:");
    console.log("  1. Άνοιξες το bot στο Telegram και πάτησες START");
    console.log("  2. Του έστειλες ένα μήνυμα (π.χ. \"γεια\")");
    console.log("  3. Το ίδιο έκανε και η Μαρία από το δικό της κινητό");
    console.log("");
    console.log("Σημείωση: το Telegram κρατά τα updates ~24 ώρες. Αν πέρασε");
    console.log("περισσότερη ώρα, στείλτε ξανά ένα μήνυμα και ξανατρέξε αυτό.");
    return;
  }

  console.log("Βρέθηκαν " + chats.size + " συνομιλίες:\n");
  for (const [id, info] of chats) {
    console.log("  " + String(id).padEnd(16) + info.name + "  (" + info.type + ")");
  }
  console.log("\nΑντίγραψε τα id στο .env:");
  console.log("  TELEGRAM_CHAT_ORDERS=<το id της Μαρίας>");
  console.log("  TELEGRAM_CHAT_TECH=<το δικό σου id>");
}

main().catch((e) => {
  console.error("Σφάλμα:", (e && e.message) || e);
  process.exit(1);
});
