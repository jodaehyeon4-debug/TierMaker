/* 교사용 모둠 모아 보기 — 실시간 */
(() => {
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dash = $("#dash");
const code = (new URLSearchParams(location.search).get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
let focusG = null, noticeDraft = "", lastData = null;

function toast(m) { const t = $("#toast"); $("#toastMsg").textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2500); }
function nameOf(it) { return it ? (it.title || (it.type === "img" ? (it.cap || "사진") : it.text + (it.cap ? " " + it.cap : ""))) : ""; }
function tile(it, cls = "item") {
  if (!it) return "";
  if (it.type === "img") return `<div class="${cls}" title="${esc(nameOf(it))}"><img src="${esc(it.src)}" alt=""></div>`;
  return `<div class="${cls}" title="${esc(nameOf(it))}" style="background:${esc(it.bg || "#fff")}"><div class="txt">${esc(it.text)}</div></div>`;
}

if (!code) { startPage(); return; }

/* 코드 없이 들어오면: 수업 세트로 모둠 활동 바로 열기 */
function startPage() {
  const recent = (() => { try { return JSON.parse(localStorage.getItem("tm.v1.myrooms") || "[]"); } catch { return []; } })();
  dash.innerHTML = `<div class="start-wrap">
    <h1>모둠 활동 시작하기</h1>
    <p class="sub">수업 세트 코드와 모둠 수를 고르면 학생용 코드가 나오고, 이 화면에 모든 모둠이 실시간으로 보여요.</p>
    <form id="startForm" class="start-form">
      <label>수업 세트 코드<input id="setCode" placeholder="예: BANCHAN, SEJONG" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <label>모둠 수<select id="setGroups">${[2,3,4,5,6,7,8].map(n => `<option${n === 6 ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <button class="btn primary" id="startGo">모둠 활동 열기</button>
    </form>
    <p class="err" id="startErr"></p>
    <div class="sets"><span>만들어 둔 수업 세트:</span>
      <button class="chip" data-set="BANCHAN">BANCHAN · 급식 반찬</button>
      <button class="chip" data-set="SEJONG">SEJONG · 세종대왕의 업적</button></div>
    ${recent.length ? `<h2>최근에 연 모둠 활동</h2><div class="recent">${recent.slice(0, 8).map(r => `<a class="btn" href="?code=${esc(r.code)}"><b>${esc(r.code)}</b> ${esc(r.title)} · ${r.groups}모둠</a>`).join("")}</div>` : ""}
    <p class="hint">직접 만든 티어표로 열려면: 티어메이커 앱 → ⋯ → 교사용 → 모둠 활동 열기</p>
  </div>`;
  dash.addEventListener("click", e => { const c = e.target.closest(".chip"); if (c) { $("#setCode").value = c.dataset.set; $("#setCode").focus(); } });
  $("#startForm").addEventListener("submit", async e => {
    e.preventDefault();
    const set = $("#setCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""), groups = +$("#setGroups").value, err = $("#startErr"), btn = $("#startGo");
    if (!set) { err.textContent = "수업 세트 코드를 넣어 주세요."; return; }
    if (!TMRoom.available()) { err.textContent = "Firebase 설정이 없어요."; return; }
    btn.disabled = true; btn.textContent = "여는 중…"; err.textContent = "";
    try {
      const r = await fetch(`templates/${set}.json`, { cache: "no-cache" });
      if (!r.ok) throw new Error(`'${set}' 수업 세트를 찾지 못했어요. 코드를 확인해 주세요.`);
      const tpl = await r.json();
      const newCode = await TMRoom.createSession({ title: tpl.title, groups, tpl, locked: (tpl.tiers || []).some(t => t.max > 0) });
      const rows = recent.slice(); rows.unshift({ code: newCode, title: tpl.title, groups, created: Date.now() });
      try { localStorage.setItem("tm.v1.myrooms", JSON.stringify(rows.slice(0, 30))); } catch {}
      location.href = "?code=" + newCode;
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = "모둠 활동 열기"; }
  });
}
if (!TMRoom.available()) { dash.innerHTML = `<div class="dmsg">Firebase 설정이 아직 없어요. config.js를 확인해 주세요.</div>`; return; }

TMRoom.watch(code, data => {
  if (!data || !data.meta) { dash.innerHTML = `<div class="dmsg">코드 <b>${esc(code)}</b> 모둠 활동이 없거나 끝났어요.</div>`; return; }
  draw(data);
  if (data.meta.owner === TMRoom.uid) $("#btnClose").hidden = false;
}).catch(e => { dash.innerHTML = `<div class="dmsg">${esc(e.message)}</div>`; });

function draw(data) {
  const meta = data.meta, n = meta.groups || 4, groups = data.groups || {};
  const boards = [];
  for (let g = 1; g <= n; g++) boards.push({ g, st: TMBuild(meta, groups[g] || {}), raw: groups[g] || {} });
  const totalItems = Object.keys(boards[0]?.st.items || {}).length;

  const owner = meta.owner === TMRoom.uid;
  const noticeBox = owner ? `<form class="notice-box" id="noticeForm"><input id="noticeInput" maxlength="120" placeholder="모든 모둠에 보낼 알림 (예: 5분 남았어요!)" value="${esc(noticeDraft)}"><button class="btn primary small">알림 보내기</button></form>` : "";
  let html = `<div class="dash-head"><h1><small>모둠 활동 · ${n}모둠</small>${esc(meta.title)}</h1>
    <div class="join-box"><div class="how">학생: <b>코드 입력</b>에<br>이 코드 → 모둠 번호·이름</div><div class="code">${esc(code)}</div></div></div>
    ${noticeBox}<div class="groups">`;
  for (const b of boards) {
    const mem = [...new Set(Object.values(b.st.members).map(m => m && m.name).filter(Boolean))];
    const placed = b.st.tiers.reduce((s, t) => s + t.items.length, 0);
    html += `<div class="gcard${mem.length || placed ? "" : " empty"}${focusG === b.g ? " focus" : ""}" data-g="${b.g}">
      <h3>${b.g}모둠 <span class="${mem.length ? "live" : ""}">${mem.length ? "● " + mem.map(esc).join(", ") : "아직 아무도 없어요"}</span></h3>
      <div class="tier-table mini">${b.st.tiers.map(t => `<div class="tier-row"><div class="tier-label${[...t.label].length > 3 ? " long" : ""}" style="background:${esc(t.color)}"><span>${esc(t.label)}</span>${t.max > 0 ? `<span class="cnt${t.items.length > t.max ? " over" : t.items.length === t.max ? " full" : ""}">${t.items.length}/${t.max}</span>` : ""}</div>
        <div class="tier-items">${t.items.map(id => tile(b.st.items[id])).join("")}</div></div>`).join("")}</div>
      <div class="left">배치 ${placed} / ${totalItems - (b.st.trash || []).length} · 남은 항목 ${b.st.pool.length}개${(b.st.trash || []).length ? ` · 휴지통 ${b.st.trash.length}` : ""}</div>
      ${chatHtml(b.raw.chat, b.g)}</div>`;
  }
  html += `</div>` + summary(boards);
  const hadFocus = document.activeElement && document.activeElement.id === "noticeInput";
  dash.innerHTML = html;
  if (hadFocus) { const i = $("#noticeInput"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  lastData = data;
  $("#backdrop").classList.toggle("show", focusG != null);
}

function chatHtml(c, g) {
  const arr = Object.values(c || {}).filter(m => m && m.m).sort((a, b) => a.t - b.t);
  if (!arr.length) return `<div class="gchat empty">채팅 없음</div>`;
  const show = focusG === g ? arr.slice(-40) : arr.slice(-3);
  return `<div class="gchat"><div class="gchat-h">채팅 ${arr.length}개${focusG === g ? "" : " · 최근 3개"}</div>${show.map(m => `<div><b>${esc(m.n)}</b> ${esc(m.m)}</div>`).join("")}</div>`;
}
// 반 전체: S=가장 높은 점수. 줄 수가 모둠마다 달라도 0~1 사이 점수로 맞춤
function summary(boards) {
  const agg = {};
  for (const b of boards) {
    const k = b.st.tiers.length; if (!k) continue;
    b.st.tiers.forEach((t, i) => t.items.forEach(id => {
      const a = agg[id] || (agg[id] = { id, it: b.st.items[id], scores: [], labels: [] });
      a.scores.push(k === 1 ? 1 : 1 - i / (k - 1)); a.labels.push({ l: t.label, c: t.color });
    }));
  }
  const arr = Object.values(agg).filter(a => a.scores.length);
  if (!arr.length) return `<div class="summary"><div class="sbox"><h2>반 전체 순위</h2><p>모둠이 항목을 줄에 놓으면 여기에 모여요.</p></div></div>`;
  arr.forEach(a => { const m = a.scores.reduce((s, x) => s + x, 0) / a.scores.length; a.avg = m; a.sd = Math.sqrt(a.scores.reduce((s, x) => s + (x - m) ** 2, 0) / a.scores.length); });
  const top = [...arr].sort((a, b) => b.avg - a.avg || b.scores.length - a.scores.length).slice(0, 10);
  const split = arr.filter(a => a.scores.length >= 2).sort((a, b) => b.sd - a.sd).slice(0, 6);
  const row = (a, i, extra) => `<div class="rank"><span class="n">${i + 1}</span>${tile(a.it, "th")}<span>${esc(nameOf(a.it))} <small style="color:var(--muted)">(${a.scores.length}모둠)</small></span>${extra}</div>`;
  return `<div class="summary">
    <div class="sbox"><h2>반 전체 순위 TOP 10</h2><p>모둠들이 높은 줄에 놓을수록 위로 올라가요.</p>
      ${top.map((a, i) => row(a, i, `<div class="bar"><i style="width:${Math.round(a.avg * 100)}%"></i></div>`)).join("")}</div>
    <div class="sbox"><h2>의견이 갈린 항목</h2><p>모둠마다 다른 줄에 놓은 항목이에요. 토론거리로 좋아요.</p>
      ${split.length ? split.map((a, i) => row(a, i, `<div class="dist">${a.labels.map(x => `<i style="background:${esc(x.c)}">${esc(x.l)}</i>`).join("")}</div>`)).join("") : `<p>아직 두 모둠 이상이 놓은 항목이 없어요.</p>`}</div>
  </div>`;
}

dash.addEventListener("input", e => { if (e.target.id === "noticeInput") noticeDraft = e.target.value; });
dash.addEventListener("submit", async e => {
  if (e.target.id !== "noticeForm") return;
  e.preventDefault();
  const m = noticeDraft.trim(); if (!m || !lastData) return;
  const up = {}, t = Date.now();
  for (let g = 1; g <= (lastData.meta.groups || 4); g++) up[`${g}/notice`] = { m, t };
  try { await TMRoom.notifyGroups(code, up); noticeDraft = ""; $("#noticeInput").value = ""; toast("모든 모둠에 알림을 보냈어요"); } catch (err) { toast(err.message); }
});
dash.addEventListener("click", e => {
  if (e.target.closest(".notice-box")) return;
  const c = e.target.closest(".gcard"); if (!c) return;
  const g = +c.dataset.g; focusG = focusG === g ? null : g;
  if (lastData) draw(lastData);
  $("#backdrop").classList.toggle("show", focusG != null);
});
$("#backdrop").onclick = () => { focusG = null; if (lastData) draw(lastData); };
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#backdrop").onclick(); });
$("#btnClose").onclick = async () => {
  if (!confirm(`코드 ${code} 모둠 활동을 끝낼까요?\n모둠 판이 서버에서 지워져요. 학생 기기에는 마지막 모습이 남아요.`)) return;
  try { await TMRoom.closeSession(code); toast("활동을 끝냈어요"); } catch (e) { toast(e.message); }
};
})();
