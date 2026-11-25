/* 우리반 티어메이커 — 서버 없이 브라우저에서 동작, 교사 코드는 Apps Script 서버(선택) 사용 */
(() => {
"use strict";

/* ===================== 상수 ===================== */
const LS_LISTS = "tm.v1.lists";
const LS_CUR = "tm.v1.current";
const LS_SERVER = "tm.v1.server";
const LS_MYCODES = "tm.v1.mycodes";
const LS_HELPED = "tm.v1.helped";
const SS_KEY = "tm.v1.teacherKey";

const TIER_COLORS = ["#ff7f7f","#ffbf7f","#ffdf7f","#ffff7f","#bfff7f","#7fff7f","#7fffff","#7fbfff","#7f7fff","#ff7fff","#bf7fbf","#cfcfcf","#858585","#f7f7f7"];
const TEXT_NEUTRAL = "#efece2";
const TEXT_BG = ["#efece2","#ffd6d6","#ffe6c7","#fff4b8","#dcf7c4","#c9f0ef","#d3e4ff","#e2d8ff","#ffd8f0","#eeeeee","#ffffff"];
const DEFAULT_TIERS = [["S","#ff7f7f"],["A","#ffbf7f"],["B","#ffdf7f"],["C","#ffff7f"],["D","#bfff7f"]];
const EMOJIS = ("😀 😂 🥰 😎 🤔 😴 😱 🤩 😡 🥳 🐶 🐱 🐰 🐻 🐼 🐯 🦁 🐸 🐵 🐧 " +
  "🍎 🍌 🍓 🍉 🍇 🍑 🍕 🍔 🍟 🌭 🍗 🍜 🍣 🍙 🍩 🍪 🍰 🍦 🍫 🥤 " +
  "⚽ 🏀 ⚾ 🏐 🎾 🏸 🎮 🎨 🎵 📚 ✏️ 💻 📱 🚗 🚲 ✈️ 🚀 🏠 🏫 🌳 " +
  "🌸 🌈 ☀️ 🌙 ⭐ ❄️ 🔥 💧 ❤️ 💡 🎁 🏆 👑 💎 🎈 🎉 👍 👎 ❓ ❗").split(" ");
const CODE_RE = /^[A-Z0-9]{6}$/;

/* ===================== 도우미 ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate = t => { const d = new Date(t); const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); };
const icon = (name, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

let toastTimer;
function toast(msg, ms = 2200, action) {
  const t = $("#toast"), a = $("#toastAct");
  $("#toastMsg").textContent = msg;
  if (action) { a.hidden = false; a.textContent = action.label; a.onclick = () => { t.classList.remove("show"); action.run(); }; ms = Math.max(ms, 5000); }
  else a.hidden = true;
  t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function openModal(id) { closeMenus(); deselect(); $("#" + id).classList.add("show"); }
function closeModal(id) { $("#" + id).classList.remove("show"); }
$$(".modal-back").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) m.classList.remove("show"); });
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { $$(".modal-back.show").forEach(m => m.classList.remove("show")); deselect(); closeMenus(); }
});

/* 드롭다운 메뉴 */
function closeMenus() { $$(".dd-menu.show").forEach(m => m.classList.remove("show")); }
[["#btnSave", "#saveMenu"], ["#btnMore", "#moreMenu"]].forEach(([b, m]) => {
  $(b).addEventListener("click", e => { e.stopPropagation(); const open = $(m).classList.contains("show"); closeMenus(); if (!open) $(m).classList.add("show"); });
});
document.addEventListener("click", e => { if (!e.target.closest(".dd")) closeMenus(); });

/* ===================== 데이터 ===================== */
function newList(title = "") {
  const now = Date.now();
  return { id: uid(), title, created: now, updated: now,
    tiers: DEFAULT_TIERS.map(([label, color]) => ({ id: uid(), label, color, items: [] })),
    pool: [], items: {} };
}
let lists = lsGet(LS_LISTS, {});
let cur = lists[lsGet(LS_CUR, "")] || null;
if (!cur) { cur = newList(); lists[cur.id] = cur; }

let saveTimer;
function save(now = false) {
  $("#saveState").textContent = "저장 중…";
  clearTimeout(saveTimer);
  const run = () => {
    cur.updated = Date.now(); lists[cur.id] = cur;
    try { lsSet(LS_LISTS, lists); lsSet(LS_CUR, cur.id); $("#saveState").textContent = "✓ 자동 저장됨"; }
    catch (e) {
      $("#saveState").textContent = "⚠ 저장 실패";
      toast("저장 공간이 꽉 찼어요. 내 기록에서 안 쓰는 티어표를 지워 주세요.", 4500);
    }
  };
  now ? run() : (saveTimer = setTimeout(run, 300));
}
function persistLists() { try { lsSet(LS_LISTS, lists); lsSet(LS_CUR, cur.id); } catch { toast("저장 공간이 부족해요."); } }

/* 되돌리기 (한 단계) */
let undoSnap = null;
function snapshot() { undoSnap = { id: cur.id, data: clone(cur) }; }
function offerUndo(msg) {
  toast(msg, 5000, { label: "되돌리기", run: () => {
    if (!undoSnap || undoSnap.id !== cur.id) return;
    cur = undoSnap.data; lists[cur.id] = cur; undoSnap = null; render(); save(); toast("되돌렸어요");
  }});
}

/* ===================== 그리기 ===================== */
const tierTable = $("#tierTable"), poolEl = $("#pool");

function textSize(t) {
  const n = [...t].length;
  return n <= 2 ? .3 : n <= 4 ? .24 : n <= 6 ? .19 : n <= 10 ? .16 : n <= 16 ? .145 : .13;
}
function isEmojiOnly(t) { return /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u.test((t || "").trim()); }
function itemName(it) { return it ? (it.type === "img" ? (it.cap || "사진") : (it.cap ? `${it.text} ${it.cap}` : it.text)) : ""; }

function itemEl(id) {
  const it = cur.items[id]; const el = document.createElement("div");
  el.className = "item"; el.dataset.id = id;
  if (!it) return el;
  el.setAttribute("aria-label", itemName(it)); el.title = itemName(it);
  if (it.type === "img") {
    el.innerHTML = `<img src="${it.src}" alt="" draggable="false">` + (it.cap ? `<div class="cap">${esc(it.cap)}</div>` : "");
  } else {
    el.style.background = it.bg || "#fff";
    const emoji = isEmojiOnly(it.text);
    const fs = emoji ? (it.cap ? .44 : .52) : textSize(it.text);
    el.innerHTML = `<div class="txt${emoji ? " emoji" : ""}" style="font-size:max(11px, calc(var(--tile) * ${fs}));${emoji && it.cap ? "padding-bottom:17px" : ""}">${esc(it.text)}</div>` +
      (it.cap ? `<div class="cap">${esc(it.cap)}</div>` : "");
  }
  return el;
}

function render() {
  $("#listTitle").value = cur.title || "";
  tierTable.innerHTML = "";
  cur.tiers.forEach(t => {
    const row = document.createElement("div"); row.className = "tier-row"; row.dataset.tier = t.id;
    const n = [...t.label].length;
    const lab = document.createElement("div"); lab.className = "tier-label" + (n > 8 ? " xlong" : n > 3 ? " long" : "");
    lab.style.background = t.color; lab.textContent = t.label; lab.title = "눌러서 이름·색 바꾸기";
    lab.addEventListener("click", () => { if (!selected) openTier(t.id); });
    const zone = document.createElement("div"); zone.className = "tier-items dropzone"; zone.dataset.zone = t.id;
    t.items.forEach(id => zone.appendChild(itemEl(id)));
    const ctrl = document.createElement("div"); ctrl.className = "tier-ctrl";
    ctrl.innerHTML = `<button title="줄 설정" aria-label="${esc(t.label)} 줄 설정">${icon("sliders")}</button>`;
    $("button", ctrl).onclick = () => openTier(t.id);
    row.append(lab, zone, ctrl); tierTable.appendChild(row);
  });
  poolEl.innerHTML = "";
  cur.pool.forEach(id => poolEl.appendChild(itemEl(id)));
  updateCount();
}
function markEmpty() { tierTable.classList.toggle("empty", cur.tiers.every(t => !t.items.length)); }
function updateCount() {
  const total = Object.keys(cur.items).length;
  $("#poolCount").textContent = total ? `${cur.pool.length} / ${total}` : "";
  markEmpty();
}

/* DOM 순서 → 데이터 */
function syncFromDOM() {
  cur.tiers.forEach(t => {
    const z = $(`.dropzone[data-zone="${t.id}"]`, tierTable);
    t.items = z ? $$(".item", z).map(e => e.dataset.id) : [];
  });
  cur.pool = $$(".item", poolEl).map(e => e.dataset.id);
  updateCount(); save();
}

/* ===================== 끌어 놓기 (마우스·트랙패드·터치) =====================
   마우스: 8px 움직이면 시작 / 터치: 180ms 꾹 누르면 시작(그 전에 쓸면 스크롤) */
const LONG_PRESS = 180, MOVE_TOL = 8;
let drag = null, suppressClick = false;
document.addEventListener("click", e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);
document.addEventListener("pointerdown", e => {
  const it = e.target.closest(".item");
  if (!it || it.classList.contains("drag-ghost") || (e.pointerType === "mouse" && e.button !== 0)) {
    if (e.target.closest("#itemMenu,.modal-back,#toast")) return;
    // 항목을 고른 뒤 줄(또는 상자)을 누르면 그곳으로 옮기기
    const row = e.target.closest(".tier-row"), inPool = e.target.closest("#pool");
    if (selected && (row || inPool) && !e.target.closest(".tier-ctrl")) {
      e.preventDefault();
      const id = selected; deselect(); moveItem(id, row ? row.dataset.tier : "pool"); render(); save();
      suppressClick = true; setTimeout(() => suppressClick = false, 450);
      $(`.item[data-id="${id}"]`)?.classList.add("pop");
      return;
    }
    deselect();
    return;
  }
  const touch = e.pointerType === "touch";
  if (!touch) e.preventDefault();
  const r = it.getBoundingClientRect();
  drag = { el: it, touch, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
    ox: e.clientX - r.left, oy: e.clientY - r.top, started: false, ready: !touch, ghost: null, zone: null, raf: 0 };
  if (touch) {
    it.classList.add("pressing");
    drag.timer = setTimeout(() => { if (drag && !drag.started) { drag.ready = true; startDrag(); } }, LONG_PRESS);
  }
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
});
// 끄는 중에는 화면이 스크롤되지 않게
document.addEventListener("touchmove", e => { if (drag && drag.started) e.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", e => { if (e.target.closest(".item")) e.preventDefault(); });

function startDrag() {
  const { el } = drag;
  drag.started = true; deselect(); el.classList.remove("pressing");
  if (drag.touch) drag.oy += 28;   // 손가락에 가리지 않게 조금 위로
  const g = el.cloneNode(true); g.classList.add("drag-ghost"); g.classList.remove("selected", "pressing");
  g.style.width = el.offsetWidth + "px"; g.style.height = el.offsetHeight + "px";
  g.style.left = (drag.x - drag.ox) + "px"; g.style.top = (drag.y - drag.oy) + "px";
  document.body.appendChild(g); drag.ghost = g; el.classList.add("dragging-src"); document.body.classList.add("dragging");
  if (navigator.vibrate && drag.touch) try { navigator.vibrate(12); } catch {}
  autoScrollLoop();
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  drag.x = e.clientX; drag.y = e.clientY;
  const dist = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  if (!drag.started) {
    if (drag.touch) { if (dist > MOVE_TOL) cancelPress(); return; }   // 꾹 누르기 전에 움직이면 스크롤
    if (dist < MOVE_TOL) return;
    startDrag();
  }
  e.preventDefault();
  drag.ghost.style.left = (e.clientX - drag.ox) + "px";
  drag.ghost.style.top = (e.clientY - drag.oy) + "px";
  placeAt(e.clientX, e.clientY);
}
function zoneAt(x, y) {
  const hit = document.elementFromPoint(x, y); if (!hit) return null;
  let zone = hit.closest(".dropzone");
  if (!zone) { const row = hit.closest(".tier-row"); if (row) zone = $(".dropzone", row); }
  if (!zone && hit.closest(".panel")) zone = poolEl;
  return zone;
}
function placeAt(x, y) {
  const zone = zoneAt(x, y);
  const hl = z => z && (z === poolEl ? z : z.closest(".tier-row"));
  if (drag.zone !== zone) { hl(drag.zone)?.classList.remove("drop-hover"); hl(zone)?.classList.add("drop-hover"); }
  drag.zone = zone;
  if (!zone) return;
  const el = drag.el, ref = refNode(zone, x, y), next = nextItem(el);
  if (!(el.parentNode === zone && ref === next) && ref !== el) zone.insertBefore(el, ref);
}
function nextItem(el) { let n = el.nextElementSibling; while (n && !n.classList.contains("item")) n = n.nextElementSibling; return n; }
function refNode(zone, x, y) {
  for (const k of $$(".item", zone)) {
    if (k === drag.el) continue;
    const r = k.getBoundingClientRect();
    if (y < r.top) return k;
    if (y <= r.bottom && x < r.left + r.width / 2) return k;
  }
  return null;
}
// 가장자리에 가면 티어표·항목 상자를 자동 스크롤
function autoScrollLoop() {
  if (!drag || !drag.started) return;
  for (const sc of [$("#boardScroll"), poolEl]) {
    const r = sc.getBoundingClientRect();
    if (drag.x < r.left || drag.x > r.right) continue;
    const edge = 48;
    if (drag.y < r.top + edge && drag.y > r.top - 60) sc.scrollTop -= 10;
    else if (drag.y > r.bottom - edge && drag.y < r.bottom + 60) sc.scrollTop += 10;
  }
  drag.raf = requestAnimationFrame(autoScrollLoop);
}
function cleanupDrag() {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onCancel);
  if (!drag) return null;
  const d = drag; drag = null;
  clearTimeout(d.timer); cancelAnimationFrame(d.raf);
  d.el.classList.remove("pressing", "dragging-src"); document.body.classList.remove("dragging");
  if (d.ghost) d.ghost.remove();
  if (d.zone) (d.zone === poolEl ? d.zone : d.zone.closest(".tier-row"))?.classList.remove("drop-hover");
  return d;
}
function cancelPress() { cleanupDrag(); }
function onCancel(e) { if (drag && e.pointerId === drag.pid) { const d = cleanupDrag(); if (d && d.started) syncFromDOM(); } }
function onUp(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = cleanupDrag();
  if (d.started) syncFromDOM();
  else selected === d.el.dataset.id ? deselect() : select(d.el.dataset.id);
}

/* ===================== 항목 선택 메뉴 ===================== */
let selected = null;
const menu = $("#itemMenu");
function currentZoneOf(id) { const t = cur.tiers.find(t => t.items.includes(id)); return t ? t.id : "pool"; }
function select(id) {
  deselect(); closeMenus(); selected = id;
  const el = $(`.item[data-id="${id}"]`); if (!el) return;
  el.classList.add("selected"); document.body.classList.add("picking");
  const it = cur.items[id], here = currentZoneOf(id);
  $("#imTitle").textContent = itemName(it);
  $("#imTiers").innerHTML = cur.tiers.map(t =>
    `<button data-t="${t.id}" class="${t.id === here ? "here" : ""}" style="background:${esc(t.color)}" title="${esc(t.label)} 줄로">${esc(t.label || "?")}</button>`).join("");
  $("#imToPool").disabled = here === "pool";
  menu.classList.add("show");
  const r = el.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
  let top = r.bottom + 8; if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 8);
  menu.style.left = Math.max(8, Math.min(r.left + r.width / 2 - mw / 2, innerWidth - mw - 8)) + "px";
  menu.style.top = top + "px";
}
function deselect() {
  if (selected) { const el = $(`.item[data-id="${selected}"]`); el && el.classList.remove("selected"); }
  selected = null; menu.classList.remove("show"); document.body.classList.remove("picking");
}
function moveItem(id, zoneId) {
  cur.tiers.forEach(t => t.items = t.items.filter(x => x !== id));
  cur.pool = cur.pool.filter(x => x !== id);
  if (zoneId === "pool") cur.pool.push(id); else cur.tiers.find(t => t.id === zoneId)?.items.push(id);
}
$("#imTiers").addEventListener("click", e => {
  const b = e.target.closest("button[data-t]"); if (!b || !selected) return;
  const id = selected; deselect(); moveItem(id, b.dataset.t); render(); save();
  const el = $(`.item[data-id="${id}"]`); el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
});
$("#imDelete").onclick = () => {
  if (!selected) return;
  const id = selected, name = itemName(cur.items[id]); deselect(); snapshot();
  cur.tiers.forEach(t => t.items = t.items.filter(x => x !== id));
  cur.pool = cur.pool.filter(x => x !== id);
  delete cur.items[id]; render(); save(); offerUndo(`'${name}'을(를) 지웠어요`);
};
$("#imToPool").onclick = () => { if (!selected) return; const id = selected; deselect(); moveItem(id, "pool"); render(); save(); };
let editingId = null;
$("#imEdit").onclick = () => {
  if (!selected) return;
  editingId = selected; const it = cur.items[editingId];
  const isImg = it.type === "img", isEmo = !isImg && isEmojiOnly(it.text);
  openModal("mEdit");
  $("#editLbl").textContent = isImg || isEmo ? "아래에 붙일 이름" : "글자";
  $("#editText").value = isImg || isEmo ? (it.cap || "") : it.text;
  $("#editColorWrap").style.display = isImg ? "none" : "";
  drawSwatches($("#editSwatches"), TEXT_BG, it.bg, c => { it.bg = c; });
  setTimeout(() => $("#editText").focus(), 60);
};
$("#editOk").onclick = () => {
  const it = cur.items[editingId]; if (!it) return;
  const v = $("#editText").value.trim();
  if (it.type === "img" || isEmojiOnly(it.text)) it.cap = v;
  else if (v) it.text = v;
  closeModal("mEdit"); render(); save();
};
$("#editText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) $("#editOk").click(); });
// 목록이 스크롤되면 메뉴 닫기
["#boardScroll", "#pool"].forEach(s => $(s).addEventListener("scroll", () => { if (selected && !drag) deselect(); }, { passive: true }));

/* ===================== 항목 추가 ===================== */
function addItem(obj) {
  const id = uid(); cur.items[id] = obj; cur.pool.push(id);
  const el = itemEl(id); el.classList.add("pop"); poolEl.appendChild(el); updateCount(); save();
  el.scrollIntoView({ block: "nearest" });
  return id;
}
function addText() {
  const inp = $("#newText"); const v = inp.value.trim();
  if (!v) { inp.focus(); toast("항목 이름을 먼저 적어 주세요"); return; }
  const parts = v.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  parts.forEach(p => addItem({ type: "text", text: p.slice(0, 40), bg: TEXT_NEUTRAL }));
  inp.value = ""; inp.focus();
  if (parts.length > 1) toast(`항목 ${parts.length}개를 추가했어요`);
}
$("#btnAddText").onclick = addText;
$("#newText").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addText(); } });

