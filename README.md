# aiASAP Telegram Bot

This folder contains a small Telegram bridge for the `codex` bot.

It lets you chat with an OpenAI API model from Telegram while keeping all project files inside this Codex workspace.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `TELEGRAM_BOT_TOKEN`
   - `OPENAI_API_KEY`
3. Start the bot:

```powershell
& 'C:\Users\sgdie\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\telegram_codex_bot.py
```

4. In Telegram, message your bot:

```text
/whoami
```

5. Copy the numeric user ID into `TELEGRAM_ALLOWED_USER_IDS` in `.env`, then restart the bot.

Multiple allowed users can be comma-separated:

```text
TELEGRAM_ALLOWED_USER_IDS=12345,67890
```

## Commands

- `/start` - confirm the bot is running
- `/whoami` - show your Telegram user ID
- `/reset` - clear the current chat memory
- `/help` - show commands

The bot registers Telegram command-menu entries and includes copy buttons where useful, such as `/whoami`, your user ID, the `.env` allow-list line, and the OpenAI API keys link.

Voice notes in Telegram are transcribed with `OPENAI_TRANSCRIBE_MODEL` and then answered like typed messages. Chat history is persisted locally in `telegram_conversations.json` so restarts keep recent context.

## Notes

This is a lightweight API bot, not a live connection into this Codex desktop session. It gives you a Telegram-based AI assistant for aiASAP work when you are away from your computer.
