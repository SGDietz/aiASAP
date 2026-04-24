import json
import os
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request


TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}/{method}"
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions"
OPENAI_API_KEYS_URL = "https://platform.openai.com/api-keys"
CONVERSATIONS_PATH = "telegram_conversations.json"
BOT_COMMANDS = [
    {"command": "start", "description": "Start Codex"},
    {"command": "whoami", "description": "Show and copy your Telegram user ID"},
    {"command": "reset", "description": "Clear this chat memory"},
    {"command": "help", "description": "Show shortcuts and setup links"},
]
SYSTEM_PROMPT = (
    "You are Codex helping build aiASAP, a practical AI company owned by the user. "
    "Be concise, proactive, and business-minded. When discussing implementation, "
    "favor concrete next steps and keep sensitive secrets out of chat."
)


def load_dotenv(path=".env"):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8-sig") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip().lstrip("\ufeff"), value.strip().strip('"').strip("'"))


def required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def allowed_user_ids():
    raw = os.environ.get("TELEGRAM_ALLOWED_USER_IDS", "").strip()
    if not raw:
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


def load_conversations(path=CONVERSATIONS_PATH):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as history_file:
        data = json.load(history_file)
    if not isinstance(data, dict):
        return {}
    conversations = {}
    for chat_id, messages in data.items():
        if not isinstance(messages, list):
            continue
        clean_messages = []
        for message in messages[-16:]:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = message.get("content")
            if role in {"user", "assistant"} and isinstance(content, str):
                clean_messages.append({"role": role, "content": content})
        conversations[str(chat_id)] = clean_messages
    return conversations


def save_conversations(conversations, path=CONVERSATIONS_PATH):
    serializable = {
        str(chat_id): messages[-16:]
        for chat_id, messages in conversations.items()
        if messages
    }
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as history_file:
        json.dump(serializable, history_file, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)