// 이모지
$("#emojiGrid").innerHTML = EMOJIS.filter(Boolean).map(e => `<button type="button">${e}</button>`).join("");
$("#emojiGrid").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const cap = $("#emojiCaption").value.trim();
  addItem({ type: "text", text: b.textContent, cap, bg: "#ffffff" });
  $("#emojiCaption").value = "";
  toast(`${b.textContent}${cap ? " " + cap : ""} 추가!`, 1200);
});
$("#btnEmoji").onclick = () => openModal("mEmoji");

// 사진
$("#btnImage").onclick = () => $("#fileInput").click();
$("#fileInput").addEventListener("change", async e => {
  const files = [...e.target.files]; e.target.value = "";
  let n = 0;
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    try { const src = await shrinkImage(f, 200); addItem({ type: "img", src, cap: f.name.replace(/\.[^.]+$/, "").slice(0, 20) }); n++; }
    catch { toast(`${f.name}: 사진을 읽지 못했어요`); }
  }
  if (n) toast(`사진 ${n}개를 추가했어요. 눌러서 이름을 고칠 수 있어요.`, 3000);
});
// 붙여넣기(Ctrl+V)로 사진 추가
document.addEventListener("paste", async e => {
  if (e.target.closest("input,textarea")) return;
  const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith("image/"));
  if (f) { e.preventDefault(); addItem({ type: "img", src: await shrinkImage(f, 200), cap: "" }); toast("붙여 넣은 사진을 추가했어요"); }
});

