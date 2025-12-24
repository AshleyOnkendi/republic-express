console.log("🚀 SCRIPT V9 - UI SYNC FIX");

const PROJECT_URL = "https://uveudhkfncwbllczhbhf.supabase.co";
const PROJECT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZXVkaGtmbmN3YmxsY3poYmhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NTE5MTksImV4cCI6MjA4MjEyNzkxOX0.30rZbjVgShWxeI5FOD8zGJU-Ho6h6d5s7foEIlQVSZI";
const db = supabase.createClient(PROJECT_URL, PROJECT_KEY);

// STATE
let cart = JSON.parse(localStorage.getItem('republic_cart')) || []; 
let currentItem = null;
let currentPrice = 0;
let addOns = {}; 
let allMenuItems = [];
let orderType = 'takeaway';
let paymentMethod = 'mpesa';

const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    syncCartUI(); // Force update UI from storage immediately
    
    const path = window.location.pathname;
    if (path.includes('product.html')) loadProductDetail();
    else if (path.includes('track.html')) initTracker();
    else { loadMenu(); }
});

// --- UI SYNC (THE FIX) ---
function syncCartUI() {
    const totalKES = cart.reduce((sum, item) => sum + item.price, 0);
    const count = cart.length;

    // Update Bottom Bar
    const cartTotalEl = document.getElementById('cart-total');
    const cartCountEl = document.getElementById('cart-count-badge');
    const bottomBar = document.getElementById('cart-bar');

    if (cartTotalEl) cartTotalEl.innerText = totalKES.toLocaleString();
    if (cartCountEl) cartCountEl.innerText = count;

    if (bottomBar) {
        if (count > 0) {
            bottomBar.style.display = 'flex';
            setTimeout(() => bottomBar.classList.add('visible'), 10);
        } else {
            bottomBar.classList.remove('visible');
            bottomBar.style.display = 'none';
        }
    }

    // Update Top Icon Badge
    const topBadge = document.getElementById('top-cart-badge');
    if (topBadge) {
        topBadge.innerText = count;
        if (count > 0) {
            topBadge.style.display = 'flex';
            topBadge.style.transform = "scale(1.2)";
            setTimeout(() => topBadge.style.transform = "scale(1)", 200);
        } else {
            topBadge.style.display = 'none';
        }
    }
}

// Re-map the original update function to our sync function
function updateCartIcon() { syncCartUI(); }

// ==========================================
// 1. MENU LOGIC
// ==========================================
async function loadMenu() {
    const container = document.getElementById('menu-container');
    if(!container) return; 
    const { data } = await db.from('menu_items').select('*').eq('is_available', true).order('name');
    allMenuItems = data;
    const categories = ['All', ...new Set(data.map(item => item.category || 'General'))];
    renderCategories(categories); renderGrid('All');
}

function renderCategories(categories) {
    const tabContainer = document.getElementById('category-tabs');
    if(tabContainer) tabContainer.innerHTML = categories.map(cat => `<button class="cat-btn ${cat === 'All' ? 'active' : ''}" onclick="filterMenu('${cat}', this)">${cat}</button>`).join('');
}

function filterMenu(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderGrid(category);
}

