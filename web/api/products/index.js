const { CosmosClient } = require('@azure/cosmos');

const fallbackProducts = [
  { id: 1, name: 'Azure Hoodie', price: 4800, description: 'クラウドを愛するための限定デザイン' },
  { id: 2, name: 'Cloud Mug', price: 1800, description: 'コーヒータイムをもっと快適に' },
  { id: 3, name: 'Smart Speaker', price: 12800, description: '音声で家電を制御するデモ向けガジェット' }
];

module.exports = async function (context, req) {
  try {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseId = process.env.COSMOS_DATABASE || 'shopdb';
    const containerId = process.env.COSMOS_PRODUCTS_CONTAINER || 'products';

    if (!endpoint || !key) {
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: fallbackProducts
      };
      return;
    }

    const client = new CosmosClient({ endpoint, key });
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({
      id: containerId,
      partitionKey: { paths: ['/category'], kind: 'Hash' }
    });

    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    let products = resources && resources.length > 0 ? resources : [];

    if (products.length === 0) {
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

      products = seedProducts;
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: products
    };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { ok: false, message: '商品情報の取得に失敗しました', error: error.message }
    };
  }
};