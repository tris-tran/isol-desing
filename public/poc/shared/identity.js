// Identity representation: one set of pieces for showing any identity, yours or someone else's.
// Exposes window.IsolId. Styles in shared/identity.css.
//
// An identity: { key: hex64, me?: bool, pet?: "your name for them", theirs?: "the name they chose",
//                verified?: { how, on }, trusted?: bool, contact?: bool, lookalikeOf?: identity }
//
// Naming rule, everywhere:
//   you             → "You" (with your chosen name as secondary)
//   a name you gave → that name (theirs shown as "calls themselves …" where there's room)
//   only theirs     → their name in quotes, so it never looks like something you confirmed
//   no name at all  → the short key
(function () {
  // Key colours use the whole palette. Avatars of other people never use Vermilion (or Madder): red is reserved for you.
  const PAL = ["#4A3B42", "#BC4D2D", "#528F8D", "#5E6950", "#C19A4B", "#655844", "#EC4823", "#7A8B76"];
  // Madder goes too: next to Vermilion at small sizes it reads as the same red.
  const OTHERS = PAL.filter(c => c !== "#EC4823" && c !== "#BC4D2D");
  const SELF = "#EC4823";
  const SPRITE = `<svg id="id-sprite" width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="id-seal" viewBox="0 0 24 24"><path d="M12 2.5l2.4 2 3.1-.3.9 3 2.6 1.7-1.2 2.9 1.2 2.9-2.6 1.7-.9 3-3.1-.3-2.4 2-2.4-2-3.1.3-.9-3L2.9 14.5l1.2-2.9-1.2-2.9 2.6-1.7.9-3 3.1.3z" fill="currentColor" stroke="none"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8" stroke="#F2E2C4" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="id-heart" viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" stroke="none"/></symbol>
    <symbol id="id-alert" viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></symbol>
    <symbol id="id-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
    <symbol id="id-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></symbol>
  </svg>`;
  const ensureSprite = () => { if (!document.getElementById("id-sprite")) document.body.insertAdjacentHTML("afterbegin", SPRITE); };
  const ic = (id, cls = "") => `<svg class="id-i ${cls}" aria-hidden="true"><use href="#id-${id}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ── Keys ──
  const color = (key, me = false) => me ? SELF : OTHERS[parseInt(key.slice(0, 2), 16) % OTHERS.length];
  const shortKey = key => `${key.slice(0, 8)}…${key.slice(-8)}`;
  const tinyKey = key => `${key.slice(0, 4)}·${key.slice(-4)}`;
  const keyColors = (key, size = "", me = false) => `<span class="id-kc ${size}${me ? " me" : ""}" aria-hidden="true" title="${me ? "Your key colours" : "Key colours"}">${[0, 8, 16, 24, 32, 40, 48, 56].map(i => `<i style="--k:${PAL[parseInt(key.slice(i, i + 2), 16) % 8]}"></i>`).join("")}</span>`;
  const hex = (key, four = false, against) => `<span class="id-hex${four ? " four" : ""}" aria-label="Public key">${key.match(/.{4}/g).map((g, i) => `<span class="${against ? (against.slice(i * 4, i * 4 + 4) === g ? "same" : "diff") : ""}">${g}</span>`).join("")}</span>`;

  // ── Names ──
  function name(p) {
    if (p.me) return { text: "You", cls: "", plain: "You", secondary: p.theirs ? `Others see “${p.theirs}”` : "" };
    if (p.pet) return { text: p.pet, cls: "", plain: p.pet, secondary: p.theirs && p.theirs !== p.pet ? `calls themselves <q>${esc(p.theirs)}</q>` : "" };
    if (p.theirs) return { text: p.theirs, cls: "quoted", plain: `“${p.theirs}”`, secondary: "" };
    return { text: shortKey(p.key), cls: "keyed", plain: shortKey(p.key), secondary: "" };
  }
  const nameHtml = (p, opts = {}) => { const n = name(p); return `<span class="id-name ${n.cls}">${esc(opts.tiny && n.cls === "keyed" ? tinyKey(p.key) : n.text)}</span>`; };
  const initial = p => { const n = p.me ? p.theirs : p.pet || p.theirs; return n ? n.replace(/^\W+/, "")[0].toUpperCase() : null; };

  // ── Avatar ──
  function avatar(p, size = "", { seal = true } = {}) {
    if (p.me) { const ch = initial(p) || "·"; return `<span class="id-av me ${size}" aria-hidden="true" title="You"><i class="curtain"></i><b>${ch}</b></span>`; }
    const c = color(p.key), ch = initial(p);
    return `<span class="id-av ${size}${c === "#C19A4B" ? " ink" : ""}${ch ? "" : " keyed"}${p.me ? " me" : ""}" style="--av:${c}" aria-hidden="true">${ch || p.key.slice(0, 2)}${seal && p.verified && !p.me ? `<span class="seal"><svg><use href="#id-seal"/></svg></span>` : ""}</span>`;
  }

  // ── Badges and marks ──
  function badges(p) {
    const out = [];
    if (p.me) out.push(`<span class="id-b you">${ic("user")}You</span>`);
    if (p.verified) out.push(`<span class="id-b verified">${ic("check")}Verified</span>`);
    if (p.trusted) out.push(`<span class="id-b trusted">${ic("check")}Trusted</span>`);
    if (!p.me && !p.contact) out.push(`<span class="id-b stranger">Not in contacts</span>`);
    if (p.lookalikeOf) out.push(`<span class="id-b warn">${ic("alert")}Same name as ${esc(name(p.lookalikeOf).plain)}</span>`);
    return `<span class="id-badges">${out.join("")}</span>`;
  }
  function marks(p) {
    return `<span class="id-marks">${p.verified ? `<span class="v" title="Verified">${ic("seal")}</span>` : ""}${p.trusted ? `<span class="t" title="Trusted">${ic("heart")}</span>` : ""}${p.lookalikeOf ? `<span class="w" title="Same name as a verified contact">${ic("alert")}</span>` : ""}</span>`;
  }

  // ── Inline ──
  const chip = p => `<button class="id-chip${p.lookalikeOf ? " warn" : ""}${p.me ? " me" : ""}" title="${esc(shortKey(p.key))}">${avatar(p, "xs", { seal: false })}${nameHtml(p, { tiny: true })}${p.verified ? `<span class="id-marks"><span class="v">${ic("seal")}</span></span>` : ""}</button>`;
  const byline = p => `<span class="id-by${p.me ? " me" : ""}" style="--av:${color(p.key, p.me)}"><span class="dot"></span>${nameHtml(p, { tiny: true })}${p.verified ? `<span class="id-marks"><span class="v">${ic("seal")}</span></span>` : ""}</span>`;

  // ── Row ──
  function row(p, end = "") {
    const n = name(p);
    return `<div class="id-row${p.me ? " me" : ""}">${avatar(p, "")}<span class="l1">${nameHtml(p)}${marks(p)}</span>
      <span class="l2"><span class="id-key">${p.key.slice(0, 8)}…</span>${n.secondary ? `<span class="id-calls">${n.secondary}</span>` : !p.me && !p.contact ? `<span>not in contacts</span>` : ""}</span>
      <span class="end">${end || keyColors(p.key, "", p.me)}</span></div>`;
  }

  // ── Header ──
  function header(p, status = "") {
    return `<div class="id-head">${avatar(p, "")}<div><div class="l1">${nameHtml(p)}${marks(p)}</div><div class="l2">${status ? `<span class="on">${status}</span> · ` : ""}<span class="id-key">${shortKey(p.key)}</span></div></div></div>`;
  }

  // ── Hover card ──
  function hovercard(p, actions) {
    const n = name(p);
    const acts = actions || (p.me ? ["Edit name", "Share"] : p.contact ? ["Message", "Open"] : ["Message", "Add to contacts"]);
    return `<div class="id-pop${p.me ? " me" : ""}">
      <div class="top">${avatar(p, "lg")}<span class="n">${nameHtml(p)}${marks(p)}</span>${n.secondary ? `<span class="id-calls">${n.secondary}</span>` : ""}</div>
      <div class="badgeline">${badges(p)}</div>
      ${p.lookalikeOf ? `<div class="warnline">${ic("alert")}<span>Different key from ${esc(name(p.lookalikeOf).plain)}, whom you verified.</span></div>` : ""}
      <div class="keyline"><span class="id-key">${shortKey(p.key)}</span>${keyColors(p.key, "", p.me)}</div>
      <div class="actions">${acts.map(a => `<button>${a}</button>`).join("")}</div>
    </div>`;
  }

  // ── Profile panel ──
  function card(p, { qr } = {}) {
    const n = name(p);
    return `<div class="id-card${p.me ? " me" : ""}">
      <div class="who">${avatar(p, "xl")}${badges(p)}
        <div class="big">${nameHtml(p)}</div>
        ${p.me ? `<div class="id-calls">${p.theirs ? `Others see <q>${esc(p.theirs)}</q>` : "You haven't chosen a name yet"}</div><div class="hint">Your name is public: anyone can see it, and anyone can choose the same one.</div>`
               : `${n.secondary ? `<div class="id-calls">${n.secondary}</div>` : ""}<div class="hint">${p.pet ? "Your name for them. Only you see it." : p.contact ? "You haven't named them." : "Not in your contacts."}</div>`}
      </div>
      ${p.lookalikeOf ? `<div class="warn">${ic("alert")}<span>Another identity also calls itself <b>${esc(p.theirs)}</b>. ${esc(name(p.lookalikeOf).plain)} is verified, and this is a different key.</span></div>` : ""}
      <div class="sec"><h4>${p.me ? "Your public key" : "Public key"}<span class="grow"></span>${keyColors(p.key, "", p.me)}</h4>${hex(p.key, true)}</div>
      ${qr ? `<div class="sec"><h4>${p.me ? "Your QR" : "Their QR"}</h4><div class="qr">${qr}</div></div>` : ""}
      ${!p.me ? `<div class="sec"><h4>Your marks</h4><div style="font-size:14px;color:var(--text-muted)">${p.verified ? `Verified: ${p.verified.how === "scan" ? "QR scanned in person" : "key compared"}, ${p.verified.on}.` : "Not verified."} ${p.trusted ? "Trusted." : "Not trusted."}</div></div>` : ""}
    </div>`;
  }

  // ── Compare ──
  function compare(a, b) {
    return `<div class="id-compare">
      <div class="${a.me ? "me" : ""}">${a.me ? `<span class="mine">Your key</span>` : ""}${header(a)}${hex(a.key, true, b.key)}${keyColors(a.key, "lg", a.me)}</div>
      <div class="${b.me ? "me" : ""}">${b.me ? `<span class="mine">Your key</span>` : ""}${header(b)}${hex(b.key, true, a.key)}${keyColors(b.key, "lg", b.me)}</div>
    </div>`;
  }

  window.IsolId = { SELF, ensureSprite, color, shortKey, tinyKey, keyColors, hex, name, nameHtml, avatar, badges, marks, chip, byline, row, header, hovercard, card, compare };
})();
