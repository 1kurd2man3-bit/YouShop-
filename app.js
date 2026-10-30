const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("fa-IR").format(n) + " ریال";
let products = [], category = "همه", cart = JSON.parse(localStorage.getItem("youshop-cart") || "{}");
async function loadProducts() {
  $("#productsGrid").innerHTML = '<div class="loading">در حال دریافت محصولات…</div>';
  try {
    const params = new URLSearchParams();
    if ($("#searchInput").value.trim()) params.set("q", $("#searchInput").value.trim());
    if (category !== "همه") params.set("category", category);
    const res = await fetch("/api/products?" + params);
    products = await res.json();
    renderProducts();
  } catch { $("#productsGrid").innerHTML = '<div class="empty">ارتباط با سرور برقرار نشد. سرور را اجرا کنید.</div>'; }
}
function renderProducts() {
  $("#resultCount").textContent = `${new Intl.NumberFormat("fa-IR").format(products.length)} کالا`;
  if (!products.length) { $("#productsGrid").innerHTML = '<div class="empty">محصولی پیدا نشد.</div>'; return; }
  $("#productsGrid").innerHTML = products.map(p => {
    const discount = p.old_price > p.price ? Math.round((p.old_price-p.price)*100/p.old_price) : 0;
    return `<article class="card"><div class="product-image">${discount ? `<span class="discount">${discount}٪ تخفیف</span>` : ""}<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='https://placehold.co/400x300/f7f7fa/777?text=Product'"></div><div class="card-body"><span class="category">${escapeHtml(p.category)}</span><h3 class="product-name">${escapeHtml(p.name)}</h3><div class="rating">★ ${Number(p.rating).toLocaleString("fa-IR")} <span style="color:#999">| موجودی ${Number(p.stock).toLocaleString("fa-IR")}</span></div><div class="price-row"><div><div class="price">${money(p.price)}</div>${discount ? `<div class="old-price">${money(p.old_price)}</div>` : ""}</div></div><button class="add-btn" ${p.stock<1?"disabled":""} onclick="addToCart(${p.id})">${p.stock<1?"ناموجود":"＋ افزودن به سبد"}</button></div></article>`;
  }).join("");
}
function escapeHtml(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function loadCategories() {
  const cats = await fetch("/api/categories").then(r=>r.json()).catch(()=>[]);
  $("#categories").innerHTML = ['همه',...cats].map(c=>`<button data-category="${escapeHtml(c)}" class="${c===category?"active":""}">${c==="همه"?"همه کالاها":escapeHtml(c)}</button>`).join("");
}
$("#categories").addEventListener("click", e => { const b=e.target.closest("button[data-category]"); if(!b)return; category=b.dataset.category; loadCategories(); loadProducts(); });
$("#searchForm").addEventListener("submit", e=>{e.preventDefault();loadProducts();});
$("#searchInput").addEventListener("input",()=>{clearTimeout(window.searchTimer);window.searchTimer=setTimeout(loadProducts,250);});
function saveCart(){localStorage.setItem("youshop-cart",JSON.stringify(cart));renderCart();}
function addToCart(id){cart[id]=(cart[id]||0)+1;saveCart();openCart();}
function changeQty(id,d){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];saveCart();}
function renderCart(){
 const entries=Object.entries(cart);
 $("#cartCount").textContent=entries.reduce((n,[,q])=>n+q,0).toLocaleString("fa-IR");
 let total=0;
 $("#cartItems").innerHTML=entries.map(([id,q])=>{const p=products.find(x=>x.id===Number(id)); if(!p)return "";total+=p.price*q;return `<div class="cart-line"><div><b>${escapeHtml(p.name)}</b><small>${money(p.price)} × ${q.toLocaleString("fa-IR")}</small></div><div class="quantity"><button onclick="changeQty(${p.id},-1)">−</button><span>${q.toLocaleString("fa-IR")}</span><button onclick="changeQty(${p.id},1)">+</button></div></div>`;}).join("") || '<div class="empty">سبد خرید شما خالی است.</div>';
 $("#cartTotal").textContent=money(total);$("#checkoutBtn").disabled=!entries.length;
}
function openCart(){$("#cartPanel").classList.add("open");$("#overlay").classList.add("show");}
function closeCart(){$("#cartPanel").classList.remove("open");$("#overlay").classList.remove("show");}
$("#openCart").onclick=openCart;$("#closeCart").onclick=closeCart;$("#overlay").onclick=closeCart;
$("#checkoutBtn").onclick=()=>{if(!Object.keys(cart).length)return;closeCart();$("#checkoutMessage").textContent="";$("#checkoutDialog").showModal();};
$("#closeCheckout").onclick=()=>$("#checkoutDialog").close();
$("#checkoutForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=e.submitter;btn.disabled=true;$("#checkoutMessage").textContent="در حال ثبت سفارش…";
 const data=Object.fromEntries(new FormData(e.currentTarget).entries());
 const items=Object.entries(cart).map(([productId,quantity])=>({productId:Number(productId),quantity}));
 try{
   const res=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,items})});
   const result=await res.json();if(!res.ok)throw new Error(result.error||"خطا در ثبت سفارش");
   $("#checkoutMessage").textContent=`${result.message} شماره سفارش: ${Number(result.id).toLocaleString("fa-IR")} — مبلغ: ${money(result.total)}`;
   cart={};saveCart();e.currentTarget.reset();await loadProducts();
 }catch(err){$("#checkoutMessage").style.color="#d22";$("#checkoutMessage").textContent=err.message;}
 finally{btn.disabled=false;}
});
loadCategories();loadProducts();renderCart();
