import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { clubRequest, validateContent } from '../lib/club-server.mjs';
import initialContent from '../lib/initial-content.json' with { type: 'json' };

const origin = 'https://club.example';
const adminHeaders = { 'oai-authenticated-user-id': 'owner-id', 'oai-authenticated-user-email': 'owner@example.com' };
const clone = value => JSON.parse(JSON.stringify(value));
function environment() {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort();
  for (const file of migrations) sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  const db = {
    prepare(sql) {
      let values = [];
      return {
        bind(...input) { values = input; return this; },
        async first() { return sqlite.prepare(sql).get(...values) || null; },
        execute() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const uploads = new Map();
  return {
    DB: db, ADMIN_EMAILS: 'owner@example.com', sqlite,
    BUCKET: {
      async put(key, bytes, options) { uploads.set(key, { body: bytes, ...options }); },
      async get(key) { return uploads.get(key) || null; },
      async list() { return { objects: [...uploads.keys()].map(key => ({ key })), truncated: false }; },
    },
  };
}
function request(path, { user = true, method = 'GET', body, headers = {} } = {}) {
  return new Request(origin + path, {
    method,
    headers: { ...(user ? adminHeaders : {}), ...(method === 'POST' ? { Origin: origin, 'X-Requested-With': 'shodobu-admin', 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) }),
  });
}
test('public data retains the nine selected works and official links', async () => {
  const env = environment();
  const response = await clubRequest(request('/content.js', { user: false }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(await response.text(), /utkbshodo@gmail\.com/);
  const content = await (await clubRequest(request('/api/admin/content'), env)).json();
  assert.equal(content.data.works.length, 9);
  assert.deepEqual(content.data.works.map(work => work.title), ['作品写真 01','作品写真 02','作品写真 03','作品写真 04','作品写真 05','作品写真 06','作品写真 07','作品写真 08','作品写真 12']);
  assert.equal(content.data.socials.x, 'https://x.com/tkb_shodo');
});
test('missing identity, wrong account and empty allowlist cannot edit', async () => {
  const env = environment();
  assert.equal((await clubRequest(request('/api/admin/content', { user: false }), env)).status, 401);
  assert.equal((await clubRequest(request('/api/admin/content', { headers: { 'oai-authenticated-user-email': 'visitor@example.com' } }), env)).status, 403);
  env.ADMIN_EMAILS = '';
  assert.equal((await clubRequest(request('/api/admin/content'), env)).status, 403);
  const session = await (await clubRequest(request('/api/admin/session'), env)).json();
  assert.equal(session.authorized, false);
});
test('cross-origin and missing custom headers are rejected', async () => {
  const env = environment();
  const body = { revision: 0, data: initialContent };
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body, headers: { Origin: 'https://other.example' } }), env)).status, 403);
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body, headers: { 'X-Requested-With': '' } }), env)).status, 403);
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body, headers: { 'Sec-Fetch-Site': 'cross-site' } }), env)).status, 403);
});
test('save persists across reads and backs up previous content', async () => {
  const env = environment();
  const data = clone(initialContent);
  data.contactEmail = 'new@example.com';
  data.works.reverse();
  data.updates.push({ date: '2026-10-11', category: '活動報告', title: '練習しました', body: '<script>文字として掲載</script>', href: 'activity.html' });
  const response = await clubRequest(request('/api/admin/content', { method: 'POST', body: { revision: 0, data } }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 1);
  const after = await (await clubRequest(request('/api/admin/content'), env)).json();
  assert.equal(after.data.contactEmail, 'new@example.com');
  assert.equal(after.data.works[0].title, '作品写真 12');
  const previous = JSON.parse(env.sqlite.prepare('SELECT body FROM content_history').get().body);
  assert.equal(previous.contactEmail, initialContent.contactEmail);
  const script = await (await clubRequest(request('/content.js', { user: false }), env)).text();
  assert.ok(!script.includes('<script>'));
  assert.ok(script.includes('\\u003cscript>'));
});
test('stale revision does not overwrite or create an extra backup', async () => {
  const env = environment();
  const body = { revision: 0, data: initialContent };
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body }), env)).status, 200);
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body }), env)).status, 409);
  assert.equal(env.sqlite.prepare('SELECT count(*) AS total FROM content_history').get().total, 1);
  assert.equal(env.sqlite.prepare('SELECT revision FROM club_content').get().revision, 1);
});
test('malformed JSON, executable URLs and invalid dates are rejected', async () => {
  const env = environment();
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body: '{bad' }), env)).status, 400);
  const bad = clone(initialContent);
  bad.socials.x = 'javascript:alert(1)';
  assert.throws(() => validateContent(bad));
  bad.socials.x = initialContent.socials.x;
  bad.updates = [{ date: '2026-02-30', title: 'invalid' }];
  assert.throws(() => validateContent(bad));
  bad.updates[0].date = '2026-99-99';
  assert.equal((await clubRequest(request('/api/admin/content', { method: 'POST', body: { revision: 0, data: bad } }), env)).status, 400);
});
test('images upload to durable storage with generated names and are selectable', async () => {
  const env = environment();
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKZ08AAAAASUVORK5CYII=', 'base64'));
  const response = await clubRequest(request('/api/admin/upload', { method: 'POST', body: png, headers: { 'Content-Type': 'image/png' } }), env);
  assert.equal(response.status, 201);
  const uploaded = await response.json();
  assert.match(uploaded.src, /^uploads\/[0-9a-f-]{36}\.png$/);
  const photo = await clubRequest(request('/' + uploaded.src, { user: false }), env);
  assert.equal(photo.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), png);
  const assets = await (await clubRequest(request('/api/admin/assets'), env)).json();
  assert.ok(assets.assets.includes(uploaded.src));
});
test('SVG and oversized uploads cannot be stored', async () => {
  const env = environment();
  assert.equal((await clubRequest(request('/api/admin/upload', { method: 'POST', body: '<svg></svg>', headers: { 'Content-Type': 'image/svg+xml' } }), env)).status, 400);
  assert.equal((await clubRequest(request('/api/admin/upload', { method: 'POST', body: 'x', headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(13 * 1024 * 1024) } }), env)).status, 400);
});
test('unknown routes fall through and invalid upload paths are not served', async () => {
  const env = environment();
  assert.equal(await clubRequest(request('/about.html', { user: false }), env), null);
  assert.equal((await clubRequest(request('/uploads/secret.txt', { user: false }), env)).status, 404);
});
