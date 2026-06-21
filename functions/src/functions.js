const { app } = require('@azure/functions');

app.http('orderProcessor', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    const body = await request.json();
    context.log(`Order received for ${body.customerName || 'guest'}`);

    return {
      status: 200,
      jsonBody: {
        ok: true,
        message: 'Azure Functions で注文を受け付けました',
        customer: body.customerName || 'guest'
      }
    };
  }
});
