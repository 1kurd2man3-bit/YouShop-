const Database = require("better-sqlite3");
const db = new Database("shop.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL,
 price INTEGER NOT NULL CHECK(price >= 0),
 old_price INTEGER,
 image TEXT NOT NULL DEFAULT '',
 stock INTEGER NOT NULL DEFAULT 10 CHECK(stock >= 0),
 rating REAL NOT NULL DEFAULT 4.5
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 address TEXT NOT NULL,
 total INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'جدید',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id),
 product_id INTEGER NOT NULL,
 product_name TEXT NOT NULL,
 quantity INTEGER NOT NULL,
 unit_price INTEGER NOT NULL
);
`);
const count = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
if (!count) {
 const seed = db.prepare("INSERT INTO products (name, description, category, price, old_price, image, stock, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
 const products = [
 ["گوشی موبایل سامسونگ","گوشی هوشمند با نمایشگر باکیفیت و باتری بادوام","موبایل",189900000,219900000,"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=700&q=80",15,4.7],
 ["هدفون بی‌سیم","صدای شفاف، طراحی راحت و اتصال سریع","لوازم جانبی",12900000,15900000,"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80",24,4.5],
 ["ساعت هوشمند","پایش فعالیت روزانه و اعلان‌های تلفن همراه","پوشیدنی",24900000,29900000,"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80",12,4.4],
 ["لپ‌تاپ دانشجویی","مناسب کارهای روزمره، مطالعه و وب‌گردی","کامپیوتر",329900000,359900000,"https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=80",8,4.6],
 ["کفش ورزشی","سبک و راحت برای پیاده‌روی و تمرین","مد و پوشاک",21900000,0,"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",20,4.3],
 ["دوربین عکاسی","ثبت لحظه‌ها با جزئیات و رنگ‌های طبیعی","دیجیتال",279900000,309900000,"https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=700&q=80",5,4.8],
 ["اسپیکر قابل حمل","موسیقی همراه شما با صدای قدرتمند","لوازم جانبی",8900000,10900000,"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=700&q=80",30,4.2],
 ["کوله‌پشتی روزمره","جادار، کاربردی و مناسب دانشگاه و سفر","مد و پوشاک",11500000,0,"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80",17,4.4]
 ];
 for (const p of products) {
   seed.run(...p);
 }
}
module.exports = db;
