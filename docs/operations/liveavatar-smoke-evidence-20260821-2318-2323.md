# LiveAvatar local smoke evidence — 2026-08-21 23:18–23:23 ET

Read-only Supabase preservation for G's two Android Chrome local rides. No provider or database state was changed. Sensitive account values are omitted.

## Session 1 — `af919e17-9257-4ff7-a890-7e2929da6457`

- `session_started`: 23:18:50.788 ET, CUSTOM.
- Raw conversation rows: 2. Logical folded turns: 2.
- Parent `conversation_sessions` row: absent.
- Error rows in the 23:10–23:35 ET window: 0.
- Bug-report rows in the same window: 0.

Full ordered transcript, preserving every stored word:

1. 6, provider row (`liveavatar_api`, no `utterance_id`): “Hi, I'm 6, your a-i-buddy. You know why they call me 6? 'Cuz I got your back. So how can I make your life a little bit better today?”
2. G, provider fragment (`liveavatar_api_fragment`, no `utterance_id`): “How you doing, buddy?”

Control/end timeline:

- 23:18:55.972 — mic start (`to=on`, `how=start`).
- 23:18:56.094 — one anonymous greeting claim, granted.
- 23:19:13.898 — mic mute (`to=off`, `how=mute`).
- 23:19:15.794 — mic unmute (`to=on`, `how=mute`).
- 23:19:17.250–17.991 — QUIET/speaker off then on.
- 23:19:19.432 — VOICE selected.
- 23:19:19.434 — explicit session end.

There are no app-born user or assistant rows and no utterance links. Every word Supabase received is present, but the app-owned turn/brain path did not persist or answer G's user turn.

## Session 2 — `2430bc4b-a814-4a1a-96cb-c3547105f717`

- `session_started`: 23:21:16.036 ET, CUSTOM.
- Raw conversation rows: 15 (1 provider assistant row and 14 provider user fragments).
- Logical folded turns under the current eight-second orphan-breath rule: 4 (1 assistant and 3 user turns).
- Parent `conversation_sessions` row: absent.
- Error rows in the 23:10–23:35 ET window: 0.
- Bug-report rows in the same window: 0.

Full ordered transcript, preserving every stored word:

1. 6, provider row (`liveavatar_api`, no `utterance_id`): “Hi, I'm 6, your a-i-buddy. You know why they call me 6? 'Cuz I got your back. So how can I make your life a little bit better today?”
2. G fragment: “So it's”
3. G fragment: “beeping and then stopping.”
4. G fragment: “It's like stopping and beeping, stopping and beeping.”
5. G fragment: “Hey buddy, you there?”
6. G fragment: “No, I'm, I'm talking to him.”
7. G fragment: “Uh, talk to me, Six.”
8. G fragment: “So just like the site's malfunctioning, Six.”
9. G fragment: “It's like Six is looking at me.”
10. G fragment: “But, um,”
11. G fragment: “He's not talking.”
12. G fragment: “He knows I'm talking to him. He's giving me a look like he knows I'm talking to him.”
13. G fragment: “So it keeps making a dinging sound.”
14. G fragment: “Like it's malfunctioning.”
15. G fragment: “All right.”

All 14 user rows are `liveavatar_api_fragment`, have null `utterance_id`, and have no matching app-born whole-turn row. Therefore F4 correctly keeps them as honest provider-only evidence; nothing can be linked or folded under an app turn that was never written.

Control/end timeline:

- 23:22:08.011 — mic start (`to=on`, `how=start`).
- 23:22:08.113 — one anonymous greeting claim, granted.
- No mute/unmute, accepted-user-turn, dropped-user-turn, or assistant-response app event exists during the silent period.
- 23:23:16.817 — STOP (`to=stopped_on_stage`).
- 23:23:16.818 — explicit session end.

## Evidence conclusion

The database preserves every word delivered by the provider in both rides. The failure is upstream of the app-owned brain/reply path: Android provider transcription worked, while the competing browser-recognition authority produced no accepted app turn. Session 1 also proves that mic mute/unmute performed an explicit stop/start pair immediately before the reported ding loop. Session 2 proves STOP and explicit end remained correct. Both sessions still lack parent rows despite the already-prepared local parent-lifecycle source fix; no additional database write is authorized here.
