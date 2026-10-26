// Vercel Serverless Function for /api/health

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasSupabase = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  const hasPostgres = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);

  let source = 'Modo Vista Previa (Memoria Local)';
  if (hasKv) source = 'Vercel KV (Redis)';
  else if (hasUpstash) source = 'Upstash Redis';
  else if (hasSupabase) source = 'Supabase Cloud';
  else if (hasPostgres) source = 'Vercel Postgres';

  return res.status(200).json({
    success: true,
    status: 'ok',
    connected: true,
    dbSource: source,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel_production' : 'development',
    storageProviders: {
      kv: hasKv,
      upstash: hasUpstash,
      supabase: hasSupabase,
      postgres: hasPostgres,
    },
  });
}
