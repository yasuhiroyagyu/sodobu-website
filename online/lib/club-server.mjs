import initialContent from './initial-content.json' with { type: 'json' };
import initialAssets from './initial-assets.json' with { type: 'json' };

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CONTENT_BYTES = 1024 * 1024;
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex',
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
class InputError extends Error {}
function text(value, name, max = 2000) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw new InputError(`${name}を確認してください。`);
  return value;
}
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError(`${name}の形式が正しくありません。`);
  return value;
}
function url(value, name, image = false) {
  value = text(value, name).trim();
  if (!value) return '';
  try {
    const parsed = new URL(value, 'https://site.local/');
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || /[\u0000-\u0020\\]/.test(value)) throw new Error();
    if (image && parsed.origin === 'https://site.local' && !/^(?:\/?assets\/photos\/|\/?uploads\/)/.test(value)) throw new Error();
    return value;
  } catch { throw new InputError(`${name}には正しいURLを入力してください。`); }
}
function strings(value, fields, label) {
  object(value, label);
  return Object.fromEntries(fields.map(key => [key, text(value[key], label, ['body', 'comment'].includes(key) ? 10000 : 2000)]));
}
function photo(value, label) {
  const result = strings(value, ['src', 'alt', 'caption', 'position'], label);
  result.src = url(result.src, `${label}の写真`, true);
  if (result.position && !/^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(result.position)) throw new InputError('写真の位置は「50% 30%」のように入力してください。');
  return result;
}
export function validateContent(value) {
  object(value, 'サイト情報');
  const email = text(value.contactEmail, 'メールアドレス', 254).trim();
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new InputError('メールアドレスを確認してください。');
  const photos = object(value.photos, '写真');
  const works = value.works;
  const updates = value.updates;
  if (!Array.isArray(works) || works.length > 1000 || !Array.isArray(updates) || updates.length > 500) throw new InputError('作品・活動記録の件数を確認してください。');
  const result = {
    photos: Object.fromEntries(['hero', 'about', 'preparation', 'hawaii', 'work1', 'work2', 'work3'].map(key => [key, photo(photos[key] || {}, key)])),
    info: strings(value.info, ['activities', 'schedule', 'visit'], '基本情報'),
    contactEmail: email,
    crowdfundingUrl: url(value.crowdfundingUrl, '支援先'),
    shopUrl: url(value.shopUrl, 'オーダーメイドの案内先'),
    socials: Object.fromEntries(['tiktok', 'youtube', 'instagram', 'x'].map(key => [key, url(object(value.socials, '公式SNS')[key], key)])),
    works: works.map((work, index) => {
      const row = strings(work, ['src', 'alt', 'title', 'author', 'year', 'caption', 'comment', 'orientation'], `作品 ${index + 1}`);
      row.src = url(row.src, `作品 ${index + 1}の写真`, true);
      if (!row.src || !row.title.trim()) throw new InputError(`作品 ${index + 1}の写真と作品名を入力してください。`);
      if (!['tall', 'wide', 'square'].includes(row.orientation)) throw new InputError(`作品 ${index + 1}の写真の形を選んでください。`);
      return row;
    }),
    updates: updates.map((update, index) => {
      const row = strings(update, ['date', 'category', 'title', 'body', 'href'], `活動記録 ${index + 1}`);
      const date = new Date(`${row.date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.date || !row.title.trim()) throw new InputError(`活動記録 ${index + 1}の日付とタイトルを確認してください。`);
      row.href = url(row.href, `活動記録 ${index + 1}の詳細リンク`);
      return row;
    }),
  };
  return result;
}
export function adminIdentity(request, env) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  const allowed = (env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return { id, email, signedIn: !!(id && email), authorized: !!(id && email && allowed.includes(email.toLowerCase())), configured: allowed.length > 0 };
}
async function current(env) {
  if (!env.DB) throw new Error('Database binding missing');
  const row = await env.DB.prepare('SELECT body, revision, updated_at FROM club_content WHERE id = ?').bind('site').first();
  return row ? { data: JSON.parse(row.body), revision: row.revision, updatedAt: row.updated_at } : { data: initialContent, revision: 0, updatedAt: null };
}
function writeAllowed(request) {
  const origin = new URL(request.url).origin;
  return request.headers.get('Origin') === origin && request.headers.get('X-Requested-With') === 'shodobu-admin' && request.headers.get('Sec-Fetch-Site') !== 'cross-site';
}
async function limitedBytes(request, max) {
  const length = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > max) throw new InputError('送信するデータが大きすぎます。');
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('送信するデータがありません。');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); throw new InputError('送信するデータが大きすぎます。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function imageType(bytes) {
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return ['jpg', 'image/jpeg'];
  if (bytes.length >= 32 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value) && String.fromCharCode(...bytes.slice(-8, -4)) === 'IEND') return ['png', 'image/png'];
  if (bytes.length >= 20 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length) return ['webp', 'image/webp'];
  throw new InputError('JPEG・PNG・WebPの写真を選んでください。');
}
export async function clubRequest(request, env) {
  const path = new URL(request.url).pathname;
  if (path !== '/content.js' && !path.startsWith('/api/admin/') && !path.startsWith('/uploads/')) return null;
  try {
    if (path === '/content.js') {
      if (!['GET', 'HEAD'].includes(request.method)) return json({ message: 'この操作は利用できません。' }, 405);
      const value = await current(env);
      return new Response(request.method === 'HEAD' ? null : `window.CLUB_CONTENT = ${JSON.stringify(value.data).replaceAll('<', '\\u003c')};\n`, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
    }
    if (path.startsWith('/uploads/')) {
      if (!['GET', 'HEAD'].includes(request.method) || !/^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return json({ message: '写真が見つかりません。' }, 404);
      const stored = await env.BUCKET?.get(path.slice(1));
      if (!stored) return json({ message: '写真が見つかりません。' }, 404);
      return new Response(request.method === 'HEAD' ? null : stored.body, { headers: { 'Content-Type': stored.httpMetadata?.contentType || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    const user = adminIdentity(request, env);
    const message = !user.configured ? '管理者アカウントの設定を準備しています。' : !user.signedIn ? '管理者アカウントでログインしてください。' : 'このアカウントには編集権限がありません。管理者アカウントに切り替えてください。';
    if (path === '/api/admin/session' && request.method === 'GET') return json({ authorized: user.authorized, email: user.authorized ? user.email : null, message: user.authorized ? '' : message });
    if (!user.authorized) return json({ message }, user.signedIn ? 403 : 401);
    if (request.method === 'POST' && !writeAllowed(request)) return json({ message: '管理者画面から保存してください。' }, 403);
    if (path === '/api/admin/content' && request.method === 'GET') return json(await current(env));
    if (path === '/api/admin/content' && request.method === 'POST') {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ message: '保存データの形式が正しくありません。' }, 415);
      let input;
      try { input = JSON.parse(new TextDecoder().decode(await limitedBytes(request, MAX_CONTENT_BYTES))); }
      catch (error) { if (error instanceof InputError) throw error; throw new InputError('保存データの形式が正しくありません。'); }
      if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new InputError('保存済みの内容を読み直してください。');
      const data = validateContent(input.data);
      const now = new Date().toISOString();
      if (!env.DB) throw new Error('Database binding missing');
      const results = await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO club_content (id, body, revision, updated_at, updated_by) VALUES (?, ?, 0, ?, ?)').bind('site', JSON.stringify(initialContent), now, user.id),
        env.DB.prepare('INSERT INTO content_history (id, body, revision, saved_at, saved_by) SELECT ?, body, revision, ?, ? FROM club_content WHERE id = ? AND revision = ?').bind(crypto.randomUUID(), now, user.id, 'site', input.revision),
        env.DB.prepare('UPDATE club_content SET body = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(data), now, user.id, 'site', input.revision),
      ]);
      if (!results[2].meta.changes) return json({ message: '別の画面で更新されています。入力内容を控えてから「保存済みの内容に戻す」で読み直してください。' }, 409);
      return json({ revision: input.revision + 1, updatedAt: now });
    }
    if (path === '/api/admin/assets' && request.method === 'GET') {
      const uploaded = [];
      if (!env.BUCKET) throw new Error('Storage binding missing');
      let cursor;
      do {
        const page = await env.BUCKET.list({ prefix: 'uploads/', limit: 500, ...(cursor ? { cursor } : {}) });
        uploaded.push(...page.objects.map(value => value.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return json({ assets: [...initialAssets, ...uploaded] });
    }
    if (path === '/api/admin/upload' && request.method === 'POST') {
      const bytes = await limitedBytes(request, MAX_IMAGE_BYTES);
      const [extension, mime] = imageType(bytes);
      if (request.headers.get('Content-Type') !== mime) throw new InputError('写真の形式を確認してください。');
      if (!env.BUCKET) throw new Error('Storage binding missing');
      const key = `uploads/${crypto.randomUUID()}.${extension}`;
      await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
      return json({ src: key }, 201);
    }
    return json({ message: 'この操作は利用できません。' }, 404);
  } catch (error) {
    if (error instanceof InputError) return json({ message: error.message }, 400);
    console.error('Club admin operation failed:', error instanceof Error ? error.message : 'unknown');
    return json({ message: '保存先に接続できませんでした。時間をおいて再度お試しください。' }, 503);
  }
}
