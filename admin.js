(() => {
  'use strict';
  const form = document.querySelector('#editor');
  const status = document.querySelector('#save-status');
  const saves = [document.querySelector('#save-button'), document.querySelector('#save-bottom')];
  const clone = value => JSON.parse(JSON.stringify(value));
  let data = clone(window.CLUB_CONTENT || {});
  let revision = 0;
  let authorized = false;
  let dirty = false;
  let busy = false;
  let photoTarget = null;
  let assetTarget = null;
  const photoNames = { hero: 'トップページ', about: '書道部について', preparation: 'ハワイへの準備', hawaii: 'ハワイへの挑戦' };
  const setStatus = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle('error', error);
  };
  function state() {
    saves.forEach(button => { button.disabled = !authorized || !dirty || busy; });
    form.querySelectorAll('input, textarea, select, button').forEach(el => {
      if (!saves.includes(el)) el.disabled = !authorized || busy || el.dataset.unavailable === 'true';
    });
    form.setAttribute('aria-busy', String(busy));
  }
  function changed() { dirty = true; setStatus('変更があります。「変更を保存」でサイトに反映されます。'); state(); }
  function read(path) { return path.split('.').reduce((value, key) => value?.[key], data) || ''; }
  function write(path, value) {
    const keys = path.split('.');
    let target = data;
    keys.slice(0, -1).forEach(key => { target[key] ||= {}; target = target[key]; });
    target[keys.at(-1)] = value;
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action, className = 'secondary') {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function field(label, object, key, { type = 'text', full = false, rows } = {}) {
    const wrapper = el('label', full ? 'full' : '', label);
    const input = el(rows ? 'textarea' : 'input');
    if (rows) input.rows = rows; else input.type = type;
    input.value = object[key] || '';
    input.maxLength = rows ? 10000 : 2000;
    input.addEventListener('input', () => { object[key] = input.value; changed(); });
    wrapper.append(input);
    return wrapper;
  }
  function safeImage(src) {
    if (!src) return '';
    try { const url = new URL(src, location.href); return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  }
  function preview(container, object) {
    container.replaceChildren();
    const src = safeImage(object.src);
    if (!src) { container.append(el('span', 'photo-empty', '写真が選ばれていません')); return; }
    const image = el('img');
    image.alt = object.alt || '掲載写真のプレビュー';
    image.loading = 'lazy';
    image.addEventListener('error', () => { container.replaceChildren(el('span', 'photo-empty', '写真を読み込めません。URLをご確認ください。')); }, { once: true });
    image.src = src;
    container.append(image);
  }
  function photoEditor(object, fields) {
    const grid = el('div', 'photo-editor');
    const imageBox = el('div', 'image-preview');
    preview(imageBox, object);
    const inputs = el('div');
    const actions = el('div', 'photo-actions');
    const updateImage = src => {
      object.src = src;
      urlInput.value = src;
      preview(imageBox, object);
      changed();
    };
    actions.append(button('写真をアップロード', () => {
      photoTarget = updateImage;
      const upload = document.querySelector('#upload-input');
      upload.value = '';
      upload.click();
    }), button('保存済みから選ぶ', () => openAssets(updateImage)));
    const url = field('写真のURL', object, 'src', { full: true });
    const urlInput = url.querySelector('input');
    urlInput.addEventListener('change', () => preview(imageBox, object));
    inputs.append(actions);
    const fieldGrid = el('div', 'field-grid');
    fieldGrid.append(url, field('写真の説明（読み上げ用）', object, 'alt', { full: true }));
    fields.forEach(item => fieldGrid.append(item));
    inputs.append(fieldGrid);
    grid.append(imageBox, inputs);
    return grid;
  }
  function renderPhotos() {
    const list = document.querySelector('#photo-list');
    list.replaceChildren();
    data.photos ||= {};
    Object.entries(photoNames).forEach(([key, name]) => {
      const object = data.photos[key] ||= { src: '', alt: '' };
      const card = el('div', 'edit-card');
      card.append(el('h3', 'card-heading', name), photoEditor(object, [field('写真の位置（任意）', object, 'position')]));
      list.append(card);
    });
  }
  function renderWorks(focusIndex) {
    data.works ||= [];
    const list = document.querySelector('#work-list');
    list.replaceChildren();
    document.querySelector('#work-count').textContent = `${data.works.length}点`;
    if (!data.works.length) list.append(el('p', 'empty-editor', '作品はまだ登録されていません。'));
    data.works.forEach((work, index) => {
      const card = el('article', 'edit-card work-editor');
      const heading = el('div', 'card-heading');
      const controls = el('div', 'card-controls');
      const move = direction => {
        const next = index + direction;
        if (next < 0 || next >= data.works.length) return;
        [data.works[index], data.works[next]] = [data.works[next], data.works[index]];
        changed(); renderWorks(next); state();
      };
      const up = button('上へ', () => move(-1));
      const down = button('下へ', () => move(1));
      up.dataset.unavailable = String(index === 0);
      down.dataset.unavailable = String(index === data.works.length - 1);
      controls.append(up, down, button('掲載を外す', () => {
        data.works.splice(index, 1); changed(); renderWorks(Math.max(0, index - 1)); state();
      }, 'danger'));
      heading.append(el('h3', '', `${String(index + 1).padStart(2, '0')} / ${work.title || '作品名未入力'}`), controls);
      const orientationLabel = el('label', '', '写真の形');
      const select = el('select');
      [['tall', '縦長'], ['wide', '横長'], ['square', '正方形']].forEach(([value, title]) => {
        const option = el('option', '', title); option.value = value; select.append(option);
      });
      select.value = work.orientation || 'tall';
      select.addEventListener('change', () => { work.orientation = select.value; changed(); });
      orientationLabel.append(select);
      card.append(heading, photoEditor(work, [
        field('作品名', work, 'title'), field('作者名（任意）', work, 'author'),
        field('制作年（任意）', work, 'year'), orientationLabel,
        field('補足情報（任意）', work, 'caption', { full: true }),
        field('作品に込めた思い（任意）', work, 'comment', { full: true, rows: 3 })
      ]));
      list.append(card);
    });
    state();
    if (focusIndex !== undefined) list.children[focusIndex]?.querySelector('input')?.focus();
  }
  function renderUpdates(focusIndex) {
    data.updates ||= [];
    const list = document.querySelector('#update-list');
    list.replaceChildren();
    document.querySelector('#update-count').textContent = `${data.updates.length}件`;
    if (!data.updates.length) list.append(el('p', 'empty-editor', '活動記録はまだ登録されていません。'));
    data.updates.forEach((update, index) => {
      const card = el('article', 'edit-card');
      const heading = el('div', 'card-heading');
      heading.append(el('h3', '', update.title || `活動記録 ${index + 1}`), button('掲載を外す', () => {
        data.updates.splice(index, 1); changed(); renderUpdates(); state();
      }, 'danger'));
      const fields = el('div', 'field-grid');
      fields.append(field('日付', update, 'date', { type: 'date' }), field('分類', update, 'category'),
        field('タイトル', update, 'title', { full: true }), field('本文', update, 'body', { full: true, rows: 5 }),
        field('詳細ページのURL（任意）', update, 'href', { full: true }));
      card.append(heading, fields); list.append(card);
    });
    state();
    if (focusIndex !== undefined) list.children[focusIndex]?.querySelector('input')?.focus();
  }
  function render() {
    form.querySelectorAll('[data-path]').forEach(input => { input.value = read(input.dataset.path); });
    renderPhotos(); renderWorks(); renderUpdates(); state();
  }
  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
    let result;
    try { result = await response.json(); } catch { throw new Error('オンライン管理用の接続先が見つかりません。'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) { authorized = false; state(); showLogin(result.message); }
      throw new Error(result.message || '通信に失敗しました。もう一度お試しください。');
    }
    return result;
  }
  function showLogin(message) {
    document.querySelector('#service-notice').hidden = false;
    document.querySelector('#login-message').textContent = message || '編集するには管理者アカウントでログインしてください。';
  }
  async function load() {
    try {
      const session = await api('/api/admin/session');
      if (!session.authorized) {
        showLogin(session.message); setStatus(session.message || '管理者としてログインしてください。'); return;
      }
      authorized = true;
      document.querySelector('#service-notice').hidden = true;
      document.querySelector('#signout-link').hidden = false;
      const result = await api('/api/admin/content');
      data = clone(result.data); revision = result.revision; dirty = false;
      render(); setStatus(`${session.email} でログイン中。保存済みの内容を表示しています。`);
    } catch (error) {
      authorized = false; state();
      setStatus(error.message, true);
      showLogin('オンライン版の管理者画面でログインすると編集できます。この画面では現在の内容を確認できます。');
      const link = document.querySelector('#signin-link');
      link.href = 'https://tsukuba-shodobu.yagyujj.chatgpt.site/admin.html';
      link.textContent = 'オンライン管理画面を開く';
    }
  }
  async function openAssets(onSelect) {
    if (!authorized || busy) return;
    assetTarget = onSelect;
    const dialog = document.querySelector('#asset-dialog');
    const list = document.querySelector('#asset-list');
    list.replaceChildren(el('p', '', '読み込んでいます…'));
    dialog.showModal();
    try {
      const result = await api('/api/admin/assets');
      list.replaceChildren();
      result.assets.forEach(src => {
        const option = button('', () => { assetTarget?.(src); dialog.close(); }, 'asset-option');
        const image = el('img'); image.src = src; image.alt = ''; image.loading = 'lazy';
        option.append(image, el('span', '', src.split('/').at(-1))); list.append(option);
      });
      if (!result.assets.length) list.append(el('p', '', '保存済みの写真はありません。'));
    } catch (error) { list.replaceChildren(el('p', '', error.message)); }
  }
  form.addEventListener('input', event => {
    if (!authorized || busy) return;
    if (event.target.dataset.path) { write(event.target.dataset.path, event.target.value); changed(); }
  });
  document.querySelector('#add-work').addEventListener('click', () => {
    data.works.push({ src: '', alt: '', title: '', orientation: 'tall' }); changed(); renderWorks(data.works.length - 1);
  });
  document.querySelector('#add-update').addEventListener('click', () => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    data.updates.unshift({ date: today, category: '活動報告', title: '', body: '', href: '' }); changed(); renderUpdates(0);
  });
  document.querySelector('#close-assets').addEventListener('click', () => document.querySelector('#asset-dialog').close());
  document.querySelector('#upload-input').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file || !authorized || busy || !photoTarget) return;
    if (file.size > 12 * 1024 * 1024) { setStatus('写真は12MB以内でアップロードしてください。', true); return; }
    busy = true; state(); setStatus('写真をアップロードしています…');
    try {
      const result = await api('/api/admin/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Requested-With': 'shodobu-admin' }, body: file });
      photoTarget(result.src);
      setStatus('写真を選択しました。「変更を保存」で掲載されます。');
    } catch (error) { setStatus(error.message, true); }
    finally { busy = false; state(); }
  });
  document.querySelector('#reload-button').addEventListener('click', async () => {
    if (dirty && !confirm('保存していない変更を取り消しますか？')) return;
    busy = true; state(); await load(); busy = false; state();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authorized || !dirty || busy || !form.reportValidity()) return;
    busy = true; state(); setStatus('保存しています…');
    try {
      const result = await api('/api/admin/content', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'shodobu-admin' }, body: JSON.stringify({ revision, data }) });
      revision = result.revision; dirty = false;
      setStatus('保存しました。オンラインのサイトに反映されています。');
    } catch (error) { setStatus(error.message, true); }
    finally { busy = false; state(); }
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  render(); load();
})();
