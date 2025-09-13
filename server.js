const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index', { url: null });
});

app.post('/proxy', (req, res) => {
  const targetUrl = req.body.url;
  if (!targetUrl) {
    return res.status(400).send('URLが入力されていません。');
  }

  // プロキシミドルウェアを動的に作成
  const proxyMiddleware = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    selfHandleResponse: true, // レスポンスを自分で処理
    onProxyReq: (proxyReq, req, res) => {
      // ユーザーのURL入力フォームへのPOSTリクエストを無視
      if (req.method === 'POST' && req.originalUrl === '/proxy') {
        proxyReq.destroy();
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // レスポンスのコンテンツタイプをチェック
      const contentType = proxyRes.headers['content-type'];
      if (contentType && contentType.includes('text/html')) {
        let body = [];
        proxyRes.on('data', (chunk) => {
          body.push(chunk);
        });
        proxyRes.on('end', () => {
          body = Buffer.concat(body).toString();
          // ここでHTMLの書き換えを行う
          const modifiedBody = body.replace(/href="\//g, `href="/proxy/${targetUrl.replace(/\/$/, '')}/"`)
                                    .replace(/src="\//g, `src="/proxy/${targetUrl.replace(/\/$/, '')}/"`);
          res.setHeader('content-length', Buffer.byteLength(modifiedBody));
          res.end(modifiedBody);
        });
      } else {
        // HTML以外のコンテンツはそのまま送信
        proxyRes.pipe(res);
      }
    }
  });

  // URLに基づいて動的なルートを設定
  app.use('/proxy/:url*', (req, res, next) => {
    proxyMiddleware(req, res, next);
  });

  // プロキシしたページを表示
  res.redirect(`/proxy/${targetUrl}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});
