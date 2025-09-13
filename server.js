const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// Root route to show the URL input form
app.get('/', (req, res) => {
  // 初回アクセス時はurlを空としてテンプレートをレンダリング
  res.render('index', { url: null });
});

// Post route to handle the URL submission and render the page with iframe
app.post('/proxy', (req, res) => {
  const targetUrl = req.body.url;
  if (!targetUrl) {
    return res.status(400).send('URLが入力されていません。');
  }
  // URLをテンプレートに渡し、iframeで表示させる
  res.render('index', { url: targetUrl });
});

// Dynamic proxy route to handle all proxied requests
app.use('/proxy/:targetUrl*', (req, res, next) => {
  const targetUrl = decodeURIComponent(req.params.targetUrl);
  
  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    selfHandleResponse: true,
    onProxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'];
      
      // Rewrite HTML content
      if (contentType && contentType.includes('text/html')) {
        let body = [];
        proxyRes.on('data', (chunk) => {
          body.push(chunk);
        });
        proxyRes.on('end', () => {
          body = Buffer.concat(body).toString();
          
          const modifiedBody = body.replace(/(href|src|action)=["'](\/(?!\/))/g, `$1="/proxy/${encodeURIComponent(targetUrl)}/`);
          
          res.setHeader('content-length', Buffer.byteLength(modifiedBody));
          res.end(modifiedBody);
        });
      } else {
        // Pipe other content types directly
        proxyRes.pipe(res);
      }
    },
    onError: (err, req, res) => {
      console.error('Proxy Error:', err);
      res.status(500).send('プロキシエラーが発生しました。');
    }
  });
  
  proxy(req, res, next);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});
