/* aiASAP front-door still shots, zero spend: the page's own session bootstrap
 * is HELD (Fetch.enable, never continued), never blocked, never tapped. */
import fs from "node:fs";
import path from "node:path";
import { launch } from "file:///C:/AgentComms/work-output/ASAP-RIDE-FIXES-20260821/harness/cdp2.mjs";

const OUT = path.join(process.argv[2] || path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "shots");
fs.mkdirSync(OUT, { recursive: true });
const ORIGIN = "http://127.0.0.1:3001";
const BLOCKS = ["*/api/stop-session*",
  "*api.liveavatar.com*", "*heygen.com*", "*livekit.cloud*", "*livekit.io*", "*elevenlabs.io*", "*openai.com*",
  "*/api/elevenlabs-text-to-speech*", "*/api/openai-chat-complete*", "*/api/prompt-brain*", "*/api/keep-session-alive*"];
const ONLY = process.env.ONLY_VIEW || null;
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const UA_IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const VIEWS = [
  // G'S REAL PHONE, measured 2026-09-05 15:01 off his own screenshot: 1080x2404 device px,
  // brown bar 175px tall for a 72px bar and the 157px START..GALLERY word row = 381px -> 2.43 dpr,
  // so 444 CSS px wide and ~818 tall under the URL bar. NOT 412x758 (that was read off a
  // downscaled preview). Keep both: 412x758 is the common Pixel size.
  { name: "gphone-444x818", width: 444, height: 818, touch: true, dpr: 2.43, ua: UA_ANDROID },
  { name: "gphone-412x758", width: 412, height: 758, touch: true, dpr: 2.182 , ua: UA_ANDROID },
  { name: "gphone-412x915", width: 412, height: 915, touch: true, dpr: 2.18 , ua: UA_ANDROID },
  { name: "phone-390x844", width: 390, height: 844, touch: true, dpr: 3 , ua: UA_ANDROID },
  { name: "phone-430x932", width: 430, height: 932, touch: true, dpr: 3 , ua: UA_ANDROID },
  { name: "xl-1366x768", width: 1366, height: 768, touch: false, dpr: 1 },
  { name: "ipad-820x1180", width: 820, height: 1180, touch: true, dpr: 2, ua: UA_IPAD },
  // Sideways devices: the portrait guard (PhonePortraitGuard + html.aiasap-mobile-portrait-canvas) must keep one upright 9:16 shell.
  { name: "gphone-land-915x412", width: 915, height: 412, touch: true, dpr: 2.18, ua: UA_ANDROID },
  { name: "ipad-land-1180x820", width: 1180, height: 820, touch: true, dpr: 2, ua: UA_IPAD },
];
const PROBE = `
  const R = e => { const r = e.getBoundingClientRect(); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const cluster = document.querySelector('[data-stage-controls="1"]');
  const controls = [...document.querySelectorAll('[data-stage-control]')].map(c => {
    const svg = c.querySelector('svg');
    const lab = c.querySelector('[data-stage-control-inline-label="1"]');
    const btn = c.querySelector('button');
    const cs = lab ? getComputedStyle(lab) : null;
    const ss = svg ? getComputedStyle(svg) : null;
    return { id: c.getAttribute('data-stage-control'), cell: R(c), svg: svg ? R(svg) : null,
      svgSize: ss ? ss.width : null, svgClass: svg ? svg.getAttribute('class') : null, svgTransform: ss ? ss.transform : null, stroke: ss ? ss.stroke : null, strokeWidth: ss ? ss.strokeWidth : null, svgFilter: ss ? ss.filter : null, btnColor: btn ? getComputedStyle(btn).color : null,
      label: lab ? R(lab) : null, labelText: lab ? lab.textContent : null,
      font: cs ? [cs.fontFamily.split(',')[0], cs.fontWeight, cs.fontSize, cs.letterSpacing, cs.color, cs.webkitTextFillColor, cs.textShadow, cs.backgroundImage === 'none' ? 'nobg' : 'BG'].join(' | ') : null,
      overflow: lab ? +(lab.scrollWidth - lab.clientWidth).toFixed(1) : null };
  });
  const tag = document.querySelector('[data-stage-tagline-ink="1"]');
  const sr = tag ? tag.querySelector('.sr-only') : null;
  const started = document.querySelectorAll('[data-aiasap-early-start="1"]').length;
  const CS = (e, ps) => { if (!e) return null; const c = getComputedStyle(e); const o = {}; for (const k of ps) o[k] = c[k]; return o; };
  const stackEl = document.querySelector('[data-phone-bottom-stack="1"]');
  const footerEl = document.querySelector('.stage-legal-footer');
  const navEl = document.querySelector('[data-stage-legal-line="1"]');
  const lockupEl = document.querySelector('.aiasap-brand-lockup');
  const stackInfo = stackEl ? { cs: CS(stackEl, ['paddingTop','paddingBottom','justifyContent','backgroundImage','height','minHeight','position','bottom']),
    kids: [...stackEl.children].map(k => ({ tag: k.tagName, attrs: [...k.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join(' '), cls: (k.className||'').toString().slice(0,80), rect: R(k), cs: CS(k, ['marginTop','marginBottom','paddingTop','paddingBottom','position','bottom','height']) })) } : null;
  const footerInfo = footerEl ? { rect: R(footerEl), cs: CS(footerEl, ['position','bottom','top','height','paddingTop','paddingBottom']) } : null;
  const navInfo = navEl ? { rect: R(navEl), cs: CS(navEl, ['transform','fontSize','height','paddingTop','paddingBottom']) } : null;
  const lockupInfo = lockupEl ? { rect: R(lockupEl), cs: CS(lockupEl, ['top','transform','marginTop','paddingTop']), htmlClass: document.documentElement.className } : null;
  const medias = [...document.querySelectorAll('.aiasap-tablet-idle-media')].map(m => ({ parentAttrs: [...m.parentElement.attributes].map(a=>a.name+'='+a.value).join(' ').slice(0,120), rect: R(m), cs: CS(m, ['height','backgroundImage','backgroundSize','display']), img: m.querySelector('img') ? { cls: m.querySelector('img').className, rect: R(m.querySelector('img')), cs: CS(m.querySelector('img'), ['objectFit','display','opacity','visibility','height']) } : null }));
  const contactEl = document.querySelector('[data-public-contact-links="1"]');
  const mediaEl = document.querySelector('.aiasap-tablet-idle-media');
  const contactInfo = contactEl ? { rect: R(contactEl), bottom: getComputedStyle(contactEl).bottom, varBottom: getComputedStyle(contactEl).getPropertyValue('--public-contact-bottom'), inlineBottom: contactEl.style.bottom } : null;
  const mediaInfo = mediaEl ? { rect: R(mediaEl), cs: CS(mediaEl, ['height','backgroundImage','backgroundSize','backgroundPosition']), img: mediaEl.querySelector('img') ? { rect: R(mediaEl.querySelector('img')), cs: CS(mediaEl.querySelector('img'), ['objectFit','objectPosition','height','width','display','opacity']) } : null } : null;
  const h1 = document.querySelector('.aiasap-logo-mark');
  const tagP = document.querySelector('[data-stage-tagline="1"]');
  const legal = document.querySelector('[data-stage-legal-line="1"]');
  const stack = document.querySelector('[data-phone-bottom-stack="1"]');
  const ww = [...document.querySelectorAll('a,span')].find(e => /WildWorks\.Live/.test(e.textContent||'') && e.children.length===0);
  const frame = document.querySelector('[data-six-initial-idle="1"] img, .aiasap-tablet-idle-media img, img[alt*="6" i]');
  return { vw: innerWidth, vh: innerHeight, cluster: cluster ? R(cluster) : null, controls,
    medias, contactInfo, mediaInfo, stackInfo, footerInfo, navInfo, lockupInfo, tagCs: tagP ? CS(tagP, ['marginTop','fontSize','transform']) : null,
    h1: h1 ? R(h1) : null, h1Font: h1 ? getComputedStyle(h1).fontSize : null, tagP: tagP ? R(tagP) : null,
    legal: legal ? R(legal) : null, stack: stack ? R(stack) : null, wildworks: ww ? R(ww) : null, frame: frame ? R(frame) : null,
    tagline: sr ? sr.textContent : null, taglineRect: tag ? R(tag) : null, earlyStartElements: started,
    videos: document.querySelectorAll('video').length };
`;
const out = {};
for (const v of VIEWS.filter(v => !ONLY || v.name === ONLY)) {
  const b = await launch(v);
  await b.send("Network.setBlockedURLs", { urls: BLOCKS });
  if (v.touch) {
    try { await b.send("Emulation.setEmulatedMedia", { features: [
      { name: "pointer", value: "coarse" }, { name: "any-pointer", value: "coarse" },
      { name: "hover", value: "none" }, { name: "any-hover", value: "none" } ] }); } catch (e) { console.log("emulated media failed", String(e)); }
  }
  await b.send("Fetch.enable", { patterns: [
    { urlPattern: "*start-custom-session*", requestStage: "Request" },
    { urlPattern: "*start-session*", requestStage: "Request" },
    { urlPattern: "*api/v1/sessions/*", requestStage: "Request" },
  ] });
  await b.goto(`${ORIGIN}/`, 4000);
  out[v.name] = await b.evaluate(PROBE);
  out[v.name].held = b.events.filter((e) => e.method === "Fetch.requestPaused").map((e) => e.params.request.url.slice(0, 90));
  out[v.name].sessionCalls = b.sessionCalls().map((r) => ({ url: r.url, failed: r.failed, status: r.status }));
  out[v.name].exceptions = b.events.filter((e) => e.method === "Runtime.exceptionThrown").length;
  console.log(v.name, JSON.stringify(out[v.name], null, 1));
  await b.shot(path.join(OUT, `${v.name}.png`));
  await b.close();
}
fs.writeFileSync(path.join(OUT, "probe.json"), JSON.stringify(out, null, 1));
