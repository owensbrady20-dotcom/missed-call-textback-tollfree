(function () {
  const TOKEN_KEY = 'tollFreeTextBackAdminToken';
  const PAGE_SIZE = 25;
  let currentSkip = 0;
  let currentSearch = '';
  let searchDebounce = null;

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function api(path, options = {}) {
    const res = await fetch(`/admin${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      clearToken();
      showGate();
      throw new Error('Unauthorized');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status})`);
    return body;
  }

  function showGate() {
    document.getElementById('tokenGate').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
  }

  function showApp() {
    document.getElementById('tokenGate').style.display = 'none';
    document.getElementById('appShell').style.display = 'grid';
    loadBusinesses();
  }

  document.getElementById('tokenSaveBtn').addEventListener('click', async () => {
    const value = document.getElementById('tokenInput').value.trim();
    if (!value) return;
    setToken(value);
    try {
      await api('/businesses');
      document.getElementById('error').textContent = '';
      showApp();
    } catch (err) {
      document.getElementById('error').textContent = 'Invalid token.';
      clearToken();
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    showGate();
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentSkip = 0;
      loadBusinesses();
    }, 250);
  });

  document.getElementById('prevPageBtn').addEventListener('click', () => {
    currentSkip = Math.max(0, currentSkip - PAGE_SIZE);
    loadBusinesses();
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentSkip += PAGE_SIZE;
    loadBusinesses();
  });

  document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!payload.ownerNotifyNumber) delete payload.ownerNotifyNumber;
    try {
      await api('/businesses', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      document.getElementById('createError').textContent = '';
      currentSkip = 0;
      loadBusinesses();
    } catch (err) {
      document.getElementById('createError').textContent = err.message;
    }
  });

  async function loadBusinesses() {
    const params = new URLSearchParams({ take: PAGE_SIZE, skip: currentSkip });
    if (currentSearch) params.set('search', currentSearch);

    const { items, total } = await api(`/businesses?${params.toString()}`);
    document.getElementById('businessCount').textContent = total;

    const tbody = document.getElementById('businessTableBody');
    tbody.innerHTML = '';
    items.forEach((b) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(b.name)}</td>
        <td>${escapeHtml(b.twilioNumber)}</td>
        <td>${b.forwardingNumber ? escapeHtml(b.forwardingNumber) : '<span class="muted">none — texts back immediately</span>'}</td>
        <td><span class="pill ${b.active ? 'yes' : 'no'}">${b.active ? 'active' : 'inactive'}</span></td>
        <td class="row">
          <a class="link" data-action="logs" data-id="${b.id}" data-name="${escapeHtml(b.name)}">logs</a>
          <a class="link" data-action="toggle" data-id="${b.id}" data-active="${b.active}">${b.active ? 'deactivate' : 'activate'}</a>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-action="logs"]').forEach((el) => {
      el.addEventListener('click', () => loadCallLog(el.dataset.id, el.dataset.name));
    });
    tbody.querySelectorAll('[data-action="toggle"]').forEach((el) => {
      el.addEventListener('click', async () => {
        await api(`/businesses/${el.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active: el.dataset.active !== 'true' }),
        });
        loadBusinesses();
      });
    });

    const pageStart = total === 0 ? 0 : currentSkip + 1;
    const pageEnd = Math.min(currentSkip + PAGE_SIZE, total);
    document.getElementById('pageInfo').textContent = `${pageStart}–${pageEnd} of ${total}`;
    document.getElementById('prevPageBtn').disabled = currentSkip === 0;
    document.getElementById('nextPageBtn').disabled = currentSkip + PAGE_SIZE >= total;
  }

  async function loadCallLog(businessId, name) {
    const calls = await api(`/businesses/${businessId}/calls`);
    const callLogNavLink = document.getElementById('callLogNavLink');
    callLogNavLink.style.display = 'block';
    document.getElementById('calllog').style.display = 'block';
    document.getElementById('callLogTitle').textContent = `Call log — ${name}`;
    document.getElementById('calllog').scrollIntoView({ behavior: 'smooth', block: 'start' });

    const tbody = document.getElementById('callLogTableBody');
    tbody.innerHTML = '';
    calls.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(c.createdAt).toLocaleString()}</td>
        <td>${escapeHtml(c.callerNumber)}</td>
        <td>${escapeHtml(c.dialOutcome || '')}</td>
        <td><span class="pill ${c.textSent ? 'yes' : 'no'}">${c.textSent ? 'sent' : (c.smsSkipReason || 'no')}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  if (getToken()) {
    api('/businesses').then(showApp).catch(showGate);
  } else {
    showGate();
  }
})();
