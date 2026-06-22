const sql = require('mssql');
const { CosmosClient } = require('@azure/cosmos');

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

async function getProductMap() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    return new Map();
  }

  const client = new CosmosClient({ endpoint, key });
  const { database } = await client.databases.createIfNotExists({ id: process.env.COSMOS_DATABASE || 'shopdb' });
  const { container } = await database.containers.createIfNotExists({
    id: process.env.COSMOS_PRODUCTS_CONTAINER || 'products',
    partitionKey: { paths: ['/category'], kind: 'Hash' }
  });

  const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
  const map = new Map();
  for (const product of resources || []) {
    map.set(String(product.id), product.name || product.id);
  }
  return map;
}

module.exports = async function (context, req) {
  try {
    const sqlConfig = getSqlConfig();
    if (!sqlConfig) {
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { ok: false, message: 'SQL Server 接続情報が未設定です' }
      };
      return;
    }

    const pool = await sql.connect(sqlConfig);
    await ensureOrdersTableSchema(pool);
    const result = await pool.request().query(`
      SELECT TOP 10
        id,
        customerName,
        email,
        address,
        productIds,
        status,
        totalAmount,
        createdAt
      FROM dbo.Orders
      ORDER BY createdAt DESC
    `);
    await pool.close();

    const productMap = await getProductMap();
    const orders = result.recordset.map((order) => {
      const ids = (order.productIds || '').split(',').filter(Boolean);
      const productNames = ids.map((id) => productMap.get(id) || id);
      const totalAmount = Number(order.totalAmount || 0);
      return {
        ...order,
        productNames,
        productLabel: productNames.length > 0 ? productNames.join(', ') : '商品なし',
        totalAmount,
        status: order.status || '新規受付',
        formattedAmount: `¥${totalAmount.toLocaleString('ja-JP')}`
      };
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: orders
    };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: false, message: '注文一覧の取得に失敗しました', error: error.message }
    };
  }
};