function shrinkImage(file, size) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let out = c.toDataURL("image/webp", .82);
      if (!out.startsWith("data:image/webp")) {
        const c2 = document.createElement("canvas"); c2.width = c2.height = size;
        const g = c2.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); g.drawImage(c, 0, 0);
        out = c2.toDataURL("image/jpeg", .85);
      }
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

/* ===================== 티어 줄 ===================== */
let tierId = null;
function drawSwatches(box, colors, current, onPick) {
  box.innerHTML = "";
  colors.forEach(c => {
    const s = document.createElement("button"); s.type = "button"; s.className = "swatch" + (c === current ? " on" : "");
    s.setAttribute("aria-label", "색 " + c); s.innerHTML = `<i style="background:${c}"></i>`;
    s.onclick = () => { $$(".swatch", box).forEach(x => x.classList.remove("on")); s.classList.add("on"); onPick(c); };
    box.appendChild(s);
  });
}
function openTier(id) {
  tierId = id; const t = cur.tiers.find(x => x.id === id); if (!t) return;
  openModal("mTier");
  $("#tierLabelInput").value = t.label;
  drawSwatches($("#tierSwatches"), TIER_COLORS, t.color, c => { t.color = c; render(); save(); });
  updateTierBtns();
}
function updateTierBtns() { const i = tierIndex(); $("#tUp").disabled = i <= 0; $("#tDown").disabled = i >= cur.tiers.length - 1; }
$("#tierLabelInput").addEventListener("input", e => {
  const t = cur.tiers.find(x => x.id === tierId); if (!t) return;
  t.label = e.target.value; render(); save();
});
$("#tierLabelInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) closeModal("mTier"); });
function tierIndex() { return cur.tiers.findIndex(x => x.id === tierId); }
function makeTier() { return { id: uid(), label: "새 줄", color: TIER_COLORS[cur.tiers.length % TIER_COLORS.length], items: [] }; }
$("#tUp").onclick = () => { moveTier(tierIndex(), -1); updateTierBtns(); };
$("#tDown").onclick = () => { moveTier(tierIndex(), 1); updateTierBtns(); };
$("#tAddAbove").onclick = () => { const t = makeTier(); cur.tiers.splice(tierIndex(), 0, t); render(); save(); openTier(t.id); };
$("#tAddBelow").onclick = () => { const t = makeTier(); cur.tiers.splice(tierIndex() + 1, 0, t); render(); save(); openTier(t.id); };
$("#tClear").onclick = () => {
  const t = cur.tiers[tierIndex()]; if (!t) return;
  if (!t.items.length) { toast("이 줄은 이미 비어 있어요"); return; }
  snapshot(); cur.pool.push(...t.items); t.items = []; render(); save(); closeModal("mTier"); offerUndo(`'${t.label}' 줄을 비웠어요`);
};
$("#tDelete").onclick = () => {
  const i = tierIndex(); const t = cur.tiers[i]; if (!t) return;
  if (cur.tiers.length <= 1) { toast("줄은 하나 이상 있어야 해요"); return; }
  snapshot(); cur.pool.push(...t.items); cur.tiers.splice(i, 1); render(); save(); closeModal("mTier");
  offerUndo(`'${t.label}' 줄을 지웠어요${t.items.length ? " (항목은 상자로)" : ""}`);
};
function moveTier(i, d) {
  const j = i + d; if (j < 0 || j >= cur.tiers.length) return;
  [cur.tiers[i], cur.tiers[j]] = [cur.tiers[j], cur.tiers[i]]; render(); save();
}
$("#btnAddRow").onclick = () => {
  const t = makeTier(); cur.tiers.push(t); render(); save();
  $("#boardScroll").scrollTop = $("#boardScroll").scrollHeight; openTier(t.id);
};
$("#btnResetPlace").onclick = () => {
  if (!cur.tiers.some(t => t.items.length)) { toast("이미 모든 항목이 상자에 있어요"); return; }
  snapshot(); cur.tiers.forEach(t => { cur.pool.push(...t.items); t.items = []; }); render(); save();
  offerUndo("모든 항목을 상자로 되돌렸어요");
};

/* 제목 */
$("#listTitle").addEventListener("input", e => { cur.title = e.target.value; save(); });

/* ===================== 새 티어표 · 기록 ===================== */
function switchTo(list) { deselect(); cur = list; lists[cur.id] = cur; render(); save(true); }
$("#btnNew").onclick = () => {
  if (!Object.keys(cur.items).length && !cur.title) { $("#listTitle").focus(); toast("지금 티어표가 비어 있어요. 여기에 바로 만들면 돼요"); return; }
  switchTo(newList()); toast("새 티어표! 앞의 것은 내 기록에 있어요", 2600); $("#listTitle").focus();
};
$("#btnHistory").onclick = () => { renderHistory(); openModal("mHistory"); };
function renderHistory() {
  const arr = Object.values(lists).sort((a, b) => b.updated - a.updated);
  let bytes = 0; try { bytes = (localStorage.getItem(LS_LISTS) || "").length * 2; } catch {}
  $("#histInfo").textContent = `이 기기에 저장된 티어표 ${arr.length}개 · 저장 공간 ${Math.min(100, Math.round(bytes / 52428.8))}% 사용`;
  const box = $("#histList"); box.innerHTML = "";
  if (!arr.length) { box.innerHTML = `<p class="note">기록이 없어요.</p>`; return; }
  arr.forEach(l => {
    const placed = l.tiers.reduce((s, t) => s + t.items.length, 0);
    const total = Object.keys(l.items).length;
    const row = document.createElement("div"); row.className = "hist-item" + (l.id === cur.id ? " current" : "");
    row.innerHTML = `<div class="hist-thumbs">${l.tiers.slice(0, 8).map(t => `<i style="background:${esc(t.color)}"></i>`).join("")}</div>
      <div class="meta" data-act="open"><b>${esc(l.title || "제목 없음")}${l.id === cur.id ? `<span class="tag">지금</span>` : ""}</b>
      <span>${fmtDate(l.updated)} · 항목 ${total}개 중 ${placed}개 배치${l.fromCode ? " · 코드 " + esc(l.fromCode) : ""}</span></div>
      ${l.id === cur.id ? "" : `<button class="btn small" data-act="open">열기</button>`}
      <button class="btn small icon-only" data-act="dup" title="복사본 만들기" aria-label="복사본 만들기">${icon("copy")}</button>
      <button class="btn small icon-only danger" data-act="del" title="지우기" aria-label="지우기">${icon("trash")}</button>`;
    row.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
      if (act === "open") { if (l.id === cur.id) { closeModal("mHistory"); return; } switchTo(l); closeModal("mHistory"); toast(`'${l.title || "제목 없음"}'을(를) 열었어요`); }
      if (act === "dup") { const c = clone(l); c.id = uid(); c.title = (l.title || "") + " (복사본)"; c.created = c.updated = Date.now(); lists[c.id] = c; persistLists(); renderHistory(); }
      if (act === "del") {
        if (!confirm(`'${l.title || "제목 없음"}'을(를) 지울까요? 되돌릴 수 없어요.`)) return;
        delete lists[l.id];
        if (l.id === cur.id) { const rest = Object.values(lists).sort((a, b) => b.updated - a.updated); cur = rest[0] || newList(); lists[cur.id] = cur; render(); }
        persistLists(); renderHistory(); toast("기록을 지웠어요");
      }
    });
    box.appendChild(row);
  });
}
$("#histClearAll").onclick = () => {
  if (!confirm("이 브라우저에 저장된 티어표 기록을 모두 지울까요?\n되돌릴 수 없어요.")) return;
  lists = {}; cur = newList(); lists[cur.id] = cur; persistLists(); render(); renderHistory(); toast("모든 기록을 지웠어요");
};

