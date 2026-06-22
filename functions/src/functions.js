const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE || 'shopdb';
const containerId = process.env.COSMOS_CONTAINER || 'orders';

const client = endpoint && key ? new CosmosClient({ endpoint, key }) : null;

app.http('orderProcessor', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    const body = await request.json();
    context.log(`Order received for ${body.customerName || 'guest'}`);

    if (!client) {
      return {
        status: 200,
        jsonBody: {
          ok: true,
          message: 'Cosmos DB 接続情報が未設定のため、ダミー応答です',
          customer: body.customerName || 'guest'
        }
      };
    }

    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({ id: containerId, partitionKey: { paths: ['/customerId'], kind: 'Hash' } });

    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      customerId: body.email || 'guest',
      customerName: body.customerName || 'guest',
      email: body.email || '',
      address: body.address || '',
      createdAt: new Date().toISOString()
    };

    await container.items.create(item);

    return {
      status: 200,
      jsonBody: {
        ok: true,
        message: 'Azure Functions で注文を Cosmos DB に保存しました',
        customer: item.customerName
      }
    };
  }
});
