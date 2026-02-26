/**
 * 로컬 개발 시 CORS 우회용 프록시
 * 사용법: npm run dev
 * 브라우저에서 http://localhost:8081 접속
 */
const http = require('http');
const https = require('https');

const EXPO_PORT = 19006;
const PROXY_PORT = 8081;
const API_TARGET = 'https://roulette-app-two.vercel.app';

const server = http.createServer((clientReq, clientRes) => {
    const url = new URL(clientReq.url || '', `http://localhost:${PROXY_PORT}`);
    const isApi = url.pathname.startsWith('/api/');

    if (isApi) {
        const targetUrl = `${API_TARGET}${url.pathname}${url.search}`;
        const proxyReq = https.request(targetUrl, {
            method: clientReq.method,
            headers: { ...clientReq.headers, host: new URL(API_TARGET).host },
        }, (proxyRes) => {
            clientRes.writeHead(proxyRes.statusCode || 200, {
                ...proxyRes.headers,
                'Access-Control-Allow-Origin': '*',
            });
            proxyRes.pipe(clientRes);
        });
        proxyReq.on('error', (e) => {
            console.error('Proxy error:', e.message);
            clientRes.writeHead(502);
            clientRes.end('Proxy error');
        });
        clientReq.pipe(proxyReq);
    } else {
        const proxyReq = http.request({
            host: 'localhost',
            port: EXPO_PORT,
            path: clientReq.url,
            method: clientReq.method,
            headers: clientReq.headers,
        }, (proxyRes) => {
            clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(clientRes);
        });
        proxyReq.on('error', (e) => {
            console.error('Expo proxy error:', e.message);
            clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
            clientRes.end(`Expo not running? Start with: npx expo start --web\nError: ${e.message}`);
        });
        clientReq.pipe(proxyReq);
    }
});

server.listen(PROXY_PORT, () => {
    console.log(`\n🔀 Dev proxy: http://localhost:${PROXY_PORT}`);
    console.log(`   /api/* → ${API_TARGET}/api/*`);
    console.log(`   /*     → http://localhost:${EXPO_PORT}\n`);
    console.log('먼저 다른 터미널에서 실행: npx expo start --web --port ' + EXPO_PORT + '\n');
});