/* ===================== PNG · PDF 저장 ===================== */
let exportKind = "png";
$("#btnPng").onclick = () => { exportKind = "png"; $("#exportHead").textContent = "그림으로 저장 (PNG)"; $("#exLight").checked = false; openModal("mExport"); };
$("#btnPdf").onclick = () => { exportKind = "pdf"; $("#exportHead").textContent = "인쇄용으로 저장 (PDF)"; $("#exLight").checked = true; openModal("mExport"); };
$("#btnCopyImg").onclick = async () => {
  closeMenus(); deselect();
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw 0;
    toast("만드는 중…", 1200);
    const canvas = await buildCanvas(false, true, false);
    const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast("그림을 복사했어요! 붙여 넣을 곳에서 Ctrl+V", 3200);
  } catch { toast("이 브라우저에서는 복사가 안 돼요. '그림으로 저장'을 써 주세요.", 3500); }
};
$("#exportGo").onclick = async () => {
  closeModal("mExport"); deselect();
  try { await doExport(exportKind, $("#exIncludePool").checked, $("#exIncludeTitle").checked, $("#exLight").checked); }
  catch (err) { console.error(err); toast("저장하지 못했어요. 다시 해 보세요.", 3000); }
};
function fileName(ext) {
  const t = (cur.title || "티어표").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "티어표";
  const d = new Date(); const p = n => String(n).padStart(2, "0");
  return `${t}_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.${ext}`;
}
async function buildCanvas(includePool, includeTitle, light) {
  const w = 1000;
  const box = document.createElement("div");
  const bg = light ? "#ffffff" : "#1a1a17";
  box.style.cssText = `position:absolute;left:-20000px;top:0;width:${w}px;background:${bg};padding:18px;color:${light ? "#111" : "#f2f2f2"};font-family:var(--font);--tile:80px;--label-w:110px;--gap:3px;--bg:${light ? "#f6f5f0" : "#1a1a17"}`;
  if (includeTitle && cur.title) {
    const h = document.createElement("div"); h.textContent = cur.title;
    h.style.cssText = "font-size:28px;font-weight:800;margin:0 0 14px 2px"; box.appendChild(h);
  }
  const table = tierTable.cloneNode(true);
  $$(".tier-ctrl", table).forEach(c => c.remove());
  $$(".selected,.pressing,.dragging-src,.drop-hover", table).forEach(c => c.classList.remove("selected", "pressing", "dragging-src", "drop-hover"));
  box.appendChild(table);
  if (includePool && cur.pool.length) {
    const h = document.createElement("div"); h.textContent = "아직 정하지 않은 항목";
    h.style.cssText = `font-size:15px;font-weight:700;margin:16px 0 6px 2px;color:${light ? "#555" : "#a9a99f"}`; box.appendChild(h);
    const p = poolEl.cloneNode(true); p.removeAttribute("id");
    p.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;background:#000;border-radius:8px;padding:3px"; box.appendChild(p);
  }
  const foot = document.createElement("div");
  foot.textContent = "우리반 티어메이커 · " + fmtDate(Date.now());
  foot.style.cssText = "font-size:11px;color:#77776d;margin-top:10px;text-align:right"; box.appendChild(foot);
  document.body.appendChild(box);
  try { return await html2canvas(box, { backgroundColor: bg, scale: 2, useCORS: true, logging: false }); }
  finally { box.remove(); }
}
async function doExport(kind, includePool, includeTitle, light) {
  toast("만드는 중…", 1500);
  const canvas = await buildCanvas(includePool, includeTitle, light);
  if (kind === "png") {
    const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    downloadBlob(blob, fileName("png"));
  } else {
    const { jsPDF } = window.jspdf;
    const landscape = canvas.width > canvas.height * 1.1;
    const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 10;
    const maxW = pw - m * 2, maxH = ph - m * 2;
    const mmPerPx = maxW / canvas.width;
    const fullH = canvas.height * mmPerPx;
    if (fullH <= maxH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", .92), "JPEG", m, m, maxW, fullH);
    } else {                                   // 길면 여러 쪽으로 나누기
      const slicePx = Math.floor(maxH / mmPerPx);
      for (let y = 0, page = 0; y < canvas.height; y += slicePx, page++) {
        const h = Math.min(slicePx, canvas.height - y);
        const c = document.createElement("canvas"); c.width = canvas.width; c.height = h;
        c.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (page) pdf.addPage();
        pdf.addImage(c.toDataURL("image/jpeg", .92), "JPEG", m, m, maxW, h * mmPerPx);
      }
    }
    downloadBlob(pdf.output("blob"), fileName("pdf"));
  }
  toast("저장했어요! 다운로드(내 파일) 폴더를 확인하세요.", 3200);
}
function downloadBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ===================== 템플릿 · 코드 ===================== */
function serverUrl() { return (lsGet(LS_SERVER, "") || (window.TIER_CONFIG && TIER_CONFIG.serverUrl) || "").trim(); }
async function api(body) {
  const url = serverUrl(); if (!url) throw new Error("NO_SERVER");
  // Content-Type 미지정(text/plain) → CORS 사전요청 없이 Apps Script로 전송
  const res = await fetch(url, { method: "POST", body: JSON.stringify(body) });
  const j = await res.json(); if (!j.ok) throw new Error(j.error || "서버 오류"); return j;
}
async function apiGet(params) {
  const url = serverUrl(); if (!url) throw new Error("NO_SERVER");
  const res = await fetch(url + (url.includes("?") ? "&" : "?") + new URLSearchParams(params));
  const j = await res.json(); if (!j.ok) throw new Error(j.error || "서버 오류"); return j;
}

