const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    image TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  db.all(`PRAGMA table_info(users)`, (err, cols) => {
    if (err) { console.error('Failed to read users table info', err); return; }
    const hasIsAdmin = Array.isArray(cols) && cols.some(c => c.name === 'is_admin');
    if (!hasIsAdmin) {
      db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (alterErr) => {
        if (alterErr) console.error('Failed to add is_admin column:', alterErr);
      });
    }
  });

  function seedUsers() {
    db.get(`SELECT id FROM users WHERE id = 1`, (e, r) => {
      if (!r) {
        const pw = 'password';
        bcrypt.hash(pw, 10, (he, hash) => {
          if (!he) db.run(`INSERT INTO users(id, name, email, password, is_admin) VALUES(1, 'Demo User', 'demo@example.com', ?, 0)`, [hash]);
        });
      }
    });
    
    const adminEmail = 'admin';
    const adminPw = 'admin';
    db.get(`SELECT id FROM users WHERE email = ?`, [adminEmail], (err, row) => {
      bcrypt.hash(adminPw, 10, (he, hash) => {
        if (he) {
          console.error('Failed hashing admin pw', he);
          return;
        }
        if (!row) {
          db.run(
            `INSERT INTO users(name, email, password, is_admin) VALUES(?, ?, ?, 1)`,
            ['Admin', adminEmail, hash],
            (insErr) => { if (insErr) console.error('Failed to insert admin user', insErr); }
          );
        } else {
          db.run(
            `UPDATE users SET name = ?, password = ?, is_admin = 1 WHERE id = ?`,
            ['Admin', hash, row.id],
            (updErr) => { if (updErr) console.error('Failed to promote/update admin user', updErr); }
          );
        }
      });
    });
  }

  db.all(`PRAGMA table_info(users)`, (err2, cols2) => {
    if (err2) { console.error(err2); } else { seedUsers(); }
  });

  const productsToSeed = [
    { name: 'Kaos Polos', price: 75000, stock: 20, description: 'Kaos katun nyaman untuk sehari-hari', image: '/images/kaos.jpeg' },
    { name: 'Celana Jeans', price: 150000, stock: 15, description: 'Celana jeans biru berkualitas', image: '/images/celanajeans.jpg' },
    { name: 'Sneakers', price: 300000, stock: 10, description: 'Sneakers casual untuk gaya santai', image: '/images/sneakers.jpg' },
    { name: 'Jaket Bomber', price: 250000, stock: 8, description: 'Jaket bomber hangat dan stylish', image: '/images/jaketbomber.jpeg' },
    { name: 'Jam Tangan', price: 500000, stock: 5, description: 'Jam tangan analog elegan', image: '/images/jam-tangan.jpeg' },
    { name: 'Ransel', price: 200000, stock: 12, description: 'Ransel tahan lama untuk kerja/sekolah', image: '/images/ransel.jpg' },
    { name: 'Topi Baseball', price: 60000, stock: 30, description: 'Topi baseball model terbaru', image: '/images/topi-baseball.jpeg' },
    { name: 'Kacamata Hitam', price: 120000, stock: 18, description: 'Kacamata hitam proteksi UV', image: '/images/kacamata-hitam.jpeg' },
    { name: 'Dress Wanita', price: 350000, stock: 6, description: 'Dress cantik untuk acara special', image: '/images/DressWanita.jpeg' },
    { name: 'Rok Mini', price: 90000, stock: 14, description: 'Rok mini nyaman dan trendi', image: '/images/rok-mini.jpeg' },
    { name: 'Kaos Kaki', price: 25000, stock: 50, description: 'Kaos kaki lembut dan awet', image: '/images/kaos-kaki.jpeg' },
    { name: 'Hoodie', price: 180000, stock: 10, description: 'Hoodie hangat dengan desain modern', image: '/images/hoodie.jpeg' },
    { name: 'Sandal Kulit', price: 130000, stock: 9, description: 'Sandal kulit nyaman untuk jalan', image: '/images/sandal-kulit.jpeg' },
    { name: 'Sabuk Kulit', price: 80000, stock: 20, description: 'Sabuk kulit asli berkualitas', image: '/images/sabuk-kulit.jpeg' },
    { name: 'Laptop Sleeve', price: 110000, stock: 11, description: 'Pelindung laptop dengan padding', image: '/images/laptop-sleeve.jpeg' }
  ];
  
  db.serialize(() => {
    productsToSeed.forEach(p => {
      db.get(`SELECT id, image, price, stock, description FROM products WHERE name = ?`, [p.name], (gErr, existing) => {
        if (gErr) {
          console.error('Error checking product', p.name, gErr);
          return;
        }
        if (!existing) {
          db.run(
            `INSERT INTO products(name, price, stock, description, image) VALUES(?, ?, ?, ?, ?)`,
            [p.name, p.price, p.stock, p.description, p.image],
            (insErr) => { if (insErr) console.error('Failed to insert product', p.name, insErr); }
          );
        } else {
          const needUpdate =
            (!existing.image && p.image) ||
            (existing.image && p.image && existing.image !== p.image) ||
            existing.price !== p.price ||
            existing.stock !== p.stock ||
            (existing.description || '') !== (p.description || '');
          if (needUpdate) {
            db.run(
              `UPDATE products SET price = ?, stock = ?, description = ?, image = ? WHERE id = ?`,
              [p.price, p.stock, p.description, p.image, existing.id],
              (updErr) => { if (updErr) console.error('Failed to update product', p.name, updErr); }
            );
          }
        }
      });
    });

    db.run(`UPDATE products SET image = '/images/kaos-polos.jpg' WHERE name = 'Kaos Polos' AND (image IS NULL OR image LIKE '%kaospolos%')`, (fixErr) => {
      if (fixErr) console.error('Failed to fix kaos polos image path', fixErr);
    });
  });

  function ensureTransactionItemsFk() {
    db.serialize(() => {
      db.all(`PRAGMA foreign_key_list(transaction_items)`, (err, rows) => {
        if (err) { console.error('Failed to read foreign_key_list for transaction_items', err); return; }

        const prodFk = Array.isArray(rows) && rows.find(r => r.table === 'products');
        const needsRecreate = !prodFk || (prodFk.on_delete && prodFk.on_delete.toUpperCase() !== 'SET NULL');

        if (!needsRecreate) {
          return;
        }

        console.log('Migrating transaction_items to include product_name and use ON DELETE SET NULL (preserve history)...');

        db.run('PRAGMA foreign_keys = OFF', (fkOffErr) => {
          if (fkOffErr) console.error('Failed to disable foreign_keys for migration', fkOffErr);

          db.run(`CREATE TABLE IF NOT EXISTS transaction_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
          )`, (createErr) => {
            if (createErr) {
              console.error('Failed to create transaction_items_new', createErr);
              db.run('PRAGMA foreign_keys = ON');
              return;
            }

            db.run(`INSERT INTO transaction_items_new(id, transaction_id, product_id, product_name, quantity, price)
                    SELECT ti.id, ti.transaction_id, ti.product_id, p.name AS product_name, ti.quantity, ti.price
                    FROM transaction_items ti LEFT JOIN products p ON ti.product_id = p.id`, (copyErr) => {
              if (copyErr) {
                console.error('Failed to copy transaction_items data', copyErr);
                db.run('PRAGMA foreign_keys = ON');
                return;
              }

              db.run(`DROP TABLE transaction_items`, (dropErr) => {
                if (dropErr) {
                  console.error('Failed to drop old transaction_items', dropErr);
                  db.run('PRAGMA foreign_keys = ON');
                  return;
                }
                db.run(`ALTER TABLE transaction_items_new RENAME TO transaction_items`, (renameErr) => {
                  if (renameErr) {
                    console.error('Failed to rename transaction_items_new', renameErr);
                    db.run('PRAGMA foreign_keys = ON');
                    return;
                  }
                  db.run('PRAGMA foreign_keys = ON', (fkOnErr) => {
                    if (fkOnErr) console.error('Failed to re-enable foreign_keys after migration', fkOnErr);
                    else console.log('transaction_items migration completed: product_name added and ON DELETE SET NULL active.');
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  ensureTransactionItemsFk();

  function ensureTransactionItemsProductName() {
    db.all(`PRAGMA table_info(transaction_items)`, (err, cols) => {
      if (err) {
        console.error('Failed to read transaction_items table info', err);
        return;
      }
      const hasProductName = Array.isArray(cols) && cols.some(c => c.name === 'product_name');
      if (!hasProductName) {
        console.log('Adding product_name column to transaction_items (migration)...');
        db.run(`ALTER TABLE transaction_items ADD COLUMN product_name TEXT`, (addErr) => {
          if (addErr) {
            console.error('Failed to add product_name column:', addErr);
            return;
          }
          db.run(
            `UPDATE transaction_items
             SET product_name = (
               SELECT name FROM products WHERE products.id = transaction_items.product_id
             )
             WHERE product_name IS NULL`,
            (updErr) => {
              if (updErr) console.error('Failed to populate product_name in transaction_items:', updErr);
              else console.log('Populated product_name for existing transaction_items rows.');
            }
          );
        });
      }
    });
  }

  ensureTransactionItemsProductName();

});

module.exports = db;
