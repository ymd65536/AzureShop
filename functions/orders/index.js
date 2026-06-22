const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseId = process.env.COSMOS_DATABASE || 'shopdb';
    const containerId = process.env.COSMOS_CONTAINER || 'orders';

    if (!endpoint || !key) {
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { ok: false, message: 'Cosmos DB 接続情報が未設定です', customer: body.customerName || 'guest' }
      };
      return;
    }

    const client = new CosmosClient({ endpoint, key });
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({
      id: containerId,
      partitionKey: { paths: ['/customerId'], kind: 'Hash' }
    });

    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      customerId: body.email || 'guest',
      customerName: body.customerName || 'guest',
      email: body.email || '',
      address: body.address || '',
      createdAt: new Date().toISOString()
    };

    await container.items.create(item);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: true, message: 'Azure Functions で注文を Cosmos DB に保存しました', customer: item.customerName }
    };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: false, message: '注文保存に失敗しました', error: error.message }
    };
  }
};
