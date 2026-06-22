const { CosmosClient } = require('@azure/cosmos');
const sql = require('mssql');

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

async function writeOrderToSql(payload) {
  const sqlConfig = getSqlConfig();
  if (!sqlConfig) {
    throw new Error('SQL Server connection settings are not configured');
  }

  const pool = await sql.connect(sqlConfig);
  await ensureOrdersTableSchema(pool);
  await pool.request()
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
  await pool.close();
}

async function writeOrderToCosmos(payload) {
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

  await container.items.create(item);
  return item;
}

function getStorageMode() {
  return {
    orders: 'SQL Server',
    products: 'Cosmos DB'
  };
}

module.exports = async function (context, req) {
  try {
    const body = req.body || {};

    try {
      await writeOrderToSql(body);
    } catch (sqlError) {
      if (sqlError.message.includes('SQL Server connection settings')) {
        const item = await writeOrderToCosmos(body);
        context.res = {
          status: 200,
          body: {
            ok: true,
            message: '注文を受け付けました',
            customer: item.customerName
          }
        };
        return;
      }

      throw sqlError;
    }

    context.res = {
      status: 200,
      body: {
        ok: true,
        message: '注文を受け付けました',
        customer: body.customerName || 'ゲスト',
        storage: getStorageMode()
      }
    };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: 500,
      body: {
        ok: false,
        message: '注文の保存に失敗しました',
        error: error.message
      }
    };
  }
};
