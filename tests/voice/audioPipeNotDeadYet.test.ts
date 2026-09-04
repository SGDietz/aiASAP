import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// RIDE cf79a533, 2026-09-03. G: "I don't think a single time 6 moved his mouth,
// the avatar, this past smoke."
//
// The stored diagnostics said why, without needing another paid ride:
//   22:59:25 [custom-voice] actions.repeat socket=null b64speak=false
//   22:59:25 [custom-voice] actions.repeat undeliverable -> WebAudio fallback
// ...and then NOT ONE socket line for the ten replies that followed.
//
// The greeting dispatches about a second after the session starts, before the
// event socket is up. That single miss put the session in `deadAudioSessions`,
// so every later line went straight to WebAudio without trying the socket -
// no lip-sync, wrong voice, for the whole ride.
//
// Across every recorded ride the push succeeds 302 times out of 306, and all
// four failures are this same not-connected-yet case at session start.
// ---------------------------------------------------------------------------

vi.mock("@heygen/liveavatar-web-sdk", () => ({
  AgentEventsEnum: { AVATAR_SPEAK_STARTED: "avatar_speak_started" },
  LiveAvatarSession: class {},
}));

vi.mock("../../src/lib/voiceMode/pcm", () => ({
  pcm16Base64ToAudioBuffer: vi.fn(() => ({})),
}));

const AUDIO = "AAAA".repeat(100);

function sessionWithSocket(socket: unknown) {
  return {
    _sessionEventSocket: socket,
    repeat: vi.fn(),
    interrupt: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function openSocket() {
  return { readyState: 1, send: vi.fn() };
}

describe("a socket that has not connected yet is not a dead pipe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    vi.stubGlobal("WebSocket", { OPEN: 1 });
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (id: number) => clearTimeout(id),
      atob: (b: string) => Buffer.from(b, "base64").toString("binary"),
      btoa: (b: string) => Buffer.from(b, "binary").toString("base64"),
    });
    vi.stubGlobal("atob", (b: string) => Buffer.from(b, "base64").toString("binary"));
    vi.stubGlobal("btoa", (b: string) => Buffer.from(b, "binary").toString("base64"));
    vi.stubGlobal("crypto", { randomUUID: () => "id-1" });
    // The WebAudio fallback runs in these tests by design; give it somewhere
    // to land so it cannot throw after the test has finished.
    vi.stubGlobal("AudioContext", class {
      state = "running";
      async resume() {}
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {},
          stop() {},
          onended: null as null | (() => void),
        };
      }
      createGain() {
        return { gain: { value: 1 }, connect() {} };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      createBuffer() {
        return {};
      }
      get destination() {
        return {};
      }
    });
    vi.stubGlobal("Audio", class {
      srcObject: unknown = null;
      autoplay = false;
      muted = false;
      play() {
        return Promise.resolve();
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still uses the socket for the NEXT line after an early miss", async () => {
    const { deliverCustomTtsAudio } = await import(
      "../../src/liveavatar/customVoiceDelivery"
    );
    // the greeting: socket not up yet
    const session = sessionWithSocket(null);
    deliverCustomTtsAudio(session as never, AUDIO, "test.greeting");

    // a second later the socket is open - THIS is the line that used to be
    // skipped, and is why his mouth never moved for the rest of the ride
    const socket = openSocket();
    (session as { _sessionEventSocket: unknown })._sessionEventSocket = socket;
    deliverCustomTtsAudio(session as never, AUDIO, "test.reply");
    expect(socket.send).toHaveBeenCalled();
  });

  it("does mark the pipe dead when an OPEN socket refuses the audio", async () => {
    const { deliverCustomTtsAudio } = await import(
      "../../src/liveavatar/customVoiceDelivery"
    );
    const broken = {
      readyState: 1,
      send: vi.fn(() => {
        throw new Error("socket refused");
      }),
    };
    const session = sessionWithSocket(broken);
    deliverCustomTtsAudio(session as never, AUDIO, "test.broken");
    expect(broken.send).toHaveBeenCalled();

    // proven broken - do not keep pushing into it
    const replacement = openSocket();
    (session as { _sessionEventSocket: unknown })._sessionEventSocket = replacement;
    deliverCustomTtsAudio(session as never, AUDIO, "test.after-broken");
    expect(replacement.send).not.toHaveBeenCalled();
  });
});
