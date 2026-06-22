const http = require('http');
const fs = require('fs');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');
const sql = require('mssql');

const port = process.env.PORT || 8080;
const publicDir = path.join(__dirname, 'public');
const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
const cosmosKey = process.env.COSMOS_KEY;
const cosmosDatabaseId = process.env.COSMOS_DATABASE || 'shopdb';
const cosmosOrdersContainerId = process.env.COSMOS_CONTAINER || 'orders';
const cosmosProductsContainerId = process.env.COSMOS_PRODUCTS_CONTAINER || 'products';
const cosmosClient = cosmosEndpoint && cosmosKey ? new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey }) : null;
const sqlConfig = process.env.SQL_SERVER && process.env.SQL_USER && process.env.SQL_PASSWORD && process.env.SQL_DATABASE
  ? {
      server: process.env.SQL_SERVER,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DATABASE,
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    }
  : null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const fallbackProducts = [
  { id: 1, name: 'Azure Hoodie', price: 4800, description: 'クラウドを愛するための限定デザイン' },
  { id: 2, name: 'Cloud Mug', price: 1800, description: 'コーヒータイムをもっと快適に' },
  { id: 3, name: 'Smart Speaker', price: 12800, description: '音声で家電を制御するデモ向けガジェット' }
];

async function ensureCosmosProducts() {
  if (!cosmosClient) {
    return fallbackProducts;
  }

  const { database } = await cosmosClient.databases.createIfNotExists({ id: cosmosDatabaseId });
  const { container } = await database.containers.createIfNotExists({
    id: cosmosProductsContainerId,
    partitionKey: { paths: ['/category'], kind: 'Hash' }
  });

  const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
  if (resources && resources.length > 0) {
    return resources;
  }

  const seedProducts = fallbackProducts.map((product) => ({
    id: `${product.id}`,
    category: 'demo',
    name: product.name,
    price: product.price,
    description: product.description
  }));

  for (const product of seedProducts) {
    await container.items.create(product);
  }

  return seedProducts;
}

async function ensureSqlOrdersTable() {
  if (!sqlConfig) {
    return;
  }

  const pool = await sql.connect(sqlConfig);
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Orders (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        customerName NVARCHAR(200) NOT NULL,
        email NVARCHAR(200) NULL,
        address NVARCHAR(500) NULL,
        productIds NVARCHAR(500) NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);
  await pool.close();
}

async function writeOrderToSql(payload) {
  if (!sqlConfig) {
    throw new Error('SQL Server connection settings are not configured');
  }

  const pool = await sql.connect(sqlConfig);
  await pool.request()
    .input('customerName', sql.NVarChar(200), payload.customerName || 'ゲスト')
    .input('email', sql.NVarChar(200), payload.email || '')
    .input('address', sql.NVarChar(500), payload.address || '')
    .input('productIds', sql.NVarChar(500), payload.productIds || '')
    .query(`
      INSERT INTO dbo.Orders (customerName, email, address, productIds)
      VALUES (@customerName, @email, @address, @productIds)
    `);
  await pool.close();
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', service: 'Azure Shop Demo' }));
    return;
  }

  if (req.url === '/api/products') {
    (async () => {
      try {
        const products = await ensureCosmosProducts();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(products));
      } catch (error) {
        console.error('Failed to load products:', error);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, message: '商品情報の取得に失敗しました' }));
      }
    })();
    return;
  }

  if (req.url === '/api/checkout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const payload = body ? JSON.parse(body) : {};

      try {
        await ensureSqlOrdersTable();
        await writeOrderToSql(payload);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: true,
          message: '注文を受け付けました',
          customer: payload.customerName || 'ゲスト'
        }));
      } catch (error) {
        console.error('Order write failed:', error);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          message: '注文保存に失敗しました',
          error: error.message
        }));
      }
    });
    return;
  }

  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, requestPath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(port, () => {
  console.log(`Azure Shop demo is running on port ${port}`);
});
