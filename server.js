const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// Admin authentication: set ADMIN_PASSWORD and ADMIN_SECRET in the hosting environment.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeThisPassword123!";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "local-development-secret-change-before-deploy";
const sign = (value) => crypto.createHmac("sha256", ADMIN_SECRET).update(value).digest("hex");
function adminAuth(req, res, next) {
  const token = req.cookies?.youshop_admin;
  if (!token || !token.includes(".")) return res.status(401).json({ error: "ابتدا وارد پنل شوید." });
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: "نشست معتبر نیست؛ دوباره وارد شوید." });
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return res.status(401).json({ error: "نشست منقضی شده است." });
    next();
  } catch { return res.status(401).json({ error: "نشست نامعتبر است." }); }
}
// Tiny cookie parser; no additional dependency needed.
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(v => { const i=v.indexOf("="); return [v.slice(0,i).trim(), decodeURIComponent(v.slice(i+1).trim())]; }));
  next();
});
app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length > 200 || password !== ADMIN_PASSWORD) return res.status(401).json({ error: "رمز عبور اشتباه است." });
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  res.setHeader("Set-Cookie", `youshop_admin=${payload}.${sign(payload)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  res.json({ ok: true });
});
app.post("/api/admin/logout", (_req, res) => { res.setHeader("Set-Cookie", "youshop_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"); res.json({ ok: true }); });
app.get("/api/admin/summary", adminAuth, (_req, res) => {
  res.json({ products: db.prepare("SELECT COUNT(*) n FROM products").get().n, orders: db.prepare("SELECT COUNT(*) n FROM orders").get().n, pending: db.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('جدید','در انتظار پرداخت')").get().n, revenue: db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status IN ('ارسال شد','تحویل شد','تکمیل شده')").get().n });
});
app.get("/api/admin/products", adminAuth, (_req, res) => res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()));
app.post("/api/admin/products", adminAuth, (req, res) => {
  const b=req.body||{}; const name=String(b.name||"").trim(), category=String(b.category||"").trim();
  const price=Number(b.price), stock=Number(b.stock||0);
  if (!name || !category || !Number.isSafeInteger(price) || price<0 || !Number.isSafeInteger(stock) || stock<0) return res.status(400).json({error:"نام، دسته‌بندی، قیمت و موجودی معتبر وارد کنید."});
  const r=db.prepare("INSERT INTO products (name,description,category,price,old_price,image,stock) VALUES (?,?,?,?,?,?,?)").run(name.slice(0,150),String(b.description||"").slice(0,2000),category.slice(0,80),price,Number(b.old_price)>0?Number(b.old_price):null,String(b.image||"").slice(0,1000),stock);
  res.status(201).json(db.prepare("SELECT * FROM products WHERE id=?").get(r.lastInsertRowid));
});
app.put("/api/admin/products/:id", adminAuth, (req,res)=>{
  const b=req.body||{}, id=Number(req.params.id), name=String(b.name||"").trim(), category=String(b.category||"").trim(), price=Number(b.price), stock=Number(b.stock);
  if (!Number.isInteger(id)||!name||!category||!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(stock)||stock<0) return res.status(400).json({error:"اطلاعات محصول معتبر نیست."});
  const r=db.prepare("UPDATE products SET name=?,description=?,category=?,price=?,old_price=?,image=?,stock=? WHERE id=?").run(name.slice(0,150),String(b.description||"").slice(0,2000),category.slice(0,80),price,Number(b.old_price)>0?Number(b.old_price):null,String(b.image||"").slice(0,1000),stock,id);
  if(!r.changes) return res.status(404).json({error:"محصول پیدا نشد."}); res.json({ok:true});
});
app.delete("/api/admin/products/:id", adminAuth, (req,res)=>{ const r=db.prepare("DELETE FROM products WHERE id=?").run(Number(req.params.id)); if(!r.changes) return res.status(404).json({error:"محصول پیدا نشد."}); res.json({ok:true}); });
app.put("/api/admin/orders/:id/status", adminAuth, (req,res)=>{ const allowed=["جدید","در حال آماده‌سازی","تحویل پست","ارسال شد","تحویل شد","لغو شد"]; const status=String(req.body?.status||""); if(!allowed.includes(status)) return res.status(400).json({error:"وضعیت نامعتبر است."}); const r=db.prepare("UPDATE orders SET status=? WHERE id=?").run(status,Number(req.params.id)); if(!r.changes) return res.status(404).json({error:"سفارش پیدا نشد."}); res.json({ok:true}); });

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", (req, res) => {
  const { q = "", category = "" } = req.query;
  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];
  if (q.trim()) { sql += " AND (name LIKE ? OR description LIKE ?)"; params.push(`%${q.trim()}%`, `%${q.trim()}%`); }
  if (category && category !== "همه") { sql += " AND category = ?"; params.push(category); }
  sql += " ORDER BY id DESC";
  res.json(db.prepare(sql).all(...params));
});

app.get("/api/categories", (_req, res) => {
  res.json(db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all().map(x => x.category));
});

app.get("/api/products/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: "محصول پیدا نشد" });
  res.json(item);
});

app.post("/api/orders", (req, res) => {
  const { customerName, phone, address, items } = req.body || {};
  if (!customerName || !phone || !address || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "اطلاعات سفارش کامل نیست." });
  const getProduct = db.prepare("SELECT id, name, price, stock FROM products WHERE id = ?");
  const insertOrder = db.prepare("INSERT INTO orders (customer_name, phone, address, total, status, created_at) VALUES (?, ?, ?, ?, 'جدید', datetime('now'))");
  const insertItem = db.prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)");
  try {
    const result = db.transaction(() => {
      let total = 0, clean = [];
      for (const item of items) {
        const p = getProduct.get(Number(item.productId));
        const qty = Math.floor(Number(item.quantity));
        if (!p || !Number.isFinite(qty) || qty < 1 || qty > p.stock) throw new Error(`موجودی کافی نیست: ${p?.name || "محصول"}`);
        total += p.price * qty;
        clean.push({ p, qty });
      }
      const order = insertOrder.run(String(customerName).slice(0,120), String(phone).slice(0,30), String(address).slice(0,500), total);
      for (const x of clean) {
        insertItem.run(order.lastInsertRowid, x.p.id, x.p.name, x.qty, x.p.price);
        db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(x.qty, x.p.id);
      }
      return { id: order.lastInsertRowid, total };
    })();
    res.status(201).json({ message: "سفارش با موفقیت ثبت شد.", ...result });
  } catch (e) { res.status(400).json({ error: e.message || "ثبت سفارش ناموفق بود." }); }
});

app.get("/api/admin/orders", adminAuth, (_req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 100").all();
  res.json(orders.map(o => ({ ...o, items: db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id) })));
});

app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`فروشگاه آماده است: http://localhost:${PORT}`));
