// Special chat messages: poll, place, event, future secret. Markup for shared/messages.css.
// Exposes window.IsolMsg. Each renderer returns the inside of a bubble; bubbleClass() gives the bubble's extra classes.
//
//   o = { id, meta, avatar(who, size), me: "me", mine: bool, now: ms }
//   poll:   { q, multi, anonymous, closed, closes, options: [{ label, voters: [ids] }] }
//   place:  { name, addr, coords, live?: { total: min, left: min, ended } }
//   event:  { title, start: Date, end: Date, place, going: [], maybe: [], no: [], cancelled }
//   secret: { when: Date, sealed: "1 Sep", text, opened, waiting }
(function () {
  const C = { vellum: "#F2E2C4", linen: "#C7AE8D", vermilion: "#EC4823", madder: "#BC4D2D", verdigris: "#528F8D", sage: "#7A8B76" };

  const SPRITE = `<svg id="mx-sprite" width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="mx-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
    <symbol id="mx-poll" viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-6"/></symbol>
    <symbol id="mx-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></symbol>
    <symbol id="mx-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
    <symbol id="mx-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
    <symbol id="mx-hourglass" viewBox="0 0 24 24"><path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 6 9 9s-9 4-9 9M16.5 3c0 5-9 6-9 9s9 4 9 9"/></symbol>
    <symbol id="mx-stop" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/></symbol>
    <symbol id="mx-star" viewBox="0 0 24 24"><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/></symbol>
  </svg>`;
  function ensureSprite() { if (!document.getElementById("mx-sprite")) document.body.insertAdjacentHTML("afterbegin", SPRITE); }
  const icon = (id, cls = "") => `<svg class="mx-i ${cls}" aria-hidden="true"><use href="#mx-${id}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const faces = (list, avatar, max = 3) => !list.length ? "" :
    `<span class="mx-faces">${list.slice(0, max).map(v => avatar(v, "xs")).join("")}${list.length > max ? `<span class="more">+${list.length - max}</span>` : ""}</span>`;

  // ── drand quicknet: a round every 3 s since genesis ──
  const DRAND_GENESIS = 1692803367, DRAND_PERIOD = 3;
  const drandRound = d => Math.floor((d.getTime() / 1000 - DRAND_GENESIS) / DRAND_PERIOD) + 1;
  const fmtRound = n => n.toLocaleString("en-GB").replace(/,/g, " ");
  const fmtDate = d => d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const hhmm = d => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  function until(ms, now = Date.now()) {
    const s = Math.max(0, Math.floor((ms - now) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    const p = n => String(n).padStart(2, "0");
    return d ? `${d} d ${p(h)} h ${p(m)} m ${p(sec)} s` : h ? `${h} h ${p(m)} m ${p(sec)} s` : `${p(m)} m ${p(sec)} s`;
  }

  // ── Poll ───────────────────────────────────────────────────
  function poll(p, o) {
    const me = o.me || "me", total = p.options.reduce((n, x) => n + x.voters.length, 0);
    const voted = p.options.some(x => x.voters.includes(me)), results = voted || p.closed;
    const top = Math.max(...p.options.map(x => x.voters.length));
    const opts = p.options.map((x, k) => {
      const pct = total ? Math.round(x.voters.length / total * 100) : 0, on = x.voters.includes(me), win = p.closed && x.voters.length === top && top > 0;
      return `<button class="mx-opt${on ? " on" : ""}${win ? " win" : ""}" data-mx="vote" data-id="${o.id}" data-k="${k}" ${p.closed ? "disabled" : ""} aria-pressed="${on}">
        <span class="bar" style="width:${results ? pct : 0}%"></span>
        <span class="mark">${on ? icon("check") : win ? icon("star") : ""}</span>
        <span class="label">${esc(x.label)}</span>
        <span class="pct">${results ? pct + "%" : ""}</span>
        ${results && !p.anonymous && x.voters.length ? faces(x.voters, o.avatar) : ""}
      </button>`;
    }).join("");
    const kind = `Poll · ${p.multi ? "choose any" : "choose one"}${p.anonymous ? " · anonymous" : ""}`;
    const summary = p.closed ? `Final results · ${total} vote${total === 1 ? "" : "s"}` : `${total} vote${total === 1 ? "" : "s"} · ${voted ? "tap to change" : `closes ${p.closes}`}`;
    return `<div class="mx-poll${p.multi ? " multi" : ""}${p.closed ? " closed" : ""}">
      <span class="mx-kind">${icon("poll")}${kind}</span>
      <div class="q">${esc(p.q)}</div>
      <div class="mx-opts" role="group" aria-label="${esc(p.q)}">${opts}</div>
      <div class="mx-foot"><span>${summary}</span>${o.meta || ""}</div>
    </div>`;
  }

  // ── Place ──────────────────────────────────────────────────
  function mapSvg(state) {
    const blocks = [[8,8,46,26],[62,8,58,26],[140,8,44,22],[8,50,46,16],[62,46,58,20],[140,44,44,22],[262,40,22,26],[150,84,40,14],[200,84,38,14],[8,84,32,14]];
    const pin = state === "live"
      ? `<circle class="ping" cx="145" cy="62" r="22" fill="${C.vermilion}" opacity=".45"/><circle cx="145" cy="62" r="11" fill="${C.vellum}"/><circle cx="145" cy="62" r="8" fill="${C.madder}"/>`
      : state === "ended" ? `<circle cx="145" cy="62" r="9" fill="${C.vellum}"/><circle cx="145" cy="62" r="6" fill="#786B55"/>`
      : `<path d="M145 76 c-11-12-15-18-15-25 a15 15 0 0 1 30 0 c0 7-4 13-15 25z" fill="${C.madder}" stroke="${C.vellum}" stroke-width="2"/><circle cx="145" cy="51" r="5.5" fill="${C.vellum}"/>`;
    return `<svg viewBox="0 0 290 150" aria-hidden="true">
      <rect width="290" height="150" fill="#E6D3B2"/>
      ${blocks.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${C.linen}" opacity=".55"/>`).join("")}
      <rect x="196" y="8" width="88" height="26" rx="6" fill="${C.sage}" opacity=".75"/><rect x="62" y="84" width="60" height="16" rx="6" fill="${C.sage}" opacity=".6"/>
      <path d="M0 110 Q60 96 110 114 T210 106 T290 118 V150 H0Z" fill="${C.verdigris}" opacity=".7"/>
      <path d="M58 0 V108 M130 0 V110 M192 0 V104 M256 0 V106" stroke="#F7EEDB" stroke-width="5" fill="none"/>
      <path d="M0 40 H290 M0 76 H290" stroke="#F7EEDB" stroke-width="8" fill="none"/>${pin}</svg>`;
  }
  function placeState(p) { return p.live ? (p.live.ended ? "ended" : "live") : "pin"; }
  function place(p, o) {
    const st = placeState(p), live = p.live;
    const tag = st === "live" ? `<span class="tag"><i></i>Live</span>` : st === "ended" ? `<span class="tag">Live ended</span>` : "";
    const liveRow = st === "live" ? `<div class="mx-live"><span class="track"><i style="width:${Math.round(live.left / live.total * 100)}%"></i></span><span class="left">${live.left} min left</span>
        ${o.mine ? `<button class="mx-stop" data-mx="stop" data-id="${o.id}">${icon("stop", "sm")}Stop sharing</button>` : ""}</div>` : "";
    return `<div class="mx-place${st === "ended" ? " ended" : ""}">
      <span class="map">${mapSvg(st)}${tag}</span>
      <div class="mx-cap"><span class="name">${esc(p.name)}</span>${p.addr ? `<span class="sub">${esc(p.addr)}</span>` : ""}<span class="sub"><code>${p.coords}</code></span>${o.meta || ""}</div>
      ${liveRow}
    </div>`;
  }

  // ── Event ──────────────────────────────────────────────────
  function event(e, o) {
    const me = o.me || "me", now = o.now || Date.now();
    const state = e.cancelled ? "cancelled" : e.end.getTime() < now ? "past" : "upcoming";
    const mine = ["going", "maybe", "no"].find(k => e[k].includes(me));
    const mon = e.start.toLocaleString("en-GB", { month: "short" }).toUpperCase(), wd = e.start.toLocaleString("en-GB", { weekday: "short" }).toUpperCase();
    const when = `${e.start.toLocaleString("en-GB", { weekday: "long" })}, ${hhmm(e.start)} – ${hhmm(e.end)}`;
    const rsvp = state === "upcoming" ? `<div class="mx-rsvp" role="group" aria-label="Will you go?">${[["going", "Going"], ["maybe", "Maybe"], ["no", "Can't"]].map(([k, l]) =>
      `<button data-mx="rsvp" data-id="${o.id}" data-k="${k}" aria-pressed="${mine === k}">${l}<span class="n">${e[k].length}</span></button>`).join("")}</div>` : "";
    const badge = state === "cancelled" ? `<span class="mx-badge state">Cancelled</span>` : state === "past" ? `<span class="mx-badge state">Ended</span>` : "";
    const left = state === "cancelled" ? `<span></span>` : `<span class="going">${faces(e.going, o.avatar)}<span>${e.going.length} ${state === "past" ? "went" : "going"}</span></span>`;
    return `<div class="mx-event ${state}">
      <span class="mx-kind">${icon("calendar")}Event</span>
      <div class="top"><span class="mx-cal"><span class="mon">${mon}</span><span class="day">${e.start.getDate()}</span><span class="wd">${wd}</span></span>
        <div class="txt"><span class="title">${esc(e.title)}</span><span class="line">${icon("clock", "sm")}<span>${when}</span></span><span class="line">${icon("pin", "sm")}<span>${esc(e.place)}</span></span>${state === "upcoming" ? `<button class="line add">${icon("calendar", "sm")}<span>Add to calendar</span></button>` : ""}</div></div>
      ${badge}${rsvp}
      <div class="mx-foot">${left}${o.meta || ""}</div>
    </div>`;
  }

  // ── Future secret ──────────────────────────────────────────
  function secretState(x, now = Date.now()) {
    if (x.opened) return "opened";
    const t = x.when.getTime();
    if (now >= t) return x.waiting ? "waiting" : "ready";
    return t - now < 3600e3 ? "soon" : "sealed";
  }
  function secret(x, o) {
    const now = o.now || Date.now(), st = secretState(x, now), round = fmtRound(drandRound(x.when));
    const redact = `<div class="mx-redact" aria-label="Sealed message"><i></i><i></i><i></i></div>`;
    const foot = `<div class="mx-foot"><span>${o.mine ? "You sealed this" : ""}</span>${o.meta || ""}</div>`;
    if (st === "opened") return `<span class="head">${icon("hourglass")}Future secret · unsealed</span>
      <p class="text">${esc(x.text)}</p>
      <p class="why">Sealed ${x.sealed}. Opened ${fmtDate(x.when)} with drand round <code>${round}</code>.</p>${foot}`;
    if (st === "ready") return `<span class="head">${icon("hourglass")}Future secret</span>${redact}
      <p class="opens">Sealed ${x.sealed}. <b>The time has come.</b></p>
      <p class="why" style="margin-bottom:12px">drand round <code>${round}</code> is out: the key is public now.</p>
      <button class="mx-unseal" data-mx="unseal" data-id="${o.id}">${icon("hourglass")}Unseal</button>${foot}`;
    if (st === "waiting") return `<span class="head">${icon("hourglass")}Future secret</span>${redact}
      <p class="wait">${icon("hourglass")}Waiting for drand round <code>${round}</code></p>
      <p class="why">It's time, but this device hasn't fetched that round yet. It'll open as soon as it does.</p>${foot}`;
    return `<span class="head">${icon("hourglass")}Future secret</span>${redact}
      <p class="opens">Opens <b>${fmtDate(x.when)}</b></p>
      <p class="count">in <span data-mx-until="${x.when.getTime()}">${until(x.when.getTime(), now)}</span></p>
      <p class="why">Locked to drand round <code>${round}</code>. ${o.mine ? "Not even you can open it before then." : "Nobody can open it before then."}</p>${foot}`;
  }

  // ── Bubble classes, actions, ticking ───────────────────────
  function bubbleClass(m) {
    if (m.place) return " mx-media";
    if (m.secret) { const st = secretState(m.secret); return ` mx-secret ${st}${m.secret.justOpened ? " reveal" : ""}`; }
    return "";
  }
  /** Handles a click on a data-mx control. getMsg(id) returns the message object. Returns true when it changed something. */
  function handle(target, getMsg, me = "me") {
    const b = target.closest("[data-mx]"); if (!b || b.disabled) return false;
    const m = getMsg(b.dataset.id); if (!m) return false;
    const act = b.dataset.mx;
    if (act === "vote") {
      const k = +b.dataset.k;
      m.poll.options.forEach((x, j) => {
        const i = x.voters.indexOf(me);
        if (j === k) { if (i < 0) x.voters.push(me); else if (m.poll.multi) x.voters.splice(i, 1); }
        else if (!m.poll.multi && i >= 0) x.voters.splice(i, 1);
      });
    } else if (act === "rsvp") {
      ["going", "maybe", "no"].forEach(x => { const i = m.event[x].indexOf(me); if (i >= 0) m.event[x].splice(i, 1); });
      m.event[b.dataset.k].push(me);
    } else if (act === "unseal") { m.secret.opened = true; m.secret.justOpened = true; }
    else if (act === "stop") { m.place.live.ended = true; m.place.name = "Live location ended"; }
    else return false;
    return true;
  }
  /** Keeps countdowns running under `root`; calls onDue() when one reaches zero. */
  function tick(root, onDue) {
    return setInterval(() => {
      let due = false;
      root.querySelectorAll("[data-mx-until]").forEach(el => { const t = +el.dataset.mxUntil; if (Date.now() >= t) due = true; else el.textContent = until(t); });
      if (due) onDue();
    }, 1000);
  }
  /** Call after a render that showed a reveal, so it only animates once. */
  function settle(msgs) { msgs.forEach(m => { if (m.secret) m.secret.justOpened = false; }); }

  window.IsolMsg = { poll, place, event, secret, bubbleClass, handle, tick, settle, ensureSprite, mapSvg, drandRound, fmtRound, fmtDate, until, secretState };
})();
