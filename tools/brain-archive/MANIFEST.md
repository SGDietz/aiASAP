# aiASAP brain archive — the four historical LiveAvatar contexts

G, 2026-08-21: preserve the complete content of all four historical aiASAP
LiveAvatar contexts in the codebase; aiASAP must ultimately have NO LiveAvatar
context window.

**These files are REFERENCE DATA, not the live brain.** Nothing imports them and
nothing ships them. 6's actual brain is `tools/cw_6af8624c_prompt.txt`,
generated into `src/lib/brain/sixSystemPrompt.ts` and sent whole by
`app/api/openai-chat-complete/route.ts`.

Provenance: pulled by a read-only GET of the LiveAvatar API on 2026-08-21 at
09:40 ET, BEFORE any deletion. For the three deleted contexts this repo copy and
`C:\AgentComms\work-output\CW-AUDIT-20260821\archive\` are the only copies that
exist. Restoring one means re-creating a provider context from this text.

| file | context id | label | provider status | chars | sha256 (12) | updated at provider |
|---|---|---|---|---|---|---|
| `v2.1-working.prompt.txt` | `6af8624c-aa70-4d93-9ddf-41165efa7b06` | 2.1 aiASAP 6 - Working Version | RETAINED at provider (for now) | 63,260 | `398cb9a1d43c` | 2026-06-24T18:48:16 |
| `v1.1-domain-live.prompt.txt` | `33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930` | v1.1 aiASAP 6 - DOMAIN LIVE | DELETED 2026-08-21 | 65,141 | `8d68380ffe9d` | 2026-05-27T19:11:06 |
| `v1.2-mirror.prompt.txt` | `9d3ba486-ead8-42cf-b6b9-21a6a51b92be` | v1.2 aiASAP 6 - MIRROR | DELETED 2026-08-21 | 65,141 | `8d68380ffe9d` | 2026-05-27T19:11:06 |
| `v1.3-conversation-only.prompt.txt` | `2b8a078f-0bb3-48ca-950b-74683e560996` | v1.3 aiASAP 6 - Conversation Only | DELETED 2026-08-21 | 53,732 | `49f93fcb842c` | 2026-05-25T01:05:21 |

## Notes

- `v1.1-domain-live` and `v1.2-mirror` were BYTE-IDENTICAL (same sha256). v1.2
  existed as a deliberate mirror of the live brain.
- `v1.3-conversation-only` is a distinct, shorter brain.
- `v2.1-working` is the lineage of the current live brain, but the authoritative
  text is `tools/cw_6af8624c_prompt.txt`, which has since moved on and is now
  LARGER than LiveAvatar's 65,535-character limit — which is the point: the
  codebase has no such cap.
- Line endings are preserved exactly as the provider returned them.
