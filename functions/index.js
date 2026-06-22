const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const sql = require('mssql');

const fallbackProducts = [
  { id: 1, name: 'Azure Hoodie', price: 4800, description: 'クラウドを愛するための限定デザイン' },
  { id: 2, name: 'Cloud Mug', price: 1800, description: 'コーヒータイムをもっと快適に' },
  { id: 3, name: 'Smart Speaker', price: 12800, description: '音声で家電を制御するデモ向けガジェット' }
];

function getSqlConfig() {
  if (!process.env.SQL_SERVER || !process.env.SQL_USER || !process.env.SQL_PASSWORD || !process.env.SQL_DATABASE) {
    return null;
  }

  return {
    server: process.env.SQL_SERVER,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  };
}

async function ensureOrdersTableSchema(pool) {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Orders (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        customerName NVARCHAR(200) NOT NULL,
        email NVARCHAR(200) NULL,
        address NVARCHAR(500) NULL,
        productIds NVARCHAR(500) NULL,
        status NVARCHAR(50) NULL,
        totalAmount INT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
    ELSE
    BEGIN
      IF COL_LENGTH('dbo.Orders', 'status') IS NULL
        ALTER TABLE dbo.Orders ADD status NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.Orders', 'totalAmount') IS NULL
        ALTER TABLE dbo.Orders ADD totalAmount INT NULL;
    END
  `);
}

async function writeOrderToSql(payload, context) {
  const sqlConfig = getSqlConfig();
  if (!sqlConfig) {
    throw new Error('SQL Server connection settings are not configured');
  }

  const pool = await sql.connect(sqlConfig);
  try {
    await ensureOrdersTableSchema(pool);
    const result = await pool.request()
      .input('customerName', sql.NVarChar(200), payload.customerName || 'ゲスト')
      .input('email', sql.NVarChar(200), payload.email || '')
      .input('address', sql.NVarChar(500), payload.address || '')
      .input('productIds', sql.NVarChar(500), payload.productIds || '')
      .input('status', sql.NVarChar(50), payload.status || '新規受付')
      .input('totalAmount', sql.Int, Number(payload.totalAmount || 0))
      .query(`
        INSERT INTO dbo.Orders (customerName, email, address, productIds, status, totalAmount)
        VALUES (@customerName, @email, @address, @productIds, @status, @totalAmount)
      `);
    context?.log(`SQL write succeeded: rows=${result.rowsAffected?.[0] || 0}`);
    return result;
  } catch (error) {
    context?.error(`SQL write failed: ${error.message}`);
    throw error;
  } finally {
    await pool.close().catch(() => {});
  }
}

async function writeOrderToCosmos(payload, context) {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE || 'shopdb';
  const containerId = process.env.COSMOS_CONTAINER || 'orders';

  if (!endpoint || !key) {
    throw new Error('Cosmos DB 接続情報が未設定です');
  }

  const client = new CosmosClient({ endpoint, key });
  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: ['/customerId'], kind: 'Hash' }
  });

  const item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    customerId: payload.email || 'guest',
    customerName: payload.customerName || 'guest',
    email: payload.email || '',
    address: payload.address || '',
    createdAt: new Date().toISOString()
  };

  try {
    const { resource } = await container.items.create(item);
    context?.log(`Cosmos write succeeded: id=${resource?.id || item.id}`);
    return resource || item;
  } catch (error) {
    context?.error(`Cosmos write failed: ${error.message}`);
    throw error;
  }
}

async function listOrdersFromSql() {
  const sqlConfig = getSqlConfig();
  if (!sqlConfig) {
    return [];
  }

  const pool = await sql.connect(sqlConfig);
  const result = await pool.request().query(`
    SELECT TOP 50 id, customerName, email, address, productIds, status, totalAmount, createdAt
    FROM dbo.Orders
    ORDER BY createdAt DESC
  `);
  await pool.close();

  return (result.recordset || []).map((order) => ({
    ...order,
    id: order.id?.toString?.() || order.id,
    productLabel: order.productIds || '商品',
    formattedAmount: `¥${Number(order.totalAmount || 0).toLocaleString('ja-JP')}`,
    createdAt: order.createdAt?.toISOString ? order.createdAt.toISOString() : order.createdAt
  }));
}

async function getProductsFromCosmos() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE || 'shopdb';
  const containerId = process.env.COSMOS_PRODUCTS_CONTAINER || 'products';

  if (!endpoint || !key) {
    return fallbackProducts;
  }

  const client = new CosmosClient({ endpoint, key });
  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  const { container } = await database.containers.createIfNotExists({
    id: containerId,
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

app.http('products', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'products',
  handler: async (_request, context) => {
    try {
      const products = await getProductsFromCosmos();
      return { status: 200, jsonBody: products };
    } catch (error) {
      context.error('Product loading failed', error);
      return { status: 500, jsonBody: { ok: false, message: '商品情報の取得に失敗しました', error: error.message } };
    }
  }
});

app.http('checkout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'checkout',
  handler: async (request, context) => {
    let body = {};
    try {
      body = await request.json().catch(() => ({}));
      context.log(`Checkout request started for ${body.customerName || 'guest'}`);

      try {
        await writeOrderToSql(body, context);
      } catch (sqlError) {
        context.warn(`SQL write unavailable, falling back to Cosmos: ${sqlError.message}`);
        if (sqlError.message.includes('SQL Server connection settings')) {
          const item = await writeOrderToCosmos(body, context);
          return {
            status: 200,
            jsonBody: {
              ok: true,
              message: '注文を受け付けました',
              customer: item.customerName
            }
          };
        }
        throw sqlError;
      }

      context.log(`Checkout succeeded for ${body.customerName || 'guest'}`);
      return {
        status: 200,
        jsonBody: {
          ok: true,
          message: '注文を受け付けました',
          customer: body.customerName || 'ゲスト',
          storage: { orders: 'SQL Server', products: 'Cosmos DB' }
        }
      };
    } catch (error) {
      context.error(`Checkout failed for ${body?.customerName || 'guest'}`, error);
      context.error(`Checkout failure details: ${JSON.stringify({
        customerName: body?.customerName || 'guest',
        email: body?.email || '',
        address: body?.address || '',
        productIds: body?.productIds || '',
        totalAmount: body?.totalAmount || 0,
        status: body?.status || '新規受付',
        message: error.message
      })}`);
      return { status: 500, jsonBody: { ok: false, message: '注文の保存に失敗しました', error: error.message } };
    }
  }
});

app.http('orders', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    if (request.method === 'GET') {
      try {
        const orders = await listOrdersFromSql();
        return { status: 200, jsonBody: orders };
      } catch (error) {
        context.error('Order listing failed', error);
        return { status: 500, jsonBody: { ok: false, message: '注文一覧の取得に失敗しました', error: error.message } };
      }
    }

    let body = {};
    try {
      body = await request.json().catch(() => ({}));
      try {
        await writeOrderToSql(body, context);
      } catch (sqlError) {
        context.warn(`SQL write unavailable, falling back to Cosmos: ${sqlError.message}`);
        if (sqlError.message.includes('SQL Server connection settings')) {
          const item = await writeOrderToCosmos(body, context);
          return {
            status: 200,
            jsonBody: {
              ok: true,
              message: '注文を受け付けました',
              customer: item.customerName
            }
          };
        }
        throw sqlError;
      }

      return {
        status: 200,
        jsonBody: {
          ok: true,
          message: '注文を受け付けました',
          customer: body.customerName || 'ゲスト'
        }
      };
    } catch (error) {
      context.error(`Order processing failed for ${body?.customerName || 'guest'}`, error);
      context.error(`Order failure details: ${JSON.stringify({
        customerName: body?.customerName || 'guest',
        email: body?.email || '',
        address: body?.address || '',
        productIds: body?.productIds || '',
        totalAmount: body?.totalAmount || 0,
        status: body?.status || '新規受付',
        message: error.message
      })}`);
      return { status: 500, jsonBody: { ok: false, message: '注文の保存に失敗しました', error: error.message } };
    }
  }
});