function renderGrid(category) {
    const container = document.getElementById('menu-container'); container.innerHTML = "";
    const items = category === 'All' ? allMenuItems : allMenuItems.filter(i => (i.category || 'General') === category);
    items.forEach(item => {
        let saleBadge = '';
        let priceHtml = `KES ${item.price}`;
        const isSoldOut = item.stock_quantity <= 0;
        
        if (isSoldOut) saleBadge = `<div class="sale-badge" style="background:#555;">🚫 SOLD OUT</div>`;
        else if (item.original_price > item.price) {
            saleBadge = `<div class="sale-badge">-${Math.round(((item.original_price - item.price) / item.original_price) * 100)}%</div>`;
            priceHtml = `<span class="old-price">${item.original_price}</span> KES ${item.price}`;
        }
        
        const card = document.createElement('div'); card.className = 'menu-card';
        const opacity = isSoldOut ? '0.6' : '1';
        card.onclick = () => { if(!isSoldOut) window.location.href = `product.html?id=${item.id}`; };
        
        card.innerHTML = `${saleBadge}<div class="card-img-wrapper" style="opacity:${opacity}"><img src="${item.image_url || PLACEHOLDER_IMG}" class="card-img" loading="lazy"></div><div class="card-details" style="opacity:${opacity}"><h3>${item.name}</h3><div class="price-row"><div class="price">${priceHtml}</div><div class="add-btn">${isSoldOut?'X':'+'}</div></div></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// 2. PRODUCT DETAIL
// ==========================================
async function loadProductDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return window.location.href = 'index.html';

    const { data } = await db.from('menu_items').select('*').eq('id', id).single();
    if (!data) return;

    currentItem = data;
    currentPrice = data.price;
    
    document.getElementById('product-name').innerText = data.name;
    document.getElementById('base-price').innerText = `KES ${data.price}`;
    document.getElementById('product-desc').innerText = data.description || "Freshly prepared.";
    if (data.original_price > data.price) document.getElementById('product-old-price').innerText = `KES ${data.original_price}`;
    document.getElementById('product-img').src = data.image_url || PLACEHOLDER_IMG;

    if(data.stock_quantity <= 0) {
        const btn = document.getElementById('add-to-order-btn'); btn.disabled = true; btn.innerText = "SOLD OUT"; btn.style.background = "#999";
    }

    let container = document.getElementById('dynamic-addons');
    if (!container) return;
    container.innerHTML = ""; addOns = {}; 

    if (data.addons && Array.isArray(data.addons)) {
        data.addons.forEach((group) => {
            const groupDiv = document.createElement('div'); groupDiv.className = 'option-group';
            groupDiv.innerHTML = `<h3>${group.name}</h3>`;
            const rowDiv = document.createElement('div'); rowDiv.className = 'options-row';
            
            group.options.forEach((opt) => {
                const btn = document.createElement('button'); btn.className = `opt-btn`;
                btn.innerText = opt.price > 0 ? `${opt.name} (+${opt.price})` : opt.name;
                
                btn.onclick = function() {
                    const isSelected = this.classList.contains('selected');
                    rowDiv.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
                    if (!isSelected) {
                        this.classList.add('selected');
                        addOns[group.name] = { name: opt.name, price: opt.price };
                    } else {
                        delete addOns[group.name];
                    }
                    updateTotalBtn();
                };
                rowDiv.appendChild(btn);
            });
            groupDiv.appendChild(rowDiv); container.appendChild(groupDiv);
        });
    }
    updateTotalBtn();
}

function updateTotalBtn() {
    let addonsTotal = 0; Object.values(addOns).forEach(opt => addonsTotal += opt.price);
    const btn = document.getElementById('dynamic-total'); if(btn) btn.innerText = (currentPrice + addonsTotal).toLocaleString();
}

function addToOrder() {
    let addonsTotal = 0; let detailsString = [];
    Object.keys(addOns).forEach(key => { const item = addOns[key]; addonsTotal += item.price; detailsString.push(`${key}: ${item.name}`); });
    cart.push({ id: currentItem.id, name: currentItem.name, details: detailsString.join(', '), price: currentPrice + addonsTotal });
    localStorage.setItem('republic_cart', JSON.stringify(cart));
    window.location.href = 'index.html'; // UI will refresh on load via DOMContentLoaded
}

// ==========================================
// 3. CHECKOUT & PAYMENT
// ==========================================
function openCheckout() { 
    if (cart.length === 0) return alert("Cart is empty!"); 
    const modal = document.getElementById('checkout-modal');
    modal.style.display = "flex"; 
    setTimeout(() => modal.classList.add('open'), 10);
    
    document.getElementById('modal-total').innerText = cart.reduce((sum, item) => sum + item.price, 0).toLocaleString(); 
    document.getElementById('order-summary').innerHTML = cart.map((item, index) => `
        <div class="summary-item">
            <div>
                <div style="font-weight:600;">${item.name}</div>
                <span class="summary-meta">${item.details || 'Standard'}</span>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:600;">${item.price}</div>
                <button onclick="removeItem(${index})" style="background:none; border:none; color:red; font-size:10px; padding:0; cursor:pointer;">Remove</button>
            </div>
        </div>`).join(''); 
}

function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('republic_cart', JSON.stringify(cart));
    syncCartUI();
    if(cart.length === 0) closeCheckout(); else openCheckout();
}

function closeCheckout() { 
    const modal = document.getElementById('checkout-modal');
    if(modal) {
        modal.classList.remove('open');
        setTimeout(() => modal.style.display = "none", 300);
    }
}

function setOrderType(type) { orderType = type; document.getElementById('btn-takeaway').className = type === 'takeaway' ? 'toggle-btn active' : 'toggle-btn'; document.getElementById('btn-dinein').className = type === 'dine_in' ? 'toggle-btn active' : 'toggle-btn'; document.getElementById('table-input-div').style.display = type === 'dine_in' ? 'block' : 'none'; }

function setPaymentMethod(method) {
    paymentMethod = method;
    document.getElementById('btn-mpesa').className = method === 'mpesa' ? 'toggle-btn active' : 'toggle-btn';
    document.getElementById('btn-cash').className = method === 'cash' ? 'toggle-btn active' : 'toggle-btn';
}

async function processPayment() {
    const phone = document.getElementById('phone-input').value;
    const tableNum = document.getElementById('table-number').value;
    if (!phone) return alert("Enter phone number!");
    if (orderType === 'dine_in' && !tableNum) return alert("Enter table number!");

    const btn = document.getElementById('pay-btn'); btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        const pStatus = paymentMethod === 'cash' ? 'pending' : 'paid';
        const { data, error } = await db.from('orders').insert([{ 
            customer_phone: phone, items: cart, total_price: total, 
            status: 'received', payment_status: pStatus, payment_method: paymentMethod,
            order_type: orderType, table_number: orderType === 'dine_in' ? tableNum : ''
        }]).select();

        if (error) throw error;
        for (let item of cart) { await db.rpc('decrease_stock', { item_id: item.id, quantity: 1 }); }
        
        const order = data[0]; showReceipt(order);
        localStorage.removeItem('republic_cart'); cart = []; syncCartUI();
    } catch (err) { alert("Error: " + err.message); btn.innerText = "TRY AGAIN"; btn.disabled = false; }
}

function showReceipt(order) {
    document.getElementById('checkout-modal').style.display = 'none';
    document.getElementById('receipt-modal').style.display = 'flex';
    document.getElementById('receipt-modal').classList.add('open');
    document.getElementById('receipt-id').innerText = `#${order.id}`;
    document.getElementById('receipt-total').innerText = `KES ${order.total_price}`;
    document.getElementById('receipt-items').innerHTML = order.items.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>1x ${i.name}</span><span>${i.price}</span></div>`).join('');
    document.getElementById('receipt-footer').innerText = order.payment_method === 'cash' ? "Pay at Counter" : "Paid";
    window.lastOrderId = order.id;
}

function downloadReceipt() {
    const element = document.getElementById('receipt-area');
    html2canvas(element, { useCORS: true }).then(canvas => { 
        const link = document.createElement('a'); link.download = `Receipt_${window.lastOrderId}.png`; link.href = canvas.toDataURL("image/png"); link.click(); 
    });
}
function finishOrder() { window.location.href = `track.html?id=${window.lastOrderId}`; }



// ==========================================
// 4. TRACKER & REVIEW LOGIC
// ==========================================
let selectedRating = 0;

async function initTracker() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id'); 
    if (!orderId) return;

    window.currentTrackingId = orderId;
    document.getElementById('order-id-display').innerText = `#${orderId}`;
    
    // Initial Fetch
    const { data } = await db.from('orders').select('status').eq('id', orderId).single();
    if (data) updateTrackerUI(data.status);

    // Real-time listener
    db.channel('tracking')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        updateTrackerUI(payload.new.status);
    }).subscribe();
}

