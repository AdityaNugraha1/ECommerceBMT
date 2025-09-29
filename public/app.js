(() => {
  const $ = id => document.getElementById(id);
  const msgEl = $('message');
  function msg(t, type='info') {
    msgEl.textContent = t;
    msgEl.className = `alert ${type==='error'?'alert-danger':'alert-success'}`;
    msgEl.classList.remove('d-none');
    setTimeout(()=> msgEl.classList.add('d-none'), 3000);
  }

  const tokenKey = 'jwt_token';
  const userKey = 'user_data';
  function setAuth(token, user) {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
    try { updateAfterAuth(); } catch(e) { renderNav(); }
  }
  function clearAuth() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    try { updateAfterAuth(); } catch(e) { renderNav(); }
  }
  function getToken() { return localStorage.getItem(tokenKey); }
  function getUser() { try { return JSON.parse(localStorage.getItem(userKey)); } catch(e){return null} }

  const sections = ['home','auth','cart','history','admin'];
  function showSection(name) {
    sections.forEach(s => {
      const el = document.getElementById(s + '-section');
      if (el) el.classList.toggle('active', s===name);
    });
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
    if (name === 'home') loadProducts(currentPage);
    if (name === 'cart') loadCart();
    if (name === 'history') loadHistory();
    if (name === 'admin') {
      if (typeof loadAdminProducts === 'function') {
        loadAdminProducts();
      } else {
        console.warn('loadAdminProducts not defined yet');
      }
    }
  }

  document.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault(); showSection(a.dataset.nav);
  }));

  function renderNav() {
    const user = getUser();
    if (user) {
      $('nav-guest').classList.add('d-none');
      const nu = $('nav-user'); nu.classList.remove('d-none');
      $('nav-welcome').textContent = `Hi, ${user.name || user.email}`;
    } else {
      $('nav-guest').classList.remove('d-none');
      $('nav-user').classList.add('d-none');
    }
  }
  $('logoutBtn').addEventListener('click', () => { clearAuth(); msg('Logged out'); showSection('home'); });

  async function api(path, opts={}) {
    const headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    opts.headers = headers;
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    const res = await fetch(path, opts);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch(e) { data = { error: 'Invalid JSON' }; }
    if (!res.ok) throw data;
    return data;
  }

  $('loginBtn').addEventListener('click', async () => {
    const email = $('email').value.trim(); const password = $('password').value;
    try {
      const r = await api('/auth/login', { method:'POST', body:{ email, password }});
      setAuth(r.token, r.user); msg('Logged in'); showSection('home');
    } catch(e) { msg(e.error || 'Login failed', 'error'); }
  });
  $('showRegisterBtn').addEventListener('click', async () => {
    const email = $('email').value.trim(); const password = $('password').value; const name = email.split('@')[0]||'User';
    try {
      const r = await api('/auth/register', { method:'POST', body:{ name, email, password }});
      setAuth(r.token, r.user); msg('Registered'); showSection('home');
    } catch(e) { msg(e.error || 'Register failed', 'error'); }
  });
  $('backHomeAuth').addEventListener('click', ()=> showSection('home'));

  let currentPage = 1, totalPages = 1, pageLimit = Number($('limitSelect') ? $('limitSelect').value : 6);
  $('limitSelect')?.addEventListener('change', (e) => { pageLimit = Number(e.target.value); loadProducts(1); });

  function isAdmin() {
    const u = getUser();
    return u && (u.is_admin === 1 || u.is_admin === true);
  }

  async function loadProducts(page = 1) {
    try {
      const res = await api(`/products?page=${page}&limit=${pageLimit}`);
      const products = res.items || [];
      currentPage = res.page || 1;
      totalPages = res.totalPages || 1;
      el('pageInfo').textContent = `Page ${currentPage}/${totalPages}`;

      const wrap = el('products');
      wrap.innerHTML = '';
      const admin = isAdmin();

      products.forEach(p => {
        const col = document.createElement('div'); col.className = 'col-md-4';
        if (admin) {
          col.innerHTML = `
            <div class="card h-100">
              <img src="${p.image || '/images/placeholder.jpg'}" class="card-img-top product-img" alt="${p.name}"
                   onerror="this.onerror=null;this.src='/images/placeholder.jpg';" />
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">${p.name}</h5>
                <p class="card-text text-muted small mb-1">${p.description || ''}</p>
                <div class="mt-auto d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary w-50 edit-card" data-id="${p.id}">Edit</button>
                  <button class="btn btn-sm btn-outline-danger w-50 del-card" data-id="${p.id}">Delete</button>
                </div>
              </div>
            </div>`;
        } else {
          col.innerHTML = `
            <div class="card h-100">
              <img src="${p.image || '/images/placeholder.jpg'}" class="card-img-top product-img" alt="${p.name}"
                   onerror="this.onerror=null;this.src='/images/placeholder.jpg';" />
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">${p.name}</h5>
                <p class="card-text text-muted small mb-1">${p.description || ''}</p>
                <div class="mt-auto">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="card-price">Rp ${p.price}</div>
                    <div class="text-muted small">Stock: ${p.stock}</div>
                  </div>
                  <div class="d-flex gap-2">
                    <input type="number" min="1" value="1" id="q-${p.id}" class="form-control form-control-sm" style="width:90px"/>
                    <button class="btn btn-sm btn-primary w-100 addBtn" data-id="${p.id}">Add to cart</button>
                  </div>
                </div>
              </div>
            </div>`;
        }
        wrap.appendChild(col);
      });

      if (!admin) {
        document.querySelectorAll('.addBtn').forEach(b => b.addEventListener('click', async (ev) => {
          const id = ev.target.dataset.id;
          const q = parseInt(el('q-'+id).value, 10) || 1;
          try {
            await api('/cart/add', { method: 'POST', body: { product_id: Number(id), quantity: Number(q) }});
            msg('Added to cart');
            loadCart();
          } catch(e) { msg(e.error || 'Add failed'); }
        }));
      } else {
        document.querySelectorAll('.edit-card').forEach(b => b.addEventListener('click', (ev) => {
          const id = ev.target.dataset.id;
          api(`/admin/products`, { method: 'GET' }).then(r => {
            const p = (r.items || []).find(x => String(x.id) === String(id));
            if (!p) { msg('Product not found','error'); return; }
            $('adm-name').value = p.name;
            $('adm-price').value = p.price;
            $('adm-stock').value = p.stock;
            $('adm-desc').value = p.description || '';
            $('adm-save').dataset.editId = id;
            $('admin-form').style.display = 'block';
            showSection('admin');
          }).catch(() => msg('Failed loading product','error'));
        }));
        document.querySelectorAll('.del-card').forEach(b => b.addEventListener('click', async (ev) => {
          const id = ev.target.dataset.id;
          if (!confirm('Delete this product?')) return;
          try {
            await api(`/admin/products/${id}`, { method: 'DELETE' });
            msg('Product deleted');
            loadProducts(currentPage);
            loadAdminProducts();
          } catch(e) { msg(e.error || 'Delete failed','error'); }
        }));
      }
    } catch(e) { msg(e.error || 'Failed loading products'); }
  }
  $('prevPage').addEventListener('click', (ev)=>{ ev.preventDefault(); if (currentPage>1) loadProducts(currentPage-1); });
  $('nextPage').addEventListener('click', (ev)=>{ ev.preventDefault(); if (currentPage<totalPages) loadProducts(currentPage+1); });

  async function loadCart() {
    try {
      const data = await api('/cart');
      const wrap = el('cart');
      wrap.innerHTML = '';

      if (!data.items || data.items.length === 0) {
        wrap.innerHTML = '<div class="alert alert-secondary">Cart is empty</div>';
        el('cart-total').textContent = '';
        return;
      }

      if (data.deletedCount && data.deletedCount > 0) {
        msg('Some products in your cart were removed by admin. Please remove them from cart.', 'error');
      }

      data.items.forEach(it => {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        if (it.deleted) {
          div.innerHTML = `<div class="card-body d-flex justify-content-between align-items-center">
            <div><strong>(Removed) ${it.name || 'Product removed'}</strong><div class="small text-danger">This product was deleted by admin</div></div>
            <div class="text-end">
              <button class="btn btn-sm btn-outline-danger removeBtn" data-id="${it.product_id}">Remove</button>
            </div>
          </div>`;
        } else {
          div.innerHTML = `<div class="card-body d-flex justify-content-between align-items-center">
            <div><strong>${it.name}</strong><div class="small text-muted">Rp ${it.price} x ${it.quantity}</div></div>
            <div class="text-end">
              <div>Rp ${it.subtotal}</div>
              <div class="mt-1"><button class="btn btn-sm btn-outline-danger removeBtn" data-id="${it.product_id}">Remove</button></div>
            </div>
          </div>`;
        }
        wrap.appendChild(div);
      });

      document.querySelectorAll('.removeBtn').forEach(b => b.addEventListener('click', async (ev) => {
        const pid = ev.target.dataset.id;
        if (!confirm('Remove this item from cart?')) return;
        try {
          await api('/cart/remove', { method: 'POST', body: { product_id: Number(pid) }});
          msg('Item removed from cart');
          loadCart();
        } catch (e) { msg(e.error || 'Remove failed', 'error'); }
      }));

      el('cart-total').textContent = `Total: Rp ${data.total || 0}`;
    } catch (e) {
      const errMsg = (e && e.error) ? String(e.error).toLowerCase() : '';
      if (errMsg.includes('unauthor') || errMsg.includes('invalid token') || errMsg.includes('invalid token') ) {
        el('cart').innerHTML = '<div class="alert alert-secondary">Login to see cart</div>';
        el('cart-total').textContent = '';
        return;
      }
      if (errMsg.includes('admin') || errMsg.includes('admins')) {
        el('cart').innerHTML = '<div class="alert alert-secondary">Admins have no cart</div>';
        el('cart-total').textContent = '';
        return;
      }
      console.error('loadCart error', e);
      el('cart').innerHTML = '<div class="alert alert-danger">Failed loading cart</div>';
      el('cart-total').textContent = '';
    }
  }
  $('checkoutBtn').addEventListener('click', async () => {
    try {
      const r = await api('/checkout', { method:'POST' });
      msg(`Checkout success. Transaction ${r.transaction_id}`);
      loadProducts(currentPage); loadCart();
    } catch(e) { msg(e.error || 'Checkout failed', 'error'); }
  });
  $('clearCartBtn').addEventListener('click', async () => {
    try {
      await api('/cart/clear', { method:'POST' }).catch(()=>{ throw { error:'Clear not available' }; });
      msg('Cart cleared'); loadCart();
    } catch(e) { msg(e.error || 'Clear failed', 'error'); }
  });

  async function loadHistory() {
    try {
      const r = await api('/history');
      const wrap = $('history'); wrap.innerHTML = '';
      if (!r.transactions || r.transactions.length===0) { wrap.innerHTML = '<div class="alert alert-secondary">No orders yet</div>'; return; }
      r.transactions.forEach(tx => {
        const card = document.createElement('div'); card.className='card mb-3';
        const body = document.createElement('div'); body.className='card-body';
        const header = document.createElement('h5'); header.className='card-title';
        header.textContent = `#${tx.id} — ${new Date(tx.date).toLocaleString()} — Rp ${tx.total}`;
        body.appendChild(header);
        const list = document.createElement('div');
        tx.items.forEach(it => {
          const rdiv = document.createElement('div'); rdiv.className='d-flex justify-content-between';
          rdiv.innerHTML = `<div>${it.name} x ${it.quantity}</div><div>Rp ${it.price * it.quantity}</div>`;
          list.appendChild(rdiv);
        });
        body.appendChild(list); card.appendChild(body); wrap.appendChild(card);
      });
    } catch(e) {
      $('history').innerHTML = '<div class="alert alert-secondary">Login to see orders</div>';
    }
  }

  function renderAdminNav(user) {
    const adminLink = $('nav-admin-link');
    if (user && user.is_admin) adminLink.classList.remove('d-none'); else adminLink.classList.add('d-none');

    const cartNav = document.querySelector('[data-nav="cart"]');
    const histNav = document.querySelector('[data-nav="history"]');
    if (user && user.is_admin) {
      if (cartNav) cartNav.classList.add('d-none');
      if (histNav) histNav.classList.add('d-none');
    } else {
      if (cartNav) cartNav.classList.remove('d-none');
      if (histNav) histNav.classList.remove('d-none');
    }
  }

  async function loadAdminProducts() {
    try {
      const res = await api('/admin/products');
      const wrap = $('admin-list');
      wrap.innerHTML = '';
      res.items.forEach(p => {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        div.innerHTML = `<div class="card-body d-flex align-items-center">
          <img src="${p.image || '/images/placeholder.jpg'}" class="admin-thumb" />
           <div style="flex:1">
             <div class="fw-bold">${p.name}</div>
             <div class="text-muted small">${p.description||''}</div>
             <div class="small">Price: Rp ${p.price} — Stock: ${p.stock}</div>
           </div>
           <div class="d-flex flex-column gap-2">
             <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${p.id}">Edit</button>
             <button class="btn btn-sm btn-outline-danger btn-del" data-id="${p.id}">Delete</button>
           </div>
         </div>`;
        wrap.appendChild(div);
      });
      document.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', async (e) => {
        if (!confirm('Delete product?')) return;
        try {
          await api(`/admin/products/${e.target.dataset.id}`, { method:'DELETE' });
          msg('Deleted');
          loadAdminProducts();
        } catch(err) { msg(err.error || 'Delete failed','error'); }
      }));
      document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const p = res.items.find(x=>String(x.id)===String(id));
        if (!p) return;
        $('adm-name').value = p.name;
        $('adm-price').value = p.price;
        $('adm-stock').value = p.stock;
        $('adm-desc').value = p.description || '';
        $('adm-save').dataset.editId = id;
        $('admin-form').style.display = 'block';
      }));
    } catch(e) {
      msg(e.error || 'Failed loading admin products','error');
    }
  }

  $('btnNewProduct').addEventListener('click', ()=> {
    $('adm-name').value=''; $('adm-price').value=''; $('adm-stock').value='0'; $('adm-desc').value=''; $('adm-image').value='';
    delete $('adm-save').dataset.editId;
    $('admin-form').style.display = 'block';
  });
  $('adm-cancel').addEventListener('click', ()=> $('admin-form').style.display = 'none');

  $('adm-save').addEventListener('click', async () => {
    const name = $('adm-name').value.trim();
    const price = Number($('adm-price').value);
    const stock = Number($('adm-stock').value);
    const desc = $('adm-desc').value.trim();
    const file = $('adm-image').files[0];
    let imagePath = null;
    try {
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        const token = getToken();
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        const up = await fetch('/admin/upload', { method:'POST', body: fd, headers });
        const updata = await up.json().catch(()=>({ error: 'Invalid JSON' }));
        if (!up.ok) throw updata;
        imagePath = updata.url;
      }
      const editId = $('adm-save').dataset.editId;
      if (editId) {
        await api(`/admin/products/${editId}`, { method:'PUT', body: { name, price, stock, description: desc, image: imagePath } });
        msg('Product updated');
      } else {
        await api('/admin/products', { method:'POST', body: { name, price, stock, description: desc, image: imagePath } });
        msg('Product created');
      }
      $('admin-form').style.display = 'none';
      loadAdminProducts();
      loadProducts(currentPage);
    } catch(e) {
      msg(e.error || 'Save failed','error');
    }
  });

  (function defineHelpersOnce() {
	if (typeof window !== 'undefined') {
		if (!window.el) window.el = function(id){ return document.getElementById(id); };
		if (!window.$) window.$ = window.el;
	}
	const elLocal = (typeof window !== 'undefined') ? window.el : (id => document.getElementById(id));
	const $local = (typeof window !== 'undefined') ? window.$ : elLocal;
	this.el = elLocal;
	this.$ = $local;
}).call(typeof globalThis !== 'undefined' ? globalThis : window);

  function updateAfterAuth() {
    const user = getUser();
    renderNav();
    renderAdminNav(user);
  }

  updateAfterAuth();
  showSection('home');
  try { loadProducts(); } catch(e){ console.error(e); }
  try { loadCart(); } catch(e){ console.error(e); }
})();
