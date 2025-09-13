const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/proxy', (req, res) => {
  const targetUrl = req.body.url;
  if (!targetUrl) {
    return res.status(400).send('URLが入力されていません。');
  }
  // URLをエンコードして安全にリダイレクト
  res.redirect(`/proxy/${encodeURIComponent(targetUrl)}`);
});

// プロキシリクエストを処理する動的ルート
app.use('/proxy/:targetUrl*', (req, res, next) => {
  const targetUrl = decodeURIComponent(req.params.targetUrl);
  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    selfHandleResponse: true, // レスポンスを自分で処理
    onProxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'];

      // HTMLコンテンツのみを書き換え
      if (contentType && contentType.includes('text/html')) {
        let body = [];
        proxyRes.on('data', (chunk) => {
          body.push(chunk);
        });
        proxyRes.on('end', () => {
          body = Buffer.concat(body).toString();
          
          // すべての相対パスをプロキシURLに書き換え
          // src="/..." -> src="/proxy/original-url/..."
          // href="/..." -> href="/proxy/original-url/..."
          const modifiedBody = body.replace(/(href|src|action)=["'](\/(?!\/))/g, `$1="/proxy/${encodeURIComponent(targetUrl)}/`);
          
          // レスポンスヘッダーを修正してクライアントに送信
          res.setHeader('content-length', Buffer.byteLength(modifiedBody));
          res.end(modifiedBody);
        });
      } else {
        // HTML以外のコンテンツ（CSS, JS, 画像など）はそのままパイプ
        proxyRes.pipe(res);
      }
    },
    onError: (err, req, res) => {
      console.error('Proxy Error:', err);
      res.status(500).send('プロキシエラーが発生しました。');
    }
  });
  
  // プロキシリクエストを送信
  proxy(req, res, next);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});
