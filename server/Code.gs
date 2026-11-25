/**
 * 우리반 티어메이커 — 6자리 코드 서버 (Google Apps Script)
 * 템플릿은 선생님 구글 드라이브의 '티어메이커 템플릿' 폴더에 JSON 파일로 저장됩니다.
 *
 * ★ 아래 TEACHER_KEY를 선생님만 아는 비밀번호로 바꾼 뒤 배포하세요.
 */
const TEACHER_KEY = '여기에-교사-비밀번호';
const FOLDER_NAME = '티어메이커 템플릿';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 헷갈리는 0·O·1·I 제외
const MAX_BYTES = 3 * 1024 * 1024;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.ping) return out({ ok: true, app: 'tiermaker' });
  const code = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{6}$/.test(code)) return out({ ok: false, error: '코드는 영어·숫자 6자리예요.' });

  const cache = CacheService.getScriptCache();
  const hit = cache.get('c_' + code);
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

  const f = findFile(code);
  if (!f) return out({ ok: false, error: '없는 코드예요. 선생님께 다시 확인해 주세요.' });
  const text = '{"ok":true,"data":' + f.getBlob().getDataAsString('UTF-8') + '}';
  if (text.length < 90000) cache.put('c_' + code, text, 21600);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: '요청 형식 오류' }); }
  if (String(body.key || '') !== TEACHER_KEY) return out({ ok: false, error: '교사 비밀번호가 맞지 않아요.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === 'create') {
      const json = JSON.stringify(body.data || {});
      if (json.length > MAX_BYTES) return out({ ok: false, error: '템플릿이 너무 커요. 사진 수를 줄여 주세요.' });
      let code;
      for (let i = 0; i < 20; i++) { code = makeCode(); if (!findFile(code)) break; }
      const title = String((body.data && body.data.title) || '티어표').slice(0, 60);
      const file = folder().createFile(code + '.json', json, 'application/json');
      file.setDescription(title);
      return out({ ok: true, code: code });
    }
    if (body.action === 'list') {
      const items = [];
      const it = folder().getFiles();
      while (it.hasNext()) {
        const f = it.next();
        const m = f.getName().match(/^([A-Z0-9]{6})\.json$/);
        if (m) items.push({ code: m[1], title: f.getDescription() || '', created: f.getDateCreated().getTime() });
      }
      items.sort(function (a, b) { return b.created - a.created; });
      return out({ ok: true, items: items });
    }
    if (body.action === 'delete') {
      const code = String(body.code || '').toUpperCase();
      const f = findFile(code);
      if (f) f.setTrashed(true);
      CacheService.getScriptCache().remove('c_' + code);
      return out({ ok: true });
    }
    return out({ ok: false, error: '알 수 없는 요청' });
  } finally {
    lock.releaseLock();
  }
}

function folder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}
function findFile(code) {
  const it = folder().getFilesByName(code + '.json');
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
function makeCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  return s;
}
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 배포 전에 한 번 실행해서 드라이브 권한을 승인하세요 (편집기 위쪽에서 'setup' 선택 → 실행). */
function setup() {
  Logger.log('폴더 준비 완료: ' + folder().getUrl());
}
