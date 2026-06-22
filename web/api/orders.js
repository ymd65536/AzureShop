export async function onRequestPost(context) {
  const body = await context.request.json();
  const customerName = body?.customerName || 'guest';

  return new Response(JSON.stringify({
    ok: true,
    message: '注文を受け付けました',
    customer: customerName
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
