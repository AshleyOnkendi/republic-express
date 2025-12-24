console.log("🚀 SCRIPT V7 - OFFLINE PLACEHOLDER FIX");

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

// NEW: Offline Gray Placeholder (No internet needed)
const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// ROUTER
const path = window.location.pathname;
if (path.includes('product.html')) loadProductDetail();
else if (path.includes('track.html')) initTracker();
else { loadMenu(); updateCartIcon(); }

// ==========================================
// 1. MENU & INVENTORY
// ==========================================
async function loadMenu() {
    const container = document.getElementById('menu-container');
    if(!container) return; 

    const { data, error } = await db.from('menu_items').select('*').eq('is_available', true).order('name');
    if (error) return console.error(error);
    
    allMenuItems = data;
    const categories = ['All', ...new Set(data.map(item => item.category || 'General'))];
    renderCategories(categories);
    renderGrid('All');
}

function renderCategories(categories) {
    const tabContainer = document.getElementById('category-tabs');
    if(tabContainer) tabContainer.innerHTML = categories.map(cat => `<button class="cat-btn ${cat === 'All' ? 'active' : ''}" onclick="filterMenu('${cat}', this)">${cat}</button>`).join('');
}

function filterMenu(category, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(category);
}

function renderGrid(category) {
    const container = document.getElementById('menu-container');
    container.innerHTML = "";
    const itemsToShow = category === 'All' ? allMenuItems : allMenuItems.filter(i => (i.category || 'General') === category);

    itemsToShow.forEach(item => {
        let saleBadge = '';
        let priceHtml = `KES ${item.price}`;
        
        // Inventory Check
        const isSoldOut = item.stock_quantity <= 0;
        
        if (isSoldOut) {
            saleBadge = `<div class="sale-badge" style="background:#555;">🚫 SOLD OUT</div>`;
        } else if (item.original_price > item.price) {
            const discount = Math.round(((item.original_price - item.price) / item.original_price) * 100);
            saleBadge = `<div class="sale-badge">-${discount}%</div>`;
            priceHtml = `<span class="old-price">${item.original_price}</span> KES ${item.price}`;
        }

        // Use Offline Placeholder if URL is missing
        const imgUrl = item.image_url || PLACEHOLDER_IMG;
        
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.onclick = () => { if(!isSoldOut) window.location.href = `product.html?id=${item.id}`; };
        
        const opacity = isSoldOut ? '0.6' : '1';

        card.innerHTML = `
            ${saleBadge}
            <div class="card-img-wrapper" style="opacity:${opacity}"><img src="${imgUrl}" class="card-img" loading="lazy"></div>
            <div class="card-details" style="opacity:${opacity}">
                <h3>${item.name}</h3>
                <div class="price-row"><div class="price">${priceHtml}</div><div class="add-btn" style="${isSoldOut?'background:#ccc':''}">${isSoldOut?'X':'+'}</div></div>
            </div>
        `;
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
    document.getElementById('product-desc').innerText = data.description || "Freshly prepared for you.";
    if (data.original_price > data.price) document.getElementById('product-old-price').innerText = `KES ${data.original_price}`;
    
    if(data.stock_quantity <= 0) {
        const btn = document.getElementById('add-to-order-btn');
        btn.disabled = true; btn.innerText = "SOLD OUT"; btn.style.background = "#999";
    }

    const img = document.getElementById('product-img');
    if(img) img.src = data.image_url || PLACEHOLDER_IMG;

    let container = document.getElementById('dynamic-addons');
    if (!container) { container = document.createElement('div'); container.id = 'dynamic-addons'; const btn = document.getElementById('add-to-order-btn'); btn.parentNode.insertBefore(container, btn); }
    container.innerHTML = ""; addOns = {}; 

    if (data.addons && Array.isArray(data.addons)) {
        data.addons.forEach((group) => {
            const groupDiv = document.createElement('div'); groupDiv.className = 'option-group'; groupDiv.innerHTML = `<h3 style="font-size:16px; margin-bottom:10px;">${group.name}</h3>`;
            const rowDiv = document.createElement('div'); rowDiv.className = 'options-row';
            group.options.forEach((opt, optIndex) => {
                const btn = document.createElement('button'); btn.className = `opt-btn ${optIndex === 0 ? 'selected' : ''}`; btn.innerText = opt.price > 0 ? `${opt.name} (+${opt.price})` : opt.name;
                if (optIndex === 0) addOns[group.name] = { name: opt.name, price: opt.price };
                btn.onclick = function() { rowDiv.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected')); this.classList.add('selected'); addOns[group.name] = { name: opt.name, price: opt.price }; updateTotalBtn(); };
                rowDiv.appendChild(btn);
            });
            groupDiv.appendChild(rowDiv); container.appendChild(groupDiv);
        });
    }
    updateTotalBtn();
}

function updateTotalBtn() {
    let addonsTotal = 0; Object.values(addOns).forEach(opt => addonsTotal += opt.price);
    const btn = document.getElementById('dynamic-total');
    if(btn) btn.innerText = currentPrice + addonsTotal;
}

function addToOrder() {
    let addonsTotal = 0; let detailsString = [];
    Object.keys(addOns).forEach(key => { const item = addOns[key]; addonsTotal += item.price; detailsString.push(`${key}: ${item.name}`); });
    cart.push({ id: currentItem.id, name: currentItem.name, details: detailsString.join(', '), price: currentPrice + addonsTotal });
    localStorage.setItem('republic_cart', JSON.stringify(cart)); window.location.href = 'index.html';
}

// ==========================================
// 3. CHECKOUT & PAYMENT
// ==========================================
function updateCartIcon() { const totalEl = document.getElementById('cart-total'); if (totalEl) totalEl.innerText = cart.reduce((sum, item) => sum + item.price, 0).toLocaleString(); }
function openCheckout() { if (cart.length === 0) return alert("Cart is empty!"); document.getElementById('checkout-modal').style.display = "flex"; document.getElementById('modal-total').innerText = cart.reduce((sum, item) => sum + item.price, 0).toLocaleString(); document.getElementById('order-summary').innerHTML = cart.map(item => `<div style="border-bottom:1px solid #eee; padding:5px 0;"><strong>${item.name}</strong><br><span style="font-size:12px; color:#666;">${item.details}</span><span style="float:right;">${item.price}</span></div>`).join(''); }
function closeCheckout() { document.getElementById('checkout-modal').style.display = "none"; }
function setOrderType(type) { orderType = type; document.getElementById('btn-takeaway').className = type === 'takeaway' ? 'toggle-btn active' : 'toggle-btn'; document.getElementById('btn-dinein').className = type === 'dine_in' ? 'toggle-btn active' : 'toggle-btn'; document.getElementById('table-input-div').style.display = type === 'dine_in' ? 'block' : 'none'; }


let paymentMethod = 'mpesa'; // Default

function setPaymentMethod(method) {
    paymentMethod = method;
    document.getElementById('btn-mpesa').className = method === 'mpesa' ? 'toggle-btn active' : 'toggle-btn';
    document.getElementById('btn-cash').className = method === 'cash' ? 'toggle-btn active' : 'toggle-btn';
    // Toggle Pay Button Text
    const btn = document.getElementById('pay-btn');
    if (method === 'cash') {
        btn.innerText = "PLACE ORDER (PAY AT COUNTER)";
        btn.style.background = "#333";
    } else {
        btn.innerText = "PAY NOW (M-PESA)";
        btn.style.background = "#25D366";
    }
}

async function processPayment() {
    const phone = document.getElementById('phone-input').value;
    const tableNum = document.getElementById('table-number').value;

    if (!phone) return alert("Enter phone number!");
    if (orderType === 'dine_in' && !tableNum) return alert("Enter table number!");

    const btn = document.getElementById('pay-btn');
    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        // If Cash, status is 'pending'. If M-Pesa, we assume 'paid' (in this simplified demo)
        const pStatus = paymentMethod === 'cash' ? 'pending' : 'paid';

        const { data, error } = await db.from('orders').insert([{ 
            customer_phone: phone, items: cart, total_price: total, 
            status: 'received', 
            payment_status: pStatus, // <--- DYNAMIC STATUS
            payment_method: paymentMethod, // <--- NEW FIELD
            order_type: orderType, table_number: orderType === 'dine_in' ? tableNum : ''
        }]).select();

        if (error) throw error;

        // Decrease stock immediately (even for cash orders, to reserve item)
        for (let item of cart) { await db.rpc('decrease_stock', { item_id: item.id, quantity: 1 }); }

        const order = data[0];
        showReceipt(order);
        localStorage.removeItem('republic_cart'); cart = [];

    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        setPaymentMethod(paymentMethod); // Reset text
    }
}

// --- RECEIPT & DOWNLOAD (FIXED) ---
function showReceipt(order) {
    document.getElementById('checkout-modal').style.display = 'none';
    document.getElementById('receipt-modal').style.display = 'flex';
    document.getElementById('receipt-id').innerText = `#${order.id}`;
    document.getElementById('receipt-total').innerText = `KES ${order.total_price}`;
    document.getElementById('receipt-items').innerHTML = order.items.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>1x ${i.name}</span><span>${i.price}</span></div>`).join('');
    const location = order.order_type === 'dine_in' ? `📍 Table ${order.table_number}` : `📦 Takeaway`;
    document.getElementById('receipt-footer').innerText = `${location} • Paid via M-Pesa`;
    window.lastOrderId = order.id;
}

function downloadReceipt() {
    const element = document.getElementById('receipt-area');
    // Using html2canvas: captures the receipt-area DIV and saves as PNG
    html2canvas(element, { useCORS: true }).then(canvas => { 
        const link = document.createElement('a'); 
        link.download = `Republic_Receipt_${window.lastOrderId}.png`; 
        link.href = canvas.toDataURL("image/png"); 
        link.click(); 
    });
}

function finishOrder() { window.location.href = `track.html?id=${window.lastOrderId}`; }

// ==========================================
// 4. TRACKER & CHIME
// ==========================================
async function initTracker() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    if (!orderId) return;

    if (!document.getElementById('audio-ready')) {
        const audio = document.createElement('audio'); audio.id = 'audio-ready';
        audio.src = "https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3"; 
        document.body.appendChild(audio);
    }

    document.getElementById('order-id-display').innerText = `#${orderId}`;
    fetchStatus(orderId);

    db.channel('public:orders').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.new.id == orderId) {
            updateTrackerUI(payload.new.status);
            if (payload.new.status === 'ready') { try { document.getElementById('audio-ready').play(); } catch(e){} }
        }
    }).subscribe();
}

