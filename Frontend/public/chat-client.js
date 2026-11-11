/**
 * Fast Keno chat client — text, emoji, GIF stickers, rain, likes.
 * Uses Socket_SendEvent / login snapshot from readable_main.js.
 */
(function (global) {
  let CHAT_MAX_LEN = 160;
  let RAIN_AMOUNT_MIN = 0.1;
  let RAIN_AMOUNT_MAX = 1000;
  let RAIN_PLAYERS_MIN = 1;
  let RAIN_PLAYERS_MAX = 100;
  const CHAT_EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
    '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜',
    '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
    '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '😳',
    '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
    '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽',
    '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟',
    '🔥', '✨', '🌟', '💫', '⭐', '🎉', '🎊', '💰', '💸', '💵',
    '🎯', '✈️', '🛫', '🚀', '🌧', '☔', '❤️', '🧡', '💛', '💚',
  ];
  const CHAT_GIFS = [
    { url: '/assets/chat-gifs/gg.gif', label: 'GG' },
    { url: '/assets/chat-gifs/lets-go.gif', label: 'Lets Go' },
    { url: '/assets/chat-gifs/big-win.gif', label: 'Big Win' },
    { url: '/assets/chat-gifs/nice.gif', label: 'Nice' },
    { url: '/assets/chat-gifs/wow.gif', label: 'Wow' },
    { url: '/assets/chat-gifs/laugh.gif', label: 'Laugh' },
    { url: '/assets/chat-gifs/mind-blown.gif', label: 'Mind Blown' },
    { url: '/assets/chat-gifs/money-atm.gif', label: 'Money ATM' },
    { url: '/assets/chat-gifs/make-it-rain.gif', label: 'Make It Rain' },
    { url: '/assets/chat-gifs/rihanna.gif', label: 'Rihanna' },
    { url: '/assets/chat-gifs/dance.gif', label: 'Dance' },
    { url: '/assets/chat-gifs/success-kid.gif', label: 'Success Kid' },
    { url: '/assets/chat-gifs/sad.gif', label: 'Sad' },
    { url: '/assets/chat-gifs/rose.gif', label: 'Rose' },
    { url: '/assets/chat-gifs/vfx.gif', label: 'VFX' },
    { url: '/assets/chat-gifs/big-time-win.gif', label: 'Big Time Win' },
    { url: '/assets/chat-gifs/jackpot.gif', label: 'Jackpot' },
    { url: '/assets/chat-gifs/poker-face.gif', label: 'Poker Face' },
    { url: '/assets/chat-gifs/real-estate.gif', label: 'Real Estate' },
    { url: '/assets/chat-gifs/panda.gif', label: 'Panda' },
  ];
  const SCROLL_BOTTOM_PX = 48;
  const state = {
    messages: [],
    likedIds: new Set(),
    pendingClaims: new Set(),
    rainTimerIv: null,
    online: 0,
    activeTool: null,
    userId: null,
    ready: false,
    stickToBottom: true,
    hasNewWhileAway: false,
  };

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function maskName(name) {
    const s = String(name || '').trim();
    if (!s) return 'X***X';
    return `${s[0]}***${s[s.length - 1]}`;
  }

  function chatUsernameColor() {
    // Match reference: all usernames use game green
    return '#51B579';
  }

  function formatChatTime(ts) {
    const d = new Date(ts || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toFixed(2);
  }

  /** Local avatars — same file always maps to the same user id/name. */
  const CHAT_AVATARS = [
    'av-3', 'av-5', 'av-6', 'av-8', 'av-9', 'av-10',
    'av-11', 'av-12', 'av-13', 'av-14', 'av-15',
  ];

  function avatarUrl(name) {
    const s = String(name || 'player');
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % CHAT_AVATARS.length;
    return `/assets/avatars/${CHAT_AVATARS[idx]}.png`;
  }

  function chatMessageLiked(msg) {
    return state.likedIds.has(msg.id) || !!msg.liked;
  }

  function chatViewerId() {
    return state.userId || (typeof _user_id !== 'undefined' ? _user_id : null);
  }

  function formatRainLeft(expiresAt) {
    const left = Math.max(0, Number(expiresAt) - Date.now());
    if (left <= 0) return 'Expired';
    const sec = Math.ceil(left / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')} left`;
  }

  function isHouseRain(msg, meta) {
    const m = meta || msg.meta || {};
    return Boolean(m.house) || String(m.senderId || msg.userId || '') === '__house__';
  }

  function rainDisplayName(msg, meta) {
    if (isHouseRain(msg, meta)) return 'Admin';
    return maskName(msg.username);
  }

  function rainStatusOf(meta) {
    if (meta && meta.status) return meta.status;
    if (meta && meta.expiresAt) return 'open';
    return 'completed';
  }

  function rainClaimButtonHtml(msg, meta) {
    const viewerId = chatViewerId();
    const senderId = meta.senderId || msg.userId;
    const isSender = viewerId && String(viewerId) === String(senderId);
    const status = rainStatusOf(meta);
    const claimed = Number(meta.claimedCount) || 0;
    const players = Number(meta.playerCount) || 0;
    const pending = state.pendingClaims.has(Number(msg.id));

    if (isHouseRain(msg, meta) && isSender) {
      return '<div class="rain-claim-hint">House rain — first to claim wins a share</div>';
    }
    if (isSender) {
      return '<div class="rain-claim-hint">Your rain — first to claim wins a share</div>';
    }
    if (status === 'expired') {
      return '<button type="button" class="rain-claim-btn is-done" disabled>Expired</button>';
    }
    if (status === 'completed' || (players > 0 && claimed >= players)) {
      return '<button type="button" class="rain-claim-btn is-done" disabled>All claimed</button>';
    }
    if (meta.claimedByMe) {
      return '<button type="button" class="rain-claim-btn is-done" disabled>Claimed</button>';
    }
    if (pending) {
      return `<button type="button" class="rain-claim-btn is-pending" disabled data-message-id="${msg.id}">Claiming…</button>`;
    }
    if (status !== 'open') {
      return '<button type="button" class="rain-claim-btn is-done" disabled>Unavailable</button>';
    }
    return `<button type="button" class="rain-claim-btn" data-message-id="${msg.id}">Claim</button>`;
  }

  function chatRainHtml(msg) {
    const nameColor = chatUsernameColor(msg.username);
    const likes = msg.likes != null && msg.likes > 0 ? String(msg.likes) : '';
    const meta = msg.meta || {};
    const total = meta.totalAmount != null ? Number(meta.totalAmount) : null;
    const players = meta.playerCount != null ? Number(meta.playerCount) : 0;
    const currency = meta.currency || 'ETB';
    const per = meta.amountPerPlayer != null ? Number(meta.amountPerPlayer) : null;
    const claimed = Number(meta.claimedCount) || 0;
    const pct = players > 0 ? Math.min(100, Math.round((claimed / players) * 100)) : 0;
    const expiresAt = Number(meta.expiresAt) || 0;
    const status = rainStatusOf(meta);
    const timerText = status === 'expired' || (expiresAt > 0 && expiresAt <= Date.now())
      ? 'Expired'
      : expiresAt
        ? formatRainLeft(expiresAt)
        : '';
    const perLabel = per != null
      ? `${formatMoney(per)} ${escapeHtml(currency)} each`
      : escapeHtml(msg.text || 'Rain');
    const countLabel = players
      ? `${claimed} / ${players} claimed`
      : total != null
        ? `${formatMoney(total)} ${escapeHtml(currency)}`
        : '';
    return `<div class="user-message-wrapper">
      <div class="chat-user-avatar"><div class="chat-user-avatar-wrapper">
        <img class="avatar-img" draggable="false" src="${avatarUrl(msg.username)}" alt="">
      </div></div>
      <div class="user-message-body">
        <div class="user-message-card rain-message" data-rain-message-id="${msg.id}">
          <div class="chat-message-header">
            <span class="chat-message-header-username" style="color:${nameColor}">${rainDisplayName(msg, meta)}</span>
            <span class="chat-message-header-date">${formatChatTime(msg.createdAt)}</span>
          </div>
          <div class="rain-claim-card">
            <div class="rain-claim-head">
              <span class="rain-message-label">${isHouseRain(msg, meta) ? 'House rain' : 'Rain'}</span>
              ${timerText ? `<span class="rain-claim-timer" data-expires-at="${expiresAt}" data-message-id="${msg.id}">${timerText}</span>` : ''}
            </div>
            <div class="rain-claim-amount">${perLabel}</div>
            <div class="rain-claim-track" aria-hidden="true"><div class="rain-claim-fill" style="width:${pct}%"></div></div>
            <div class="rain-claim-count">${countLabel}</div>
            ${rainClaimButtonHtml(msg, meta)}
          </div>
        </div>
      </div>
      <div class="user-message-like btn-block">
        <div class="likes-number">${likes}</div>
        <button type="button" class="btn-like${chatMessageLiked(msg) ? ' active' : ''}" data-message-id="${msg.id}" aria-label="Like"></button>
      </div>
    </div>`;
  }

  function chatGifHtml(msg) {
    const nameColor = chatUsernameColor(msg.username);
    const likes = msg.likes != null && msg.likes > 0 ? String(msg.likes) : '';
    const url = (msg.meta && msg.meta.url) || '';
    return `<div class="user-message-wrapper">
      <div class="chat-user-avatar"><div class="chat-user-avatar-wrapper">
        <img class="avatar-img" draggable="false" src="${avatarUrl(msg.username)}" alt="">
      </div></div>
      <div class="user-message-body">
        <div class="user-message-card text-message chat-gif-message">
          <div class="chat-message-header">
            <span class="chat-message-header-username" style="color:${nameColor}">${maskName(msg.username)}</span>
            <span class="chat-message-header-date">${formatChatTime(msg.createdAt)}</span>
          </div>
          <img src="${escapeHtml(url)}" alt="GIF" draggable="false" loading="lazy" decoding="async">
        </div>
      </div>
      <div class="user-message-like btn-block">
        <div class="likes-number">${likes}</div>
        <button type="button" class="btn-like${chatMessageLiked(msg) ? ' active' : ''}" data-message-id="${msg.id}" aria-label="Like"></button>
      </div>
    </div>`;
  }

  function chatTextHtml(msg) {
    const nameColor = chatUsernameColor(msg.username);
    const likes = msg.likes != null && msg.likes > 0 ? String(msg.likes) : '';
    return `<div class="user-message-wrapper">
      <div class="chat-user-avatar"><div class="chat-user-avatar-wrapper">
        <img class="avatar-img" draggable="false" src="${avatarUrl(msg.username)}" alt="">
      </div></div>
      <div class="user-message-body">
        <div class="user-message-card text-message">
          <div class="chat-message-header">
            <span class="chat-message-header-username" style="color:${nameColor}">${maskName(msg.username)}</span>
            <span class="chat-message-header-date">${formatChatTime(msg.createdAt)}</span>
          </div>
          <div class="message">${escapeHtml(msg.text)}</div>
        </div>
      </div>
      <div class="user-message-like btn-block">
        <div class="likes-number">${likes}</div>
        <button type="button" class="btn-like${chatMessageLiked(msg) ? ' active' : ''}" data-message-id="${msg.id}" aria-label="Like"></button>
      </div>
    </div>`;
  }

  function chatMessageHtml(msg) {
    if (msg.type === 'rain' || msg.kind === 'rain') return chatRainHtml(msg);
    if (msg.type === 'gif' || msg.kind === 'gif') return chatGifHtml(msg);
    return chatTextHtml(msg);
  }

  function updateOnlineCount() {
    const countEl = el('chatOnlineCount');
    if (countEl) {
      countEl.textContent = String(Number(state.online) || 0);
    }
  }

  function getChatScrollHost() {
    return el('chatMessagesScroll') || el('chatMessagesList')?.closest('.chat-messages-list') || null;
  }

  function isChatNearBottom(host) {
    if (!host) return true;
    if (host.scrollHeight > host.clientHeight + 8) {
      return host.scrollHeight - host.scrollTop - host.clientHeight <= SCROLL_BOTTOM_PX;
    }
    // Fallback when CDN layout prevents the list from scrolling itself.
    const last = el('chatMessagesList')?.lastElementChild;
    const panel = document.querySelector('.keno-chat-panel .app-chat-messages-list')
      || document.querySelector('.keno-chat-panel');
    if (!last || !panel) return true;
    const lr = last.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    return lr.bottom <= pr.bottom + SCROLL_BOTTOM_PX;
  }

  function positionJumpLatestButton() {
    const btn = el('chatJumpLatestBtn');
    if (!btn || btn.hidden) return;
    const panel = document.querySelector('.keno-chat-panel') || el('kenoChatOverlay');
    const input = document.querySelector('.keno-chat-panel .chat-input-host') || el('chatInput')?.closest('.chat-input-host');
    if (!panel) return;
    const pr = panel.getBoundingClientRect();
    const ir = input ? input.getBoundingClientRect() : null;
    const centerX = pr.left + pr.width / 2;
    const gapAboveInput = 12;
    const bottom = ir
      ? Math.max(12, window.innerHeight - ir.top + gapAboveInput)
      : Math.max(12, window.innerHeight - pr.bottom + gapAboveInput);
    btn.style.left = `${Math.round(centerX)}px`;
    btn.style.bottom = `${Math.round(bottom)}px`;
    btn.style.top = 'auto';
    btn.style.transform = 'translateX(-50%)';
  }

  function updateJumpLatestButton() {
    const btn = el('chatJumpLatestBtn');
    const label = el('chatJumpLatestLabel');
    if (!btn) return;
    const show = !state.stickToBottom;
    const text = state.hasNewWhileAway ? 'New message' : 'Latest messages';
    btn.hidden = !show;
    btn.setAttribute('aria-label', text);
    if (label) {
      label.textContent = text;
      label.hidden = false;
      label.removeAttribute('hidden');
      label.style.fontSize = '13px';
      label.style.display = 'inline-block';
      label.style.color = '#fff';
    }
    btn.classList.toggle('is-new', Boolean(state.hasNewWhileAway));
    if (show) positionJumpLatestButton();
  }

  function scrollChatToBottom() {
    const host = getChatScrollHost();
    if (!host) return;
    host.scrollTop = host.scrollHeight;
    state.stickToBottom = true;
    state.hasNewWhileAway = false;
    updateJumpLatestButton();
  }

  function onChatScroll() {
    const host = getChatScrollHost();
    if (!host) return;
    const nearBottom = isChatNearBottom(host);
    state.stickToBottom = nearBottom;
    if (nearBottom) state.hasNewWhileAway = false;
    updateJumpLatestButton();
  }

  function renderChat(opts) {
    const options = opts || {};
    const list = el('chatMessagesList');
    if (!list) return;
    const host = getChatScrollHost();
    const prevTop = host ? host.scrollTop : 0;
    list.innerHTML = state.messages.map((m) => chatMessageHtml(m)).join('');
    if (options.forceBottom || state.stickToBottom) {
      if (host) host.scrollTop = host.scrollHeight;
      state.stickToBottom = true;
      if (options.fromNewMessage) state.hasNewWhileAway = false;
    } else {
      if (host) host.scrollTop = prevTop;
      if (options.fromNewMessage) state.hasNewWhileAway = true;
    }
    updateJumpLatestButton();
    updateOnlineCount();
  }

  function updateChatCharCount() {
    const input = el('chatInput');
    const countEl = el('chatCharCount');
    const sendBtn = el('chatSendBtn');
    if (!input) return;
    const left = CHAT_MAX_LEN - input.value.length;
    if (countEl) countEl.textContent = String(Math.max(0, left));
    if (sendBtn) sendBtn.disabled = !input.value.trim();
  }

  function parseSpinnerValue(raw, opts) {
    const n = opts.decimals ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return opts.min;
    return Math.min(opts.max, Math.max(opts.min, n));
  }

  function applyRainLimits(limits) {
    if (!limits || typeof limits !== 'object') return;
    if (Number.isFinite(Number(limits.amountMin))) RAIN_AMOUNT_MIN = Number(limits.amountMin);
    if (Number.isFinite(Number(limits.amountMax))) RAIN_AMOUNT_MAX = Number(limits.amountMax);
    if (Number.isFinite(Number(limits.playersMin))) RAIN_PLAYERS_MIN = Number(limits.playersMin);
    if (Number.isFinite(Number(limits.playersMax))) RAIN_PLAYERS_MAX = Number(limits.playersMax);
    if (Number.isFinite(Number(limits.chatMaxLen))) CHAT_MAX_LEN = Number(limits.chatMaxLen);
    const amountEl = el('chatRainAmount');
    const playersEl = el('chatRainPlayers');
    const input = el('chatInput');
    if (amountEl) {
      amountEl.min = String(RAIN_AMOUNT_MIN);
      amountEl.max = String(RAIN_AMOUNT_MAX);
    }
    if (playersEl) {
      playersEl.min = String(RAIN_PLAYERS_MIN);
      playersEl.max = String(RAIN_PLAYERS_MAX);
    }
    if (input) input.maxLength = CHAT_MAX_LEN;
  }

  function updateRainTotal() {
    const amountEl = el('chatRainAmount');
    const playersEl = el('chatRainPlayers');
    const totalEl = el('chatRainTotal');
    if (!amountEl || !playersEl || !totalEl) return null;
    const amount = parseSpinnerValue(amountEl.value, {
      min: RAIN_AMOUNT_MIN,
      max: RAIN_AMOUNT_MAX,
      decimals: 2,
    });
    const players = parseSpinnerValue(playersEl.value, {
      min: RAIN_PLAYERS_MIN,
      max: RAIN_PLAYERS_MAX,
      decimals: 0,
    });
    amountEl.value = amount.toFixed(2);
    playersEl.value = String(players);
    const total = Math.round(amount * players * 100) / 100;
    totalEl.textContent = total.toFixed(2);
    return { amount, players, total };
  }

  function showChatToast(text) {
    const box = document.getElementById('socket_status_text');
    const wrap = document.getElementById('socket_status');
    if (box && wrap) {
      box.textContent = text;
      wrap.style.display = 'block';
      setTimeout(() => { wrap.style.display = 'none'; }, 2800);
      return;
    }
    if (typeof ShowWarning === 'function') {
      ShowWarning(text, true);
      return;
    }
    console.info(text);
  }

  function syncHeaderCredit(credit) {
    if (credit == null || !Number.isFinite(Number(credit))) return;
    const value = Number(credit);
    if (typeof global._credit !== 'undefined') global._credit = value;
    const header = document.querySelector('.header_credit');
    if (!header) return;
    const currency = typeof global._currency !== 'undefined' ? global._currency : '';
    if (typeof global.formatMoney === 'function') {
      header.innerHTML = `${global.formatMoney(value)} ${currency}`.trim();
    } else if (typeof formatMoney === 'function') {
      header.innerHTML = `${formatMoney(value)} ${currency}`.trim();
    } else {
      header.textContent = `${value} ${currency}`.trim();
    }
  }

  function setChatActiveTool(tool) {
    const next = state.activeTool === tool ? null : tool;
    state.activeTool = next;
    const emojiPanel = el('chatEmojiPanel');
    const gifPanel = el('chatGifPanel');
    const rainPanel = el('chatRainPanel');
    const backBtn = el('chatToolBackBtn');
    const backDiv = el('chatToolBackDivider');
    const sendBtn = el('chatSendBtn');
    const sendRainBtn = el('chatSendRainBtn');
    const emojiBtn = el('chatEmojiBtn');
    const gifBtn = el('chatGifBtn');
    const rainBtn = el('chatRainBtn');

    emojiBtn?.classList.toggle('active', next === 'emoji');
    gifBtn?.classList.toggle('active', next === 'gif');
    rainBtn?.classList.toggle('active', next === 'rain');
    emojiPanel?.toggleAttribute('hidden', next !== 'emoji');
    gifPanel?.toggleAttribute('hidden', next !== 'gif');
    rainPanel?.toggleAttribute('hidden', next !== 'rain');
    backBtn?.toggleAttribute('hidden', !next);
    backDiv?.toggleAttribute('hidden', !next);
    if (sendBtn) sendBtn.hidden = next === 'rain';
    // Send Rain lives inside the rain panel; visibility follows the panel
    if (sendRainBtn) sendRainBtn.hidden = false;
    if (next === 'emoji') buildEmojiPanel();
    if (next === 'gif') buildGifPanel();
    if (next === 'rain') updateRainTotal();
  }

  function closeChatTool() {
    state.activeTool = null;
    el('chatEmojiPanel')?.setAttribute('hidden', '');
    el('chatGifPanel')?.setAttribute('hidden', '');
    el('chatRainPanel')?.setAttribute('hidden', '');
    el('chatToolBackBtn')?.setAttribute('hidden', '');
    el('chatToolBackDivider')?.setAttribute('hidden', '');
    el('chatEmojiBtn')?.classList.remove('active');
    el('chatGifBtn')?.classList.remove('active');
    el('chatRainBtn')?.classList.remove('active');
    const sendBtn = el('chatSendBtn');
    if (sendBtn) sendBtn.hidden = false;
  }

  function emojiCodeHint(emoji) {
    const map = {
      '😀': 'smile', '😂': 'laugh', '😍': 'love', '🔥': 'fire', '💰': 'money',
      '✈️': 'plane', '🚀': 'rocket', '🌧': 'rain', '❤️': 'heart', '👍': 'like',
    };
    return map[emoji] || '';
  }

  function buildEmojiPanel() {
    const list = el('chatEmojiList');
    const search = el('chatEmojiSearch');
    if (!list) return;
    const q = (search?.value || '').trim().toLowerCase();
    const items = q
      ? CHAT_EMOJIS.filter((emoji) => emojiCodeHint(emoji).includes(q) || emoji.includes(q))
      : CHAT_EMOJIS;
    list.innerHTML = `<div class="emoji-group">${items.map((emoji) =>
      `<span class="emoji-item" role="button" tabindex="0" data-emoji="${emoji}">${emoji}</span>`
    ).join('')}</div>`;
  }

  function buildGifPanel() {
    const grid = el('chatGifGrid');
    if (!grid) return;
    grid.innerHTML = CHAT_GIFS.map((g) =>
      `<button type="button" class="chat-gif-item" data-gif-url="${escapeHtml(g.url)}" aria-label="${escapeHtml(g.label)}">
        <img src="${escapeHtml(g.url)}" alt="${escapeHtml(g.label)}" draggable="false" loading="lazy" decoding="async">
      </button>`
    ).join('');
  }

  function sendChatText() {
    const input = el('chatInput');
    const text = input?.value.trim();
    if (!text || typeof Socket_SendEvent !== 'function') return;
    state.stickToBottom = true;
    state.hasNewWhileAway = false;
    Socket_SendEvent({ status: 'chat_message', text });
    if (input) {
      input.value = '';
      input.style.height = '';
      updateChatCharCount();
    }
  }

  function sendRain() {
    const rain = updateRainTotal();
    if (!rain || typeof Socket_SendEvent !== 'function') return;
    state.stickToBottom = true;
    state.hasNewWhileAway = false;
    Socket_SendEvent({
      status: 'chat_rain',
      amount: rain.amount,
      players: rain.players,
    });
    closeChatTool();
  }

  function sendGif(url) {
    if (!url || typeof Socket_SendEvent !== 'function') return;
    state.stickToBottom = true;
    state.hasNewWhileAway = false;
    Socket_SendEvent({ status: 'chat_gif', url });
    closeChatTool();
  }

  function toggleLike(messageId) {
    if (!messageId || typeof Socket_SendEvent !== 'function') return;
    Socket_SendEvent({ status: 'chat_react', messageId });
  }

  function onLoginSnapshot(data) {
    state.userId = typeof _user_id !== 'undefined' ? _user_id : state.userId;
    if (data.player_id || data.userId || data.id) {
      state.userId = data.player_id || data.userId || data.id || state.userId;
    }
    if (data.online != null && Number.isFinite(Number(data.online))) {
      state.online = Number(data.online);
    }
    if (data.rain_limits) applyRainLimits(data.rain_limits);
    if (Array.isArray(data.chat)) {
      state.messages = data.chat.slice();
      state.likedIds = new Set(
        data.chat.filter((m) => m.liked).map((m) => m.id),
      );
    }
    renderChat({ forceBottom: true });
  }

  function onRoomChat(data) {
    // Online = connected players only. Ignore wait/newgame payloads so the
    // badge never resets or climbs with mock ticket / bet counters each round.
    if (data.status === 'online' && data.online != null && Number.isFinite(Number(data.online))) {
      state.online = Number(data.online);
      updateOnlineCount();
    }
    if (data.status === 'chat' && data.message) {
      state.messages.push(data.message);
      if (state.messages.length > 100) state.messages.shift();
      renderChat({ fromNewMessage: true });
      return;
    }
    if (data.status === 'chat_reaction') {
      const msg = state.messages.find((m) => Number(m.id) === Number(data.messageId));
      if (msg) {
        msg.likes = data.likes;
        if (data.userId === state.userId || data.userId === (typeof _user_id !== 'undefined' ? _user_id : null)) {
          if (data.liked) state.likedIds.add(msg.id);
          else state.likedIds.delete(msg.id);
          msg.liked = data.liked;
        }
        renderChat();
      }
    }
    if (data.status === 'chat_rain_update') {
      applyRainUpdate(data);
    }
  }

  function applyRainUpdate(data) {
    const msg = state.messages.find((m) => Number(m.id) === Number(data.messageId));
    if (!msg) return;
    msg.meta = {
      ...(msg.meta || {}),
      claimedCount: data.claimedCount != null ? Number(data.claimedCount) : (msg.meta && msg.meta.claimedCount),
      playerCount: data.playerCount != null ? Number(data.playerCount) : (msg.meta && msg.meta.playerCount),
      status: data.status || (msg.meta && msg.meta.status),
      expiresAt: data.expiresAt != null ? Number(data.expiresAt) : (msg.meta && msg.meta.expiresAt),
    };
    if (msg.meta.status !== 'open') state.pendingClaims.delete(Number(msg.id));
    const card = document.querySelector(`[data-rain-message-id="${msg.id}"]`);
    const wrap = card && card.closest('.user-message-wrapper');
    if (wrap) {
      wrap.outerHTML = chatRainHtml(msg);
      return;
    }
    renderChat();
  }

  function onMyChatEvent(data) {
    if (data.status === 'chat_error') {
      if (data.code && String(data.code).startsWith('RAIN_')) {
        state.pendingClaims.clear();
        renderChat();
      }
      const text = data.message || 'Chat error';
      const box = document.getElementById('socket_status_text');
      const wrap = document.getElementById('socket_status');
      if (box && wrap) {
        box.textContent = text;
        wrap.style.display = 'block';
        setTimeout(() => { wrap.style.display = 'none'; }, 2500);
      } else {
        alert(text);
      }
      return;
    }
    if (data.status === 'balance' && data.credit != null) {
      syncHeaderCredit(data.credit);
      return;
    }
    if (data.status === 'rain_received' || data.status === 'rain_claimed') {
      const amt = Number(data.amount);
      const cur = data.currency || (typeof global._currency !== 'undefined' ? global._currency : '');
      const asFreeBet = data.kind === 'free_bet' || Array.isArray(data.free_bets);
      const label = Number.isFinite(amt)
        ? (asFreeBet
          ? `Rain claimed: +${amt.toFixed(2)} ${cur} free bet`.trim()
          : `Rain received: +${amt.toFixed(2)} ${cur}`.trim())
        : (asFreeBet ? 'Rain claimed: free bet' : 'Rain received');
      showChatToast(label);
    }
    if (data.status === 'rain_claimed') {
      const msg = state.messages.find((m) => Number(m.id) === Number(data.messageId));
      state.pendingClaims.delete(Number(data.messageId));
      if (msg) {
        msg.meta = { ...(msg.meta || {}), claimedByMe: true };
        applyRainUpdate({ messageId: data.messageId, ...(msg.meta || {}) });
      }
    }
  }

  function claimRain(messageId) {
    if (!messageId || typeof Socket_SendEvent !== 'function') return;
    state.pendingClaims.add(Number(messageId));
    const msg = state.messages.find((m) => Number(m.id) === Number(messageId));
    if (msg) applyRainUpdate({ messageId, ...(msg.meta || {}) });
    Socket_SendEvent({ status: 'chat_rain_claim', messageId });
  }

  function openMobileChat() {
    const overlay = el('kenoChatOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    renderChat({ forceBottom: true });
    requestAnimationFrame(() => el('chatInput')?.focus());
  }

  function closeMobileChat() {
    const overlay = el('kenoChatOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    closeChatTool();
  }

  function setupDesktopTabsDragScroll() {
    const strip = document.querySelector('.content_left_side .left_side_tabs_top.tabs');
    if (!strip || strip.dataset.dragScrollBound === '1') return;
    strip.dataset.dragScrollBound = '1';

    const DRAG_THRESHOLD = 8;
    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let pointerId = null;

    const endTrack = (e) => {
      if (!tracking) return;
      const wasDragging = dragging;
      tracking = false;
      dragging = false;
      strip.classList.remove('is-dragging');
      if (pointerId != null) {
        try { strip.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        pointerId = null;
      }
      // Only block the synthetic click after a real drag
      if (wasDragging) {
        const suppress = (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          strip.removeEventListener('click', suppress, true);
        };
        strip.addEventListener('click', suppress, true);
        setTimeout(() => strip.removeEventListener('click', suppress, true), 0);
      }
    };

    strip.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button != null && e.button !== 0) return;
      tracking = true;
      dragging = false;
      startX = e.clientX;
      startScroll = strip.scrollLeft;
      pointerId = e.pointerId;
    });

    strip.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        dragging = true;
        strip.classList.add('is-dragging');
        try { strip.setPointerCapture(pointerId); } catch (_) { /* ignore */ }
      }
      strip.scrollLeft = startScroll - dx;
      e.preventDefault();
    });

    strip.addEventListener('pointerup', endTrack);
    strip.addEventListener('pointercancel', endTrack);
    strip.addEventListener('dragstart', (e) => e.preventDefault());
  }

  function setupChat() {
    if (state.ready) return;
    if (!el('chatMessagesList')) return;
    state.ready = true;
    state.userId = typeof _user_id !== 'undefined' ? _user_id : null;

    if (global.__kenoPendingLogin) {
      const pending = global.__kenoPendingLogin;
      global.__kenoPendingLogin = null;
      onLoginSnapshot(pending);
    }

    buildEmojiPanel();
    setupDesktopTabsDragScroll();

    el('kenoChatToggleBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMobileChat();
    });
    el('chatCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMobileChat();
    });

    const closeRulesModal = () => {
      const modal = el('chatRulesModal');
      if (modal) modal.hidden = true;
    };
    el('chatRulesBtn')?.addEventListener('click', () => {
      const modal = el('chatRulesModal');
      if (modal) modal.hidden = false;
    });
    el('chatRulesCloseBtn')?.addEventListener('click', closeRulesModal);
    el('chatRulesHeaderCloseBtn')?.addEventListener('click', closeRulesModal);
    el('chatRulesModal')?.addEventListener('click', (e) => {
      if (e.target === el('chatRulesModal')) closeRulesModal();
    });

    el('chatEmojiBtn')?.addEventListener('click', () => setChatActiveTool('emoji'));
    el('chatGifBtn')?.addEventListener('click', () => setChatActiveTool('gif'));
    el('chatRainBtn')?.addEventListener('click', () => setChatActiveTool('rain'));
    el('chatToolBackBtn')?.addEventListener('click', () => closeChatTool());

    const bindSpinner = (inputEl, minusBtn, plusBtn, opts) => {
      const sync = () => {
        if (!inputEl) return;
        inputEl.value = opts.decimals
          ? parseSpinnerValue(inputEl.value, opts).toFixed(2)
          : String(parseSpinnerValue(inputEl.value, opts));
        updateRainTotal();
      };
      minusBtn?.addEventListener('click', () => {
        if (!inputEl) return;
        const step = opts.decimals ? 0.1 : 1;
        inputEl.value = opts.decimals
          ? Math.max(opts.min, parseSpinnerValue(inputEl.value, opts) - step).toFixed(2)
          : String(Math.max(opts.min, parseSpinnerValue(inputEl.value, opts) - step));
        updateRainTotal();
      });
      plusBtn?.addEventListener('click', () => {
        if (!inputEl) return;
        const step = opts.decimals ? 0.1 : 1;
        inputEl.value = opts.decimals
          ? Math.min(opts.max, parseSpinnerValue(inputEl.value, opts) + step).toFixed(2)
          : String(Math.min(opts.max, parseSpinnerValue(inputEl.value, opts) + step));
        updateRainTotal();
      });
      inputEl?.addEventListener('change', sync);
      inputEl?.addEventListener('blur', sync);
    };

    bindSpinner(el('chatRainAmount'), el('chatRainAmountMinus'), el('chatRainAmountPlus'), {
      min: 0.01, max: 9999, decimals: 2,
    });
    bindSpinner(el('chatRainPlayers'), el('chatRainPlayersMinus'), el('chatRainPlayersPlus'), {
      min: 1, max: 100, decimals: 0,
    });

    el('chatSendBtn')?.addEventListener('click', sendChatText);
    el('chatSendRainBtn')?.addEventListener('click', sendRain);

    const input = el('chatInput');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatText();
      }
    });
    input?.addEventListener('input', () => {
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 105)}px`;
      updateChatCharCount();
    });

    el('chatEmojiSearch')?.addEventListener('input', buildEmojiPanel);
    el('chatEmojiList')?.addEventListener('click', (e) => {
      const item = e.target.closest('.emoji-item');
      if (!item || !input) return;
      const emoji = item.dataset.emoji || '';
      input.value = `${input.value}${emoji}`.slice(0, CHAT_MAX_LEN);
      updateChatCharCount();
    });

    el('chatGifGrid')?.addEventListener('click', (e) => {
      const item = e.target.closest('.chat-gif-item');
      if (!item) return;
      sendGif(item.dataset.gifUrl);
    });

    el('chatMessagesList')?.addEventListener('click', (e) => {
      const claimBtn = e.target.closest('.rain-claim-btn');
      if (claimBtn && !claimBtn.disabled) {
        const claimId = Number(claimBtn.dataset.messageId);
        if (claimId) claimRain(claimId);
        return;
      }
      const likeBtn = e.target.closest('.btn-like');
      if (!likeBtn) return;
      const messageId = Number(likeBtn.dataset.messageId);
      if (messageId) toggleLike(messageId);
    });

    const jumpBtn = el('chatJumpLatestBtn');
    if (jumpBtn && jumpBtn.parentElement !== document.body) {
      document.body.appendChild(jumpBtn);
    }
    getChatScrollHost()?.addEventListener('scroll', onChatScroll, { passive: true });
    // Page/container may scroll when chat column height is unconstrained by CDN layout.
    window.addEventListener('scroll', onChatScroll, { passive: true, capture: true });
    window.addEventListener('resize', () => {
      positionJumpLatestButton();
      onChatScroll();
    }, { passive: true });
    jumpBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      scrollChatToBottom();
    });

    const currencyEl = el('chatRainCurrency');
    if (currencyEl) {
      const raw = (typeof _currency !== 'undefined' ? String(_currency) : 'ETB')
        .replace(/<[^>]*>/g, '')
        .trim();
      currencyEl.textContent = raw || 'ETB';
    }

    updateChatCharCount();
    updateRainTotal();
    renderChat({ forceBottom: true });
    if (!state.rainTimerIv) {
      state.rainTimerIv = setInterval(tickRainTimers, 1000);
    }
  }

  function tickRainTimers() {
    const timers = document.querySelectorAll('.rain-claim-timer[data-expires-at]');
    timers.forEach((node) => {
      const expires = Number(node.dataset.expiresAt);
      if (!Number.isFinite(expires) || expires <= 0) return;
      if (expires <= Date.now()) {
        node.textContent = 'Expired';
        const mid = Number(node.dataset.messageId);
        const msg = state.messages.find((m) => Number(m.id) === mid);
        if (msg && msg.meta && msg.meta.status === 'open') {
          msg.meta.status = 'expired';
          applyRainUpdate({ messageId: mid, ...msg.meta });
        }
        return;
      }
      node.textContent = formatRainLeft(expires);
    });
  }

  global.KenoChat = {
    setup: setupChat,
    onLoginSnapshot,
    onRoomEvent: onRoomChat,
    onMyEvent: onMyChatEvent,
    render: renderChat,
    open: openMobileChat,
    close: closeMobileChat,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupChat);
  } else {
    setupChat();
  }
})(typeof window !== 'undefined' ? window : globalThis);
