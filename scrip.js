// script.js — shared by admin.html and index.html

const STORAGE_KEY = 'products';
const WHATSAPP_NUMBER = '2348012345678'; // ← replace with your number if you want
const NGN = new Intl.NumberFormat('en-NG', { style:'currency', currency:'NGN', maximumFractionDigits:0 });

function getProducts(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveProducts(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function makeId(){
  return 'p-' + Date.now() + '-' + Math.floor(Math.random()*9000 + 1000);
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function placeholderImage(name){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='#1b325f'/><text x='50%' y='52%' font-family='Segoe UI, Roboto, Arial' font-size='44' fill='white' text-anchor='middle'>${escapeHtml(name||'Product')}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* =================== ADMIN PAGE =================== */
document.addEventListener('DOMContentLoaded', () => {
  // ADMIN: form and table
  const form = document.getElementById('productForm');
  const adminTableBody = document.getElementById('adminProductList');
  const clearBtn = document.getElementById('clearForm');

  if(form && adminTableBody){
    const idInput = document.getElementById('productId');
    const nameInput = document.getElementById('productName');
    const priceInput = document.getElementById('productPrice');
    const imageInput = document.getElementById('productImage');
    const statusSelect = document.getElementById('productStatus');
    const saveBtn = document.getElementById('saveBtn');

    function renderAdmin(){
      const products = getProducts();
      adminTableBody.innerHTML = '';
      if(products.length === 0){
        adminTableBody.innerHTML = `<tr><td colspan="5" class="muted">No products yet</td></tr>`;
        return;
      }
      products.forEach(p => {
        const imgSrc = p.image && p.image.trim() ? p.image : placeholderImage(p.name);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><img class="thumb" src="${imgSrc}" alt="${escapeHtml(p.name)}"></td>
          <td>${escapeHtml(p.name)}</td>
          <td>${NGN.format(parseInt(p.price||0,10))}</td>
          <td>${escapeHtml(p.status)}</td>
          <td>
            <button class="small-btn" onclick="editProduct('${p.id}')">Edit</button>
            <button class="small-btn" onclick="toggleProduct('${p.id}')">${p.status==='available' ? 'Mark Sold' : 'Mark Av.'}</button>
            <button class="small-btn btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
          </td>
        `;
        adminTableBody.appendChild(tr);
      });
    }

    // Expose functions to window so buttons in HTML can call them
    window.editProduct = function(id){
      const products = getProducts();
      const p = products.find(x => x.id === id);
      if(!p) return alert('Product not found');
      idInput.value = p.id;
      nameInput.value = p.name;
      priceInput.value = p.price;
      statusSelect.value = p.status || 'available';
      imageInput.value = ''; // keep current if no new file
      window.scrollTo({top:0,behavior:'smooth'});
    };

    window.deleteProduct = function(id){
      if(!confirm('Delete this product?')) return;
      let products = getProducts().filter(x => x.id !== id);
      saveProducts(products);
      renderAdmin();
      // notify other tabs
      window.dispatchEvent(new Event('storage'));
    };

    window.toggleProduct = function(id){
      let products = getProducts();
      const p = products.find(x => x.id === id);
      if(!p) return;
      p.status = (p.status === 'available') ? 'sold' : 'available';
      saveProducts(products);
      renderAdmin();
      window.dispatchEvent(new Event('storage'));
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const price = priceInput.value;
      const status = statusSelect.value;
      const file = imageInput.files[0];
      if(!name){ alert('Name required'); return; }
      if(!price){ alert('Price required'); return; }

      let products = getProducts();
      const editingId = idInput.value;

      // Helper to finish save
      const finishSave = (productObj, isNew) => {
        if(isNew) products.push(productObj);
        else {
          const idx = products.findIndex(x => x.id === productObj.id);
          if(idx >= 0) products[idx] = productObj;
        }
        saveProducts(products);
        renderAdmin();
        form.reset();
        idInput.value = '';
        // let other tabs know (some browsers fire storage; trigger explicit)
        window.dispatchEvent(new Event('storage'));
      };

      if(editingId){
        // update existing
        const idx = products.findIndex(x => x.id === editingId);
        if(idx === -1) { alert('Product not found'); return; }
        const current = products[idx];
        if(file){
          const reader = new FileReader();
          reader.onload = ()=> {
            current.image = reader.result;
            current.name = name;
            current.price = price;
            current.status = status;
            finishSave(current, false);
          };
          reader.readAsDataURL(file);
          return;
        } else {
          // keep old image
          current.name = name;
          current.price = price;
          current.status = status;
          finishSave(current, false);
          return;
        }
      } else {
        // add new
        const newItem = { id: makeId(), name, price, status, image: '' };
        if(file){
          const reader = new FileReader();
          reader.onload = ()=> {
            newItem.image = reader.result;
            finishSave(newItem, true);
          };
          reader.readAsDataURL(file);
          return;
        } else {
          // allow adding without image (will use placeholder)
          finishSave(newItem, true);
          return;
        }
      }
    });

    clearBtn.addEventListener('click', ()=> {
      form.reset();
      document.getElementById('productId').value = '';
    });

    // respond to storage changes (other tabs)
    window.addEventListener('storage', () => renderAdmin());
    renderAdmin();
  } // end admin block

  /* =================== INDEX PAGE =================== */
  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const availableToggle = document.getElementById('availableToggle');
  const resetBtn = document.getElementById('resetBtn');
  const noneMsg = document.getElementById('none');

  if(grid){
    function renderIndex(){
      const q = (searchInput && searchInput.value || '').trim().toLowerCase();
      const onlyAvail = availableToggle && availableToggle.checked;
      let products = getProducts();
      let filtered = products.filter(p => {
        if(onlyAvail && p.status !== 'available') return false;
        if(!q) return true;
        return (p.name || '').toLowerCase().includes(q);
      });

      grid.innerHTML = '';
      if(!filtered.length){
        noneMsg.style.display = 'block';
        return;
      } else noneMsg.style.display = 'none';

      filtered.forEach(p => {
        const img = (p.image && p.image.trim()) ? p.image : placeholderImage(p.name);
        const card = document.createElement('article');
        card.className = 'card';
        const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello, I'm interested in "${p.name}" priced ${NGN.format(parseInt(p.price||0,10))}. Is it available?`)}`;
        card.innerHTML = `
          <div class="thumb"><img src="${img}" alt="${escapeHtml(p.name)}"></div>
          <div class="body">
            <div class="title">${escapeHtml(p.name)}</div>
            <div class="price">${NGN.format(parseInt(p.price||0,10))}</div>
            <div class="badge ${p.status==='available' ? 'available' : 'sold'}">${(p.status||'available').toUpperCase()}</div>
            ${p.status==='available' ? `<a class="wa" href="${waLink}" target="_blank" rel="noopener">Chat on WhatsApp</a>` : ''}
          </div>
        `;
        grid.appendChild(card);
      });
    }

    // events
    if(searchBtn) searchBtn.addEventListener('click', renderIndex);
    if(searchInput) searchInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); renderIndex(); }});
    if(availableToggle) availableToggle.addEventListener('change', renderIndex);
    if(resetBtn) resetBtn.addEventListener('click', () => { if(searchInput) searchInput.value=''; if(availableToggle) availableToggle.checked=true; renderIndex(); });

    // update when localStorage changes in other tabs
    window.addEventListener('storage', (e) => {
      if(e.key === STORAGE_KEY || e.key === null) renderIndex();
    });

    // initial render
    renderIndex();
  } // end index block
}); // DOMContentLoaded