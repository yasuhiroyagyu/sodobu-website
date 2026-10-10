'use strict';

(() => {
  const content = window.CLUB_CONTENT || {};

  // All configured values are plain text. Only web URLs become links or images.
  function webUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      return url;
    } catch { return null; }
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function plain(value) { return typeof value === 'string' ? value.trim() : ''; }

  function icon(external = false) {
    const img = document.createElement('img');
    img.src = external ? 'assets/icons/arrow-up-right.svg' : 'assets/icons/arrow-right.svg';
    img.width = 20;
    img.height = 20;
    img.alt = external ? '（新しいタブで開きます）' : '';
    if (!external) img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function configureLink(link, url, alwaysExternal = false) {
    link.href = url.href;
    const external = alwaysExternal || url.origin !== location.origin;
    if (external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    return external;
  }

  document.querySelectorAll('[data-info]').forEach(node => {
    const value = plain(content.info?.[node.dataset.info]);
    if (value) node.textContent = value;
  });

  // Keep the current page visible in the horizontally scrolling mobile menu.
  const navigation = document.querySelector('#navigation');
  const selected = navigation?.querySelector('[aria-current]');
  if (navigation && selected) {
    requestAnimationFrame(() => {
      if (navigation.scrollWidth > navigation.clientWidth) {
        navigation.scrollLeft = selected.offsetLeft - navigation.offsetLeft - (navigation.clientWidth - selected.offsetWidth) / 2;
      }
    });
  }

  for (const [key, label] of [['crowdfunding', 'クラファンで応援する'], ['shop', 'オーダーのご案内を見る']]) {
    const url = webUrl(key === 'shop' ? content.shopUrl : content.crowdfundingUrl);
    if (!url) continue;
    document.querySelectorAll(`[data-action="${key}"]`).forEach(node => {
      const link = document.createElement('a');
      link.className = 'button';
      link.textContent = label;
      configureLink(link, url, true);
      link.append(icon(true));
      node.replaceChildren(link);
    });
    const explanation = key === 'shop'
      ? '販売先で、対象作品や価格、購入・受け渡し方法をご確認ください。'
      : '支援先で、募集期間や支援の内容、資金の使い道をご確認ください。';
    document.querySelectorAll(`[data-method-state="${key}"]`).forEach(node => { node.textContent = explanation; });
    document.querySelectorAll(`[data-faq-state="${key}"]`).forEach(node => {
      node.textContent = key === 'shop'
        ? '上の販売先で、対象作品と購入方法をご案内します。作品ページの作品がすべて販売対象とは限りません。'
        : '上の支援先で募集期間をご確認ください。企画の進捗は活動・お知らせでもご案内します。';
    });
    document.querySelectorAll('[data-project-status]').forEach(node => { node.textContent = '応援方法をご案内しています'; });
  }

  const email = plain(content.contactEmail);
  if (/^[^\s@<>"?&#]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    document.querySelectorAll('[data-contact]').forEach(node => {
      const address = document.createElement('a');
      address.className = 'contact-email';
      address.href = 'mailto:' + encodeURIComponent(email);
      address.textContent = email;
      const controls = document.createElement('div');
      controls.className = 'contact-controls';
      const copy = document.createElement('button');
      copy.className = 'copy-email';
      copy.type = 'button';
      copy.textContent = 'メールアドレスをコピー';
      const status = document.createElement('span');
      status.className = 'copy-status';
      status.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(email);
          status.textContent = 'コピーしました。';
        } catch {
          status.textContent = '上のアドレスを選択してコピーしてください。';
        }
      });
      controls.append(copy, status);
      node.replaceChildren(address, controls);
      const note = node.parentElement.querySelector('[data-contact-note]');
      if (note) note.textContent = '下のメールアドレスへご連絡ください。';
    });
  }

  const socialLinks = [['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['instagram', 'Instagram'], ['x', 'X']]
    .map(([key, label]) => ({ key, label, url: webUrl(content.socials?.[key]) }))
    .filter(item => item.url);
  document.querySelectorAll('[data-socials]').forEach(node => {
    if (!socialLinks.length) return;
    node.hidden = false;
    node.classList.add('social-links');
    const section = node.closest('[data-social-section]');
    if (section) section.hidden = false;
    for (const { key, label, url } of socialLinks) {
      const link = document.createElement('a');
      if (['tiktok', 'youtube', 'instagram'].includes(key)) {
        const logo = document.createElement('img');
        logo.src = `assets/icons/${key}.svg`;
        logo.width = 24;
        logo.height = 24;
        logo.alt = '';
        logo.setAttribute('aria-hidden', 'true');
        logo.addEventListener('error', () => { link.textContent = label; }, { once: true });
        link.append(logo);
      } else { link.textContent = label; }
      configureLink(link, url, true);
      link.setAttribute('aria-label', label + '（新しいタブで開きます）');
      link.title = label;
      node.append(link);
    }
  });

  // An empty list retains the honest preparation message in the HTML.
  const updates = (Array.isArray(content.updates) ? content.updates : [])
    .filter(item => item && plain(item.title) && validDate(item.date))
    .slice().sort((a, b) => b.date.localeCompare(a.date));
  document.querySelectorAll('[data-updates]').forEach(node => {
    if (!updates.length) return;
    const limit = Number(node.dataset.limit);
    const items = Number.isInteger(limit) && limit > 0 ? updates.slice(0, limit) : updates;
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const article = document.createElement('article');
      article.className = 'update-entry';
      const meta = document.createElement('div');
      meta.className = 'update-meta';
      const date = document.createElement('time');
      date.dateTime = item.date;
      date.textContent = item.date.replaceAll('-', '.');
      meta.append(date);
      if (plain(item.category)) {
        const category = document.createElement('span');
        category.className = 'update-category';
        category.textContent = item.category;
        meta.append(category);
      }
      const body = document.createElement('div');
      const heading = document.createElement('h3');
      const url = webUrl(item.href);
      if (url) {
        const link = document.createElement('a');
        link.textContent = item.title;
        link.append(icon(configureLink(link, url)));
        heading.append(link);
      } else { heading.textContent = item.title; }
      body.append(heading);
      if (plain(item.body)) {
        const text = document.createElement('p');
        text.textContent = item.body;
        body.append(text);
      }
      article.append(meta, body);
      fragment.append(article);
    }
    node.replaceChildren(fragment);
  });

  const dialog = document.querySelector('#work-dialog');
  let opener = null;
  function openWork(button, photo, url) {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    const image = dialog.querySelector('.dialog-image');
    image.src = url.href;
    image.alt = plain(photo.alt) || plain(photo.title) || '筑波大学書道部の作品';
    dialog.querySelector('#work-dialog-title').textContent = plain(photo.title) || '作品';
    dialog.querySelector('.dialog-caption').textContent = workCaption(photo);
    dialog.querySelector('.dialog-comment').textContent = plain(photo.comment);
    opener = button;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }
  dialog?.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });

  function workCaption(photo) {
    const details = [plain(photo.author), plain(String(photo.year || ''))].filter(Boolean).join(' / ');
    return [details, plain(photo.caption)].filter(Boolean).join('\n');
  }

  function setCaption(figure, photo) {
    const caption = figure?.querySelector('figcaption');
    if (!caption) return;
    const title = plain(photo.title);
    const details = workCaption(photo);
    if (!title && !details) return;
    caption.replaceChildren();
    if (title) {
      const strong = document.createElement('strong');
      strong.textContent = title;
      caption.append(strong);
    }
    if (details) caption.append(document.createTextNode(details));
  }

  function loadPhoto(slot, photo) {
    const url = webUrl(photo?.src);
    if (!url) return;
    const image = new Image();
    const isWork = slot.classList.contains('work-slot');
    image.alt = plain(photo.alt) || plain(photo.title) || (isWork ? '筑波大学書道部の作品' : '筑波大学書道部の活動風景');
    image.decoding = 'async';
    image.loading = slot.dataset.loading === 'eager' ? 'eager' : 'lazy';
    if (slot.dataset.loading === 'eager') image.fetchPriority = 'high';
    image.className = 'pending-photo';
    image.setAttribute('aria-hidden', 'true');
    if (!isWork && plain(photo.position)) image.style.objectPosition = photo.position;
    image.addEventListener('load', () => {
      image.className = '';
      image.removeAttribute('aria-hidden');
      slot.classList.add('has-photo');
      if (isWork && dialog && typeof dialog.showModal === 'function') {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', (plain(photo.title) || image.alt) + 'を拡大する');
        button.append(image);
        button.addEventListener('click', () => openWork(button, photo, url));
        slot.replaceChildren(button);
      } else { slot.replaceChildren(image); }
      if (isWork) {
        setCaption(slot.parentElement, photo);
        const note = document.querySelector('.gallery-note');
        const instruction = document.querySelector('.gallery-section .section-note');
        if (note) note.textContent = '作品を選ぶと、写真と作品の紹介を大きくご覧いただけます。販売対象の作品は、作品販売のご案内をご確認ください。';
        if (instruction) instruction.textContent = '作品を選ぶと、大きくご覧いただけます。';
      }
    }, { once: true });
    image.addEventListener('error', () => {
      image.remove();
      const message = slot.querySelector('.slot-copy p');
      const note = slot.querySelector('.slot-copy > span:last-child');
      if (message) message.textContent = '写真を読み込めませんでした。';
      if (note) note.textContent = '時間をおいて再度ご覧ください。';
    }, { once: true });
    // Attach before assigning src so native lazy loading can observe its position.
    slot.append(image);
    image.src = url.href;
  }

  const gallery = document.querySelector('[data-gallery]');
  const works = (Array.isArray(content.works) ? content.works : []).filter(photo => webUrl(photo?.src));
  if (gallery && works.length) {
    const fragment = document.createDocumentFragment();
    works.forEach((photo, index) => {
      const figure = document.createElement('figure');
      const slot = document.createElement('div');
      const orientation = ['tall', 'wide', 'square'].includes(photo.orientation) ? photo.orientation : 'square';
      slot.className = 'photo-slot work-slot work-' + orientation;
      const placeholder = document.createElement('div');
      placeholder.className = 'slot-copy';
      const mark = document.createElement('span');
      mark.className = 'slot-mark';
      mark.textContent = 'WORK ' + String(index + 1).padStart(2, '0');
      mark.setAttribute('aria-hidden', 'true');
      const text = document.createElement('p');
      text.textContent = plain(photo.title) || '作品';
      const note = document.createElement('span');
      note.textContent = '作品写真を読み込んでいます。';
      placeholder.append(mark, text, note);
      slot.append(placeholder);
      figure.append(slot, document.createElement('figcaption'));
      setCaption(figure, photo);
      fragment.append(figure);
      loadPhoto(slot, photo);
    });
    gallery.replaceChildren(fragment);
    const note = document.querySelector('.gallery-note');
    if (note) note.textContent = '作品を選ぶと、写真と作品の紹介を大きくご覧いただけます。販売対象の作品は、作品販売のご案内をご確認ください。';
  }

  document.querySelectorAll('[data-photo]').forEach(slot => {
    loadPhoto(slot, content.photos?.[slot.dataset.photo]);
  });
})();