function updateTrackerUI(status) {
    document.querySelectorAll('.status-step').forEach(el => el.className = 'status-step');
    const step1 = document.getElementById('step-received'); 
    const step2 = document.getElementById('step-brewing'); 
    const step3 = document.getElementById('step-ready');

    if (status === 'received') step1.classList.add('active-step'); 
    else if (status === 'brewing') { step1.classList.add('completed-step'); step2.classList.add('active-step'); } 
    else if (status === 'ready' || status === 'completed') {
        step1.classList.add('completed-step'); 
        step2.classList.add('completed-step'); 
        step3.classList.add('active-step');
        
        // Show Review Modal if not already reviewed
        if (!localStorage.getItem(`reviewed_${window.currentTrackingId}`)) {
            setTimeout(() => {
                const modal = document.getElementById('review-modal');
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('open'), 10);
            }, 2000);
        }
    }
}

// --- STAR RATING LOGIC ---
function setRating(n) {
    selectedRating = n;
    const stars = document.querySelectorAll('#star-rating span');
    stars.forEach((s, idx) => {
        s.innerText = idx < n ? '★' : '☆';
        s.style.color = idx < n ? '#f1c40f' : '#ccc';
    });
}

async function submitReview() {
    if (selectedRating === 0) return alert("Please pick a star rating!");
    
    const btn = document.getElementById('submit-review-btn');
    btn.innerText = "Sending..."; btn.disabled = true;

    const comment = document.getElementById('review-comment').value;
    
    const { error } = await db.from('reviews').insert([{
        order_id: window.currentTrackingId,
        rating: selectedRating,
        comment: comment
    }]);

    if (!error) {
        localStorage.setItem(`reviewed_${window.currentTrackingId}`, 'true');
        alert("Thank you for your feedback! ❤️");
        closeReview();
    } else {
        alert("Error sending review.");
        btn.innerText = "SUBMIT REVIEW"; btn.disabled = false;
    }
}

function closeReview() {
    const modal = document.getElementById('review-modal');
    modal.classList.remove('open');
    setTimeout(() => modal.style.display = 'none', 300);
}
