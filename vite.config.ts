import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

let devAuthPool: any = null;

const DEFAULT_DB_URL = 'postgresql://postgres.hxnndpuwvxcqvvztcbvj:MQ6i84OTDBedxW3X@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

function getAuthPool(pg: any) {
  if (!devAuthPool) {
    devAuthPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || DEFAULT_DB_URL,
      max: 5,
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false }
    });
  }
  return devAuthPool;
}

function devAuthPlugin() {
  return {
    name: 'dev-auth-plugin',
    configureServer(server) {
      server.middlewares.use('/api/dev-login', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { email, password } = JSON.parse(body || '{}');
            const cleanEmail = (email || '').trim().toLowerCase();
            const { default: pg } = await import('pg');
            const pool = getAuthPool(pg);
            const client = await pool.connect();
            try {
              const userQuery = await client.query(
                `SELECT id, email, confirmed_at, 
                        (encrypted_password = extensions.crypt($1, encrypted_password)) as valid
                 FROM auth.users 
                 WHERE email ILIKE $2`,
                [password, cleanEmail]
              );
              if (userQuery.rows.length === 0 || !userQuery.rows[0].valid) {
                res.statusCode = 401;
                return res.end(JSON.stringify({ error: 'Invalid login credentials' }));
              }

              const dbUser = userQuery.rows[0];
              const profileQuery = await client.query('SELECT * FROM public.profiles WHERE id = $1', [dbUser.id]);
              const rolesQuery = await client.query('SELECT role FROM public.user_roles WHERE user_id = $1', [dbUser.id]);

              const profile = profileQuery.rows[0] || {
                id: dbUser.id,
                email: dbUser.email,
                full_name: dbUser.email.split('@')[0],
                is_active: true
              };
              const roles = rolesQuery.rows.map((r: any) => r.role);

              const user = {
                id: dbUser.id,
                email: dbUser.email,
                user_metadata: { full_name: profile.full_name },
                aud: 'authenticated',
                role: 'authenticated',
                created_at: new Date().toISOString()
              };

              const session = {
                access_token: 'dev-session-' + dbUser.id + '-' + Date.now(),
                token_type: 'bearer',
                expires_in: 3600 * 24 * 30,
                expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
                refresh_token: 'dev-refresh-' + dbUser.id,
                user
              };

              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, user, profile, roles, session }));
            } finally {
              client.release();
            }
          } catch (err: any) {
            console.error('Dev auth error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message || 'Server error' }));
          }
        });
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    cors: true,
  },
  plugins: [devAuthPlugin(), react(), mode === "development" && componentTagger(), mcpPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent multiple React copies (fixes "Cannot read properties of null (reading 'useEffect')")
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf') || id.includes('canvg')) return 'vendor-jspdf';
            if (id.includes('html2canvas')) return 'vendor-html2canvas';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('date-fns')) return 'vendor-date-fns';
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
}));
