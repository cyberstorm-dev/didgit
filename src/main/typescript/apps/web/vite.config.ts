// dotenv not needed - vite handles .env natively
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

function bufferJson(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function devGithubProxy() {
  return {
    name: 'dev-github-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url) return next();
        if (req.method === 'OPTIONS' && req.url.startsWith('/api/github/token')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method === 'POST' && req.url === '/api/github/token') {
          try {
            const body = await bufferJson(req);
            const hasPkce = typeof body?.code_verifier === 'string' && body.code_verifier.length > 0;
            const params = new URLSearchParams();
            if (body?.client_id) params.set('client_id', body.client_id);
            if (body?.code) params.set('code', body.code);
            if (body?.redirect_uri) params.set('redirect_uri', body.redirect_uri);
            if (hasPkce) {
              params.set('code_verifier', body.code_verifier);
              if (process.env.GITHUB_CLIENT_SECRET) params.set('client_secret', process.env.GITHUB_CLIENT_SECRET);
            } else if (process.env.GITHUB_CLIENT_SECRET) {
              params.set('client_secret', process.env.GITHUB_CLIENT_SECRET);
            }
            const gh = await fetch('https://github.com/login/oauth/access_token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
              body: params,
            });
            const json = await gh.json();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(json));
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'proxy_failed', message: e?.message ?? 'unknown' }));
          }
          return;
        }
        next();
      });
    },
  } as const;
}

export default defineConfig({
  plugins: [
    react(),
    devGithubProxy(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Enable polyfill for specific node modules
      protocolImports: true,
    }),
  ],
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: '../../../../../public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

