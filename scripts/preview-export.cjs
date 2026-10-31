const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.cwd(), 'out');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const contentTypes = {
  '.css': 'text/css;charset=utf-8',
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

if (!fs.existsSync(root)) {
  console.error('Export directory not found. Run "pnpm build" first.');
  process.exit(1);
}

http
  .createServer((request, response) => {
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);

    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const candidate = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
      ? path.join(filePath, 'index.html')
      : filePath;

    fs.readFile(candidate, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(candidate)] || 'application/octet-stream',
      });
      response.end(data);
    });
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Static export preview: http://127.0.0.1:${port}/`);
  });
