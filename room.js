/* 모둠 실시간 공유 — Firebase Realtime Database (학생은 보이지 않는 익명 인증, 로그인 화면 없음) */
window.TMRoom = (() => {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let fb = null, db = null, uid = null, ready = null;

  const cfg = () => (window.TIER_CONFIG && window.TIER_CONFIG.firebase) || null;
  const available = () => !!(window.__FAKE_FB || (cfg() && cfg().databaseURL));
  function loadScript(src) {
    return new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src === src)) return res();
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Firebase를 불러오지 못했어요. 인터넷 연결을 확인해 주세요."));
      document.head.appendChild(s);
    });
  }
  function init() {
    if (!available()) return Promise.reject(new Error("모둠 활동 서버가 아직 설정되지 않았어요."));
    if (ready) return ready;
    ready = (async () => {
      if (window.__FAKE_FB) fb = window.__FAKE_FB;
      else {
        await loadScript(SDK + "firebase-app-compat.js");
        await loadScript(SDK + "firebase-auth-compat.js");
        await loadScript(SDK + "firebase-database-compat.js");
        fb = window.firebase;
        if (!fb.apps.length) fb.initializeApp(cfg());
      }
      const cred = await fb.auth().signInAnonymously();
      uid = cred.user.uid;
      db = fb.database();
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }
  const ref = p => (p ? db.ref(p) : db.ref());
  const val = async p => (await ref(p).get()).val();
  const makeCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

  async function createSession({ title, groups, tpl }) {
    await init();
    let code;
    for (let i = 0; i < 10; i++) { code = makeCode(); if (!(await val(`sessions/${code}/meta`))) break; }
    await ref(`sessions/${code}/meta`).set({ title, groups, owner: uid, created: Date.now(), tpl });
    return code;
  }
  async function getSession(code) { await init(); return await val(`sessions/${code}/meta`); }
  async function groupCounts(code) {
    await init();
    const g = (await val(`sessions/${code}/groups`)) || {};
    const out = {}; for (const k in g) out[k] = Object.keys((g[k] && g[k].members) || {}).length;
    return out;
  }
  async function closeSession(code) {
    await init();
    await ref(`sessions/${code}/groups`).remove();
    await ref(`sessions/${code}/meta`).remove();
  }

  // 모둠 판에 들어가기: onState(group데이터) 를 바뀔 때마다 호출
  async function join(code, g, name, onState) {
    await init();
    const base = `sessions/${code}/groups/${g}`;
    const me = ref(`${base}/members/${uid}`);
    await me.set({ name, at: Date.now() });
    me.onDisconnect().remove();
    const gref = ref(base);
    const cb = snap => onState(snap.val() || {});
    gref.on("value", cb);
    const beat = setInterval(() => me.update({ at: Date.now() }), 60000);
    return {
      uid, base,
      update(paths) { const up = {}; for (const k in paths) up[`${base}/${k}`] = paths[k]; return ref("").update(up); },
      leave() { clearInterval(beat); gref.off("value", cb); me.remove(); },
      rename(n) { return me.update({ name: n, at: Date.now() }); },
    };
  }
  // 교사용: 세션 전체 지켜보기
  async function watch(code, cb) {
    await init();
    const r = ref(`sessions/${code}`); const h = s => cb(s.val());
    r.on("value", h);
    return () => r.off("value", h);
  }
  return { available, init, createSession, getSession, groupCounts, closeSession, join, watch, get uid() { return uid; } };
})();

/* 템플릿 + 모둠 데이터 → 화면용 티어표 (앱·교사 화면 공용) */
window.TMBuild = function (meta, group) {
  const tpl = (meta && meta.tpl) || {};
  group = group || {};
  const tplTiers = Array.isArray(tpl.tiers) ? tpl.tiers : Object.values(tpl.tiers || {});
  let tiers;
  if (group.tiers) tiers = Object.entries(group.tiers).map(([id, t]) => ({ id, label: t.label || "", color: t.color || "#cfcfcf", o: t.o || 0 })).sort((a, b) => a.o - b.o);
  else tiers = tplTiers.map((t, i) => ({ id: "t" + i, label: t.label || "", color: t.color || "#cfcfcf", o: i }));
  const items = Object.assign({}, tpl.items || {}, group.items || {});
  // 기본 위치 = 템플릿 위치
  const pos = {};
  tplTiers.forEach((t, i) => (Array.isArray(t.items) ? t.items : Object.values(t.items || {})).forEach((id, j) => pos[id] = { z: "t" + i, o: j }));
  (Array.isArray(tpl.pool) ? tpl.pool : Object.values(tpl.pool || {})).forEach((id, j) => pos[id] = { z: "pool", o: j });
  Object.assign(pos, group.pos || {});
  const zones = {}; tiers.forEach(t => zones[t.id] = []); zones.pool = [];
  for (const id in items) {
    const p = pos[id] || { z: "pool", o: 9999 };
    if (p.z === "x") { delete items[id]; continue; }
    (zones[p.z] || zones.pool).push([id, p.o ?? 9999, p.t || 0]);
  }
  const sortZ = arr => arr.sort((a, b) => a[1] - b[1] || a[2] - b[2] || (a[0] < b[0] ? -1 : 1)).map(x => x[0]);
  return {
    title: meta && meta.title || "",
    tiers: tiers.map(t => ({ id: t.id, label: t.label, color: t.color, items: sortZ(zones[t.id]) })),
    pool: sortZ(zones.pool), items, pos,
    members: group.members || {},
  };
};