async function fetchStatus(id) { const { data } = await db.from('orders').select('status').eq('id', id).single(); if (data) updateTrackerUI(data.status); }
function updateTrackerUI(status) {
    document.querySelectorAll('.status-step').forEach(el => el.className = 'status-step');
    const step1 = document.getElementById('step-received');
    const step2 = document.getElementById('step-brewing');
    const step3 = document.getElementById('step-ready');

    if (status === 'received') step1.classList.add('active-step');
    else if (status === 'brewing') { step1.classList.add('completed-step'); step2.classList.add('active-step'); }
    else if (status === 'ready' || status === 'completed') {
        step1.classList.add('completed-step'); step2.classList.add('completed-step');
        step3.classList.add('active-step'); step3.innerText = "Order Ready! ✅";
        
        // --- NEW: TRIGGER REVIEW MODAL ---
        // Only show if the modal exists in the HTML (it only exists on track.html)
        const modal = document.getElementById('review-modal');
        if (modal && !localStorage.getItem(`reviewed_${window.lastOrderId}`)) {
            setTimeout(() => { modal.style.display = 'flex'; }, 2000); // Wait 2 seconds then pop up
            // Mark as reviewed so it doesn't pop up forever
            localStorage.setItem(`reviewed_${window.lastOrderId}`, 'true');
        }
    }
}