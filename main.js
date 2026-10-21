const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

let db;
function initDb() {
  const dbPath = path.join(app.getPath('userData'), 'mawja_spare_parts.db');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      vehicle_type TEXT DEFAULT 'سيارات وشاحنات',
      brand TEXT DEFAULT '',
      buy_price REAL NOT NULL DEFAULT 0,
      sell_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      customer_id INTEGER,
      customer_name TEXT DEFAULT 'زبون نقدي',
      customer_phone TEXT DEFAULT '',
      sale_type TEXT DEFAULT 'نقدي',
      payment_method TEXT DEFAULT 'نقدي',
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      barcode TEXT DEFAULT '',
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count === 0) {
    const add = db.prepare(`INSERT INTO products (barcode,name,category,vehicle_type,brand,buy_price,sell_price,quantity,min_quantity,location) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    [
      ['622000000001','فلتر زيت','فلاتر','سيارات','عام',18,25,30,5,'A-01'],
      ['622000000002','فلتر هواء شاحنة','فلاتر','شاحنات','عام',45,60,12,3,'B-02'],
      ['622000000003','سير محرك','سيور','سيارات وشاحنات','عام',22,35,20,4,'C-01']
    ].forEach(p => add.run(...p));
  }
}
function all(sql, ...params) { return db.prepare(sql).all(...params); }
function one(sql, ...params) { return db.prepare(sql).get(...params); }
function run(sql, ...params) { return db.prepare(sql).run(...params); }

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: 'موجة البرمجة | منظومة قطع الغيار',
    backgroundColor: '#f4f7fb',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.loadFile('index.html');
}
app.whenReady().then(() => {
  initDb();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('dashboard:get', () => {
  const products = one('SELECT COUNT(*) n FROM products').n;
  const stockValue = one('SELECT COALESCE(SUM(quantity*buy_price),0) n FROM products').n;
  const todaySales = one("SELECT COALESCE(SUM(total),0) n FROM sales WHERE date(created_at)=date('now','localtime')").n;
  const todayInvoices = one("SELECT COUNT(*) n FROM sales WHERE date(created_at)=date('now','localtime')").n;
  const lowStock = one('SELECT COUNT(*) n FROM products WHERE quantity<=min_quantity').n;
  const due = one('SELECT COALESCE(SUM(remaining),0) n FROM sales').n;
  return { products, stockValue, todaySales, todayInvoices, lowStock, due, recent: all('SELECT id,invoice_no,customer_name,total,payment_method,created_at FROM sales ORDER BY id DESC LIMIT 7') };
});
ipcMain.handle('products:list', (_, q='') => {
  const term = `%${String(q).trim()}%`;
  return all('SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? OR category LIKE ? OR brand LIKE ? ORDER BY id DESC LIMIT 1000', term,term,term,term);
});
ipcMain.handle('products:save', (_, p) => {
  const data = [p.barcode || null, p.name.trim(), p.category || '', p.vehicle_type || 'سيارات وشاحنات', p.brand || '', Number(p.buy_price)||0, Number(p.sell_price)||0, Math.max(0,parseInt(p.quantity)||0), Math.max(0,parseInt(p.min_quantity)||0), p.location||''];
  if (!p.name || !p.name.trim()) throw new Error('اسم الصنف مطلوب');
  if (p.id) {
    run('UPDATE products SET barcode=?,name=?,category=?,vehicle_type=?,brand=?,buy_price=?,sell_price=?,quantity=?,min_quantity=?,location=? WHERE id=?', ...data, p.id);
    return { id:p.id };
  }
  run('INSERT INTO products (barcode,name,category,vehicle_type,brand,buy_price,sell_price,quantity,min_quantity,location) VALUES (?,?,?,?,?,?,?,?,?,?)', ...data);
  return { id: Number(one('SELECT last_insert_rowid() id').id) };
});
ipcMain.handle('products:delete', (_, id) => run('DELETE FROM products WHERE id=?', Number(id)));
ipcMain.handle('customers:list', () => all('SELECT * FROM customers ORDER BY id DESC'));
ipcMain.handle('customers:save', (_, c) => {
  if (!c.name || !c.name.trim()) throw new Error('اسم الزبون مطلوب');
  run('INSERT INTO customers(name,phone,address) VALUES(?,?,?)', c.name.trim(), c.phone||'', c.address||'');
  return { id: Number(one('SELECT last_insert_rowid() id').id) };
});
ipcMain.handle('sales:create', (_, sale) => {
  if (!Array.isArray(sale.items) || sale.items.length === 0) throw new Error('أضف صنفًا واحدًا على الأقل للفاتورة');
  const insertSale = db.prepare(`INSERT INTO sales(invoice_no,customer_id,customer_name,customer_phone,sale_type,payment_method,total,paid,remaining,note) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  const insertItem = db.prepare('INSERT INTO sale_items(sale_id,product_id,product_name,barcode,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?)');
  const updateStock = db.prepare('UPDATE products SET quantity=quantity-? WHERE id=? AND quantity>=?');
  const transaction = db.transaction(() => {
    let total = 0;
    const prepared = sale.items.map(it => {
      const product = one('SELECT * FROM products WHERE id=?', Number(it.product_id));
      if (!product) throw new Error('أحد الأصناف غير موجود');
      const qty = Math.max(1,parseInt(it.quantity)||1);
      if (product.quantity < qty) throw new Error(`الكمية غير كافية للصنف: ${product.name}`);
      const price = Number(it.unit_price ?? product.sell_price);
      total += qty * price;
      return { product, qty, price };
    });
    const invoiceNo = 'INV-' + new Date().toISOString().replace(/\D/g,'').slice(0,14) + '-' + Math.floor(Math.random()*90+10);
    const paid = Math.max(0,Number(sale.paid)||0);
    const info = insertSale.run(invoiceNo, sale.customer_id || null, sale.customer_name || 'زبون نقدي', sale.customer_phone || '', sale.sale_type || 'نقدي', sale.payment_method || 'نقدي', total, paid, Math.max(0,total-paid), sale.note || '');
    const saleId = Number(info.lastInsertRowid);
    for (const it of prepared) {
      insertItem.run(saleId,it.product.id,it.product.name,it.product.barcode||'',it.qty,it.price,it.qty*it.price);
      const stock = updateStock.run(it.qty,it.product.id,it.qty);
      if (Number(stock.changes) !== 1) throw new Error(`تعذر خصم المخزون للصنف: ${it.product.name}`);
    }
    return { id:saleId, invoice_no:invoiceNo, total, paid, remaining:Math.max(0,total-paid) };
  });
  return transaction();
});
ipcMain.handle('sales:list', (_, q='') => {
  const term = `%${String(q).trim()}%`;
  return all('SELECT * FROM sales WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? ORDER BY id DESC LIMIT 1000',term,term,term);
});
ipcMain.handle('sales:items', (_, id) => all('SELECT * FROM sale_items WHERE sale_id=?', Number(id)));
ipcMain.handle('expenses:list', () => all('SELECT * FROM expenses ORDER BY id DESC LIMIT 500'));
ipcMain.handle('expenses:add', (_, e) => {
  if (!e.title || !e.title.trim()) throw new Error('اسم المصروف مطلوب');
  run('INSERT INTO expenses(title,amount,note) VALUES(?,?,?)',e.title.trim(),Math.max(0,Number(e.amount)||0),e.note||'');
  return { id:Number(one('SELECT last_insert_rowid() id').id) };
});
ipcMain.handle('reports:get', (_, period='month') => {
  let where = "date(created_at)>=date('now','start of month','localtime')";
  if (period === 'today') where = "date(created_at)=date('now','localtime')";
  if (period === 'all') where = '1=1';
  const sales = all(`SELECT * FROM sales WHERE ${where} ORDER BY id DESC`);
  const totals = one(`SELECT COALESCE(SUM(total),0) total,COALESCE(SUM(paid),0) paid,COALESCE(SUM(remaining),0) remaining,COUNT(*) invoices FROM sales WHERE ${where}`);
  const expenses = one(`SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE ${where}`);
  return { sales, totals, expenses: expenses.amount };
});
ipcMain.handle('backup:create', async () => {
  const result = await dialog.showSaveDialog({ title:'حفظ نسخة احتياطية', defaultPath:`Mawja_Backup_${new Date().toISOString().slice(0,10)}.db`, filters:[{name:'SQLite Database',extensions:['db']}] });
  if (result.canceled || !result.filePath) return { canceled:true };
  db.exec('PRAGMA wal_checkpoint(FULL)');
  fs.copyFileSync(path.join(app.getPath('userData'),'mawja_spare_parts.db'),result.filePath);
  return { canceled:false, filePath:result.filePath };
});
ipcMain.handle('backup:restore', async () => {
  const result = await dialog.showOpenDialog({ title:'اختيار نسخة احتياطية', properties:['openFile'], filters:[{name:'SQLite Database',extensions:['db']}] });
  if (result.canceled || !result.filePaths[0]) return { canceled:true };
  try {
    const test = new DatabaseSync(result.filePaths[0]);
    test.prepare('SELECT name FROM sqlite_master LIMIT 1').get();
    test.close();
    db.close();
    fs.copyFileSync(result.filePaths[0],path.join(app.getPath('userData'),'mawja_spare_parts.db'));
    app.relaunch(); app.exit(0);
    return { canceled:false };
  } catch(e) { initDb(); throw new Error('الملف المحدد ليس نسخة SQLite صالحة: '+e.message); }
});
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dbPath:path.join(app.getPath('userData'),'mawja_spare_parts.db') }));