function makeTemplate(toPool) {
  const used = new Set([...cur.pool, ...cur.tiers.flatMap(t => t.items)]);
  const items = {}; used.forEach(id => { if (cur.items[id]) items[id] = cur.items[id]; });
  const tpl = { v: 1, title: cur.title || "티어표",
    tiers: cur.tiers.map(t => ({ label: t.label, color: t.color, items: toPool ? [] : t.items.filter(id => items[id]) })),
    pool: toPool ? [...cur.tiers.flatMap(t => t.items), ...cur.pool].filter(id => items[id]) : cur.pool.filter(id => items[id]),
    items };
  return tpl;
}
function listFromTemplate(tpl, code) {
  if (!tpl || !Array.isArray(tpl.tiers) || typeof tpl.items !== "object") throw new Error("코드 내용이 올바르지 않아요");
  const now = Date.now();
  const l = { id: uid(), title: String(tpl.title || "티어표"), created: now, updated: now, fromCode: code,
    tiers: tpl.tiers.map(t => ({ id: uid(), label: String(t.label ?? ""), color: t.color || "#cfcfcf", items: (t.items || []).filter(id => tpl.items[id]) })),
    pool: (tpl.pool || []).filter(id => tpl.items[id]), items: {} };
  for (const [id, it] of Object.entries(tpl.items)) {
    if (it.type === "img" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(it.src || "")) l.items[id] = { type: "img", src: it.src, cap: String(it.cap || "").slice(0, 40) };
    else if (it.type === "text") l.items[id] = { type: "text", text: String(it.text || "").slice(0, 40), cap: String(it.cap || "").slice(0, 40), bg: /^#[0-9a-f]{3,8}$/i.test(it.bg || "") ? it.bg : "#ffffff" };
  }
  // 어디에도 없는 항목은 상자로
  const placed = new Set([...l.pool, ...l.tiers.flatMap(t => t.items)]);
  Object.keys(l.items).forEach(id => { if (!placed.has(id)) l.pool.push(id); });
  return l;
}

/* 긴 코드: deflate + base64url */
const b64u = bytes => { let s = ""; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = str => { str = str.replace(/-/g, "+").replace(/_/g, "/"); const s = atob(str + "===".slice((str.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function pipeBytes(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function encodeLong(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if ("CompressionStream" in window) return "TM1-" + b64u(await pipeBytes(raw, new CompressionStream("deflate-raw")));
  return "TM0-" + b64u(raw);
}
async function decodeLong(code) {
  code = code.replace(/\s+/g, "");
  if (code.startsWith("TM1-")) {
    if (!("DecompressionStream" in window)) throw new Error("이 브라우저는 긴 코드를 열 수 없어요. 크롬·엣지 최신 버전을 써 주세요.");
    return JSON.parse(new TextDecoder().decode(await pipeBytes(unb64u(code.slice(4)), new DecompressionStream("deflate-raw"))));
  }
  if (code.startsWith("TM0-")) return JSON.parse(new TextDecoder().decode(unb64u(code.slice(4))));
  throw new Error("코드 형식이 달라요");
}

/* 한글 자판 상태로 친 코드 → 영어로 (두벌식) */
const KEYMAP = {"ㅂ":"Q","ㅈ":"W","ㄷ":"E","ㄱ":"R","ㅅ":"T","ㅛ":"Y","ㅕ":"U","ㅑ":"I","ㅐ":"O","ㅔ":"P","ㅁ":"A","ㄴ":"S","ㅇ":"D","ㄹ":"F","ㅎ":"G",
  "ㅗ":"H","ㅓ":"J","ㅏ":"K","ㅣ":"L","ㅋ":"Z","ㅌ":"X","ㅊ":"C","ㅍ":"V","ㅠ":"B","ㅜ":"N","ㅡ":"M","ㅃ":"Q","ㅉ":"W","ㄸ":"E","ㄲ":"R","ㅆ":"T","ㅒ":"O","ㅖ":"P",
  "ㅘ":"HK","ㅙ":"HO","ㅚ":"HL","ㅝ":"NJ","ㅞ":"NP","ㅟ":"NL","ㅢ":"ML","ㄳ":"RT","ㄵ":"SW","ㄶ":"SG","ㄺ":"FR","ㄻ":"FA","ㄼ":"FQ","ㄽ":"FT","ㄾ":"FX","ㄿ":"FV","ㅀ":"FG","ㅄ":"QT"};
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ", JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
function hangulToKeys(str) {
  let out = "";
  for (const ch of str) {
    const c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) {
      const n = c - 0xAC00, f = n % 28, m = ((n - f) / 28) % 21, i = Math.floor(n / 588);
      out += KEYMAP[CHO[i]] + KEYMAP[JUNG[m]] + (f ? KEYMAP[JONG[f]] : "");
    } else out += KEYMAP[ch] || ch;
  }
  return out;
}
function normalizeCode(raw) {
  raw = (raw || "").trim();
  if (/^TM[01]-/.test(raw)) return raw;
  return hangulToKeys(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
async function fetchTemplate(code) {
  if (/^TM[01]-/.test(code)) return { tpl: await decodeLong(code), label: "긴 코드" };
  if (!code) throw new Error("코드를 넣어 주세요.");
  if (!CODE_RE.test(code)) throw new Error(`코드는 영어·숫자 6자리예요. (지금 ${code.length}자리)`);
  if (!serverUrl()) throw new Error("아직 코드 서버가 연결되지 않았어요. 선생님께 알려 주세요.");
  const j = await apiGet({ code }); return { tpl: j.data, label: code };
}
// 같은 코드로 하던 티어표가 있으면 이어서 할지 묻기
function startFromTemplate(tpl, label) {
  const prev = label !== "긴 코드" && Object.values(lists).filter(l => l.fromCode === label).sort((a, b) => b.updated - a.updated)[0];
  const fresh = () => { const l = listFromTemplate(tpl, label); switchTo(l); toast(`'${l.title}' 시작! 항목을 줄로 옮겨 보세요.`, 3000); };
  if (!prev) return fresh();
  const placed = prev.tiers.reduce((s, t) => s + t.items.length, 0);
  $("#resumeText").textContent = `'${prev.title}' — ${fmtDate(prev.updated)}에 하던 것 (항목 ${placed}개 배치함)`;
  $("#resumeGo").onclick = () => { closeModal("mResume"); switchTo(prev); toast("이어서 해요!"); };
  $("#resumeNew").onclick = () => { closeModal("mResume"); fresh(); };
  openModal("mResume");
}
async function loadCode(raw) {          // 테스트용으로도 씀
  const { tpl, label } = await fetchTemplate(normalizeCode(raw));
  const l = listFromTemplate(tpl, label); switchTo(l); return l;
}
function wireCodeField(input, err, btn, onDone) {
  input.addEventListener("input", () => {
    err.textContent = /[ㄱ-ㅣ가-힣]/.test(input.value) ? "한글로 쳐졌어요. 한/영 키를 눌러 주세요. (그대로 눌러도 알아서 고쳐요)" : "";
  });
  input.addEventListener("blur", () => { if (!/^TM[01]-/.test(input.value.trim())) input.value = normalizeCode(input.value); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) btn.click(); });
  btn.addEventListener("click", async () => {
    const code = normalizeCode(input.value);
    if (!/^TM/.test(code)) input.value = code;
    const old = btn.textContent; btn.disabled = true; btn.textContent = "불러오는 중…"; err.textContent = "";
    try { const { tpl, label } = await fetchTemplate(code); onDone(); startFromTemplate(tpl, label); }
    catch (e) { err.textContent = e.message === "Failed to fetch" ? "인터넷 연결을 확인해 주세요." : e.message; }
    finally { btn.disabled = false; btn.textContent = old; }
  });
}
wireCodeField($("#codeInput"), $("#codeErr"), $("#codeOk"), () => closeModal("mCode"));
wireCodeField($("#welcomeCode"), $("#welcomeErr"), $("#welcomeGo"), () => closeModal("mWelcome"));
$("#btnCode").onclick = () => { $("#codeInput").value = ""; $("#codeErr").textContent = ""; openModal("mCode"); setTimeout(() => $("#codeInput").focus(), 50); };
$("#welcomeSelf").onclick = () => { closeModal("mWelcome"); $("#newText").focus(); };
$("#histNew").onclick = () => { closeModal("mHistory"); $("#btnNew").click(); };

/* ===================== 교사용 ===================== */
$("#btnTeacher").onclick = async () => {
  $("#teacherKey").value = sessionStorage.getItem(SS_KEY) || "";
  $("#serverUrlInput").value = serverUrl();
  $("#codeResult").innerHTML = ""; $("#myCodes").innerHTML = "";
  openModal("mTeacher"); checkServer();
};
async function checkServer() {
  const dot = $("#srvDot"), txt = $("#srvText");
  if (!serverUrl()) { dot.className = "status-dot no"; txt.textContent = "코드 서버 미연결 — config.js에 서버 주소를 넣어야 6자리 코드를 쓸 수 있어요. (아래 '긴 코드'는 지금도 사용 가능)"; return; }
  dot.className = "status-dot"; txt.textContent = "서버 확인 중…";
  try { await apiGet({ ping: 1 }); dot.className = "status-dot ok"; txt.textContent = "코드 서버 연결됨"; }
  catch { dot.className = "status-dot no"; txt.textContent = "서버에 연결하지 못했어요. 주소와 배포 설정(액세스: 모든 사용자)을 확인해 주세요."; }
}
function teacherKey() {
  const k = $("#teacherKey").value.trim();
  if (!k) { toast("교사 비밀번호를 넣어 주세요"); $("#teacherKey").focus(); return null; }
  sessionStorage.setItem(SS_KEY, k); return k;
}
$("#btnMakeCode").onclick = async () => {
  if (!Object.keys(cur.items).length) { toast("항목이 하나도 없어요. 먼저 항목을 추가해 주세요."); return; }
  if (!serverUrl()) { toast("코드 서버가 연결되지 않았어요. 아래 '긴 코드'를 쓰거나 서버를 설정해 주세요.", 3500); return; }
  const key = teacherKey(); if (!key) return;
  const btn = $("#btnMakeCode"); btn.disabled = true; btn.textContent = "만드는 중…";
  try {
    const tpl = makeTemplate($("#tplToPool").checked);
    const j = await api({ action: "create", key, data: tpl });
    const mine = lsGet(LS_MYCODES, []); mine.unshift({ code: j.code, title: tpl.title, created: Date.now() }); lsSet(LS_MYCODES, mine.slice(0, 100));
    const link = location.origin + location.pathname + "?code=" + j.code;
    $("#codeResult").innerHTML = `<div class="code-big">${j.code}</div>
      <p class="note" style="text-align:center">학생에게 이 코드를 알려 주세요. 또는 링크로 바로 열 수 있어요.</p>
      <div class="row" style="justify-content:center"><button class="btn small" id="cpCode">코드 복사</button><button class="btn small" id="cpLink">바로가기 링크 복사</button></div>`;
    $("#cpCode").onclick = () => copy(j.code); $("#cpLink").onclick = () => copy(link);
  } catch (e) { toast(e.message === "Failed to fetch" ? "서버에 연결하지 못했어요." : e.message, 3500); }
  finally { btn.disabled = false; btn.textContent = "6자리 코드 만들기"; }
};
$("#btnMyCodes").onclick = async () => {
  const box = $("#myCodes");
  const key = $("#teacherKey").value.trim();
  let rows = lsGet(LS_MYCODES, []), fromServer = false;
  if (serverUrl() && key) {
    try { const j = await api({ action: "list", key }); rows = j.items; fromServer = true; sessionStorage.setItem(SS_KEY, key); }
    catch (e) { toast(e.message, 3000); }
  }
  if (!rows.length) { box.innerHTML = `<p class="note">만든 코드가 없어요.</p>`; return; }
  box.innerHTML = `<p class="note">${fromServer ? "서버에 저장된 전체 코드" : "이 브라우저에서 만든 코드 (비밀번호를 넣으면 서버 전체 목록을 볼 수 있어요)"}</p>
    <table class="code-table"><tr><th>코드</th><th>제목</th><th>만든 날</th><th></th></tr>
    ${rows.map(r => `<tr><td><code>${esc(r.code)}</code></td><td>${esc(r.title)}</td><td>${fmtDate(r.created)}</td>
      <td><button class="btn small" data-c="${esc(r.code)}" data-a="copy">복사</button> ${fromServer ? `<button class="btn small danger" data-c="${esc(r.code)}" data-a="del">삭제</button>` : ""}</td></tr>`).join("")}</table>`;
  box.onclick = async e => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    if (b.dataset.a === "copy") return copy(b.dataset.c);
    if (!confirm(`코드 ${b.dataset.c}를 서버에서 지울까요? 학생들이 더 이상 이 코드로 불러올 수 없어요.`)) return;
    try { await api({ action: "delete", key, code: b.dataset.c }); lsSet(LS_MYCODES, lsGet(LS_MYCODES, []).filter(x => x.code !== b.dataset.c)); toast("삭제했어요"); $("#btnMyCodes").click(); }
    catch (err) { toast(err.message); }
  };
};
$("#btnLongCode").onclick = async () => {
  if (!Object.keys(cur.items).length) { toast("항목이 하나도 없어요."); return; }
  const code = await encodeLong(makeTemplate($("#tplToPool").checked));
  const ta = $("#longCodeOut"); ta.style.display = ""; ta.value = code;
  copy(code, `긴 코드(${code.length.toLocaleString()}자)를 복사했어요`);
};
$("#btnSaveServer").onclick = () => { lsSet(LS_SERVER, $("#serverUrlInput").value.trim()); checkServer(); toast("이 브라우저의 서버 주소를 저장했어요"); };
$("#btnResetServer").onclick = () => { localStorage.removeItem(LS_SERVER); $("#serverUrlInput").value = serverUrl(); checkServer(); };

async function copy(text, msg = "복사했어요") {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); toast(msg); }
}

/* ===================== 도움말 · 시작 ===================== */
$("#btnHelp").onclick = () => openModal("mHelp");
window.addEventListener("resize", deselect);

render(); save(true);

const qp = new URLSearchParams(location.search).get("code");
if (qp) {                                   // 교사 링크로 들어오면 바로 불러오기
  history.replaceState(null, "", location.pathname);
  fetchTemplate(normalizeCode(qp)).then(({ tpl, label }) => startFromTemplate(tpl, label))
    .catch(e => { $("#codeInput").value = qp; openModal("mCode"); $("#codeErr").textContent = e.message === "Failed to fetch" ? "인터넷 연결을 확인해 주세요." : e.message; });
} else if (!lsGet(LS_HELPED, false)) {
  openModal("mWelcome"); setTimeout(() => $("#welcomeCode").focus(), 80); try { lsSet(LS_HELPED, true); } catch {}
}

// 테스트·디버그용
window.__tm = { get cur() { return cur; }, get lists() { return lists; }, makeTemplate, encodeLong, decodeLong, loadCode };
})();