def request_json(url, payload=None, headers=None, timeout=60):
    data = None
    request_headers = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(
        url,
        data=data,
        headers=request_headers,
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def request_bytes(url, timeout=60):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()


def request_multipart_json(url, fields, files, headers=None, timeout=90):
    boundary = f"----aiasap-{uuid.uuid4().hex}"
    body_parts = []

    for name, value in fields.items():
        body_parts.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )

    for name, file_info in files.items():
        filename, content_type, content = file_info
        body_parts.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                (
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{filename}"\r\n'
                ).encode("utf-8"),
                f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
                content,
                b"\r\n",
            ]
        )

    body_parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(body_parts)
    multipart_headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
    multipart_headers.update(headers or {})
    request = urllib.request.Request(url, data=body, headers=multipart_headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def telegram_call(token, method, payload=None):
    url = TELEGRAM_API_BASE.format(token=token, method=method)
    return request_json(url, payload=payload, timeout=75)


def telegram_file_url(token, file_id):
    result = telegram_call(token, "getFile", {"file_id": file_id}).get("result", {})
    file_path = result.get("file_path")
    if not file_path:
        raise RuntimeError("Telegram did not return a file path for that voice note.")
    return f"https://api.telegram.org/file/bot{token}/{file_path}"


def copy_button(label, text):
    return {"text": label, "copy_text": {"text": text}}


def remove_keyboard():
    return {"remove_keyboard": True}


def shortcuts_markup():
    return {
        "inline_keyboard": [
            [
                copy_button("Copy /start", "/start"),
                copy_button("Copy /whoami", "/whoami"),
            ],
            [
                copy_button("Copy /reset", "/reset"),
                copy_button("Copy /help", "/help"),
            ],
            [
                {"text": "Open API keys", "url": OPENAI_API_KEYS_URL},
                copy_button("Copy API key link", OPENAI_API_KEYS_URL),
            ],
        ]
    }


def whoami_markup(user_id):
    env_line = f"TELEGRAM_ALLOWED_USER_IDS={user_id}"
    return {
        "inline_keyboard": [
            [copy_button("Copy user ID", str(user_id))],
            [copy_button("Copy .env line", env_line)],
            [copy_button("Copy /help", "/help")],
        ]
    }


def setup_telegram_ui(token):
    telegram_call(token, "setMyCommands", {"commands": BOT_COMMANDS})


def send_message(token, chat_id, text, reply_markup=None):
    text = str(text or "").strip()
    if not text:
        text = "No text response was generated."
    max_len = 3900
    chunks = [text[i : i + max_len] for i in range(0, len(text), max_len)] or [""]
    for index, chunk in enumerate(chunks):
        payload = {
            "chat_id": chat_id,
            "text": chunk,
            "disable_web_page_preview": True,
        }
        if reply_markup is not None and index == len(chunks) - 1:
            payload["reply_markup"] = reply_markup
        telegram_call(
            token,
            "sendMessage",
            payload,
        )


def openai_reply(api_key, model, messages):
    prompt = [{"role": "system", "content": SYSTEM_PROMPT}]
    prompt.extend(messages)
    payload = {
        "model": model,
        "input": prompt,
    }
    response = request_json(
        OPENAI_RESPONSES_URL,
        payload=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=90,
    )
    if response.get("output_text"):
        return response["output_text"].strip()

    parts = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                parts.append(content["text"])
    return "\n".join(parts).strip() or "I received the message, but no text came back."


def transcribe_voice(token, api_key, model, voice):
    audio = request_bytes(telegram_file_url(token, voice["file_id"]), timeout=60)
    response = request_multipart_json(
        OPENAI_TRANSCRIPTIONS_URL,
        fields={"model": model},
        files={"file": ("telegram-voice.ogg", "audio/ogg", audio)},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=90,
    )
    transcript = response.get("text", "").strip()
    if not transcript:
        raise RuntimeError("OpenAI returned an empty transcript.")
    return transcript


def is_allowed(user_id, allowed_ids):
    return not allowed_ids or str(user_id) in allowed_ids


def main():
    load_dotenv()
    token = required_env("TELEGRAM_BOT_TOKEN")
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini").strip()
    transcribe_model = os.environ.get("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe").strip()
    allowed_ids = allowed_user_ids()
    conversations = load_conversations()
    offset = None

    setup_telegram_ui(token)
    print("aiASAP Telegram bot is running. Press Ctrl+C to stop.")
    if not allowed_ids:
        print("No TELEGRAM_ALLOWED_USER_IDS set yet. Use /whoami, then restrict access.")

    while True:
        try:
            payload = {"timeout": 60}
            if offset is not None:
                payload["offset"] = offset
            updates = telegram_call(token, "getUpdates", payload).get("result", [])

            for update in updates:
                offset = update["update_id"] + 1
                message = update.get("message") or update.get("edited_message")
                if not message:
                    continue

                chat_id = message["chat"]["id"]
                user = message.get("from", {})
                user_id = user.get("id")
                text = (message.get("text") or "").strip()
                voice = message.get("voice")

                if text.startswith("/whoami"):
                    send_message(
                        token,
                        chat_id,
                        f"Your Telegram user ID is: {user_id}",
                        whoami_markup(user_id),
                    )
                    continue

                if not is_allowed(user_id, allowed_ids):
                    send_message(token, chat_id, "This bot is private.", whoami_markup(user_id))
                    continue

                if voice:
                    if not api_key:
                        send_message(
                            token,
                            chat_id,
                            "OPENAI_API_KEY is missing in .env, so I cannot transcribe voice yet.",
                            shortcuts_markup(),
                        )
                        continue
                    text = transcribe_voice(token, api_key, transcribe_model, voice)

                if not text:
                    send_message(
                        token,
                        chat_id,
                        "Send me text for now. Files and voice can come later.",
                        remove_keyboard(),
                    )
                    continue

                if text.startswith("/start"):
                    if api_key:
                        send_message(
                            token,
                            chat_id,
                            "Codex is online.",
                            remove_keyboard(),
                        )
                    else:
                        send_message(
                            token,
                            chat_id,
                            "aiASAP Telegram is online. Add OPENAI_API_KEY in .env before regular chat.",
                            shortcuts_markup(),
                        )
                    continue

                if text.startswith("/help"):
                    send_message(
                        token,
                        chat_id,
                        "Shortcuts are below. Use the Telegram command menu, tap the command buttons, or copy the setup link.",
                        shortcuts_markup(),
                    )
                    continue

                if text.startswith("/reset"):
                    conversations[str(chat_id)] = []
                    save_conversations(conversations)
                    send_message(token, chat_id, "Memory reset for this chat.", remove_keyboard())
                    continue

                history = conversations.setdefault(str(chat_id), [])
                if not api_key:
                    send_message(
                        token,
                        chat_id,
                        "OPENAI_API_KEY is missing in .env, so I cannot answer yet.",
                        shortcuts_markup(),
                    )
                    continue

                history.append({"role": "user", "content": text})
                history[:] = history[-16:]
                save_conversations(conversations)

                reply = openai_reply(api_key, model, history)
                history.append({"role": "assistant", "content": reply})
                history[:] = history[-16:]
                save_conversations(conversations)
                send_message(token, chat_id, reply, remove_keyboard())

        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            print(f"HTTP error: {exc.code} {body}")
            time.sleep(5)
        except urllib.error.URLError as exc:
            print(f"Network error: {exc}")
            time.sleep(5)
        except KeyboardInterrupt:
            print("Stopping bot.")
            break
        except Exception as exc:
            print(f"Unexpected error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
