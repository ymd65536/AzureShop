const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8080;
const publicDir = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const products = [
  { id: 1, name: 'Azure Hoodie', price: 4800, description: 'クラウドを愛するための限定デザイン' },
  { id: 2, name: 'Cloud Mug', price: 1800, description: 'コーヒータイムをもっと快適に' },
  { id: 3, name: 'Smart Speaker', price: 12800, description: '音声で家電を制御するデモ向けガジェット' }
];

const server = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', service: 'Azure Shop Demo' }));
    return;
  }

  if (req.url === '/api/products') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(products));
    return;
  }

  if (req.url === '/api/checkout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const payload = body ? JSON.parse(body) : {};
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        message: '注文を受け付けました',
        customer: payload.customerName || 'ゲスト',
        function: 'Azure Functions で注文処理を実行する構成です'
      }));
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
