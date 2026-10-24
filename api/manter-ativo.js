// api/manter-ativo.js
// Chamado todo dia pelo Cron da Vercel (ver vercel.json) para o Supabase do plano
// grátis não pausar por inatividade (ele pausa depois de 7 dias sem uso).
// Faz uma consulta leve no banco usando só a chave anon, que já é pública no site.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://faccbfidybfsoplaeqjw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2NiZmlkeWJmc29wbGFlcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTY4ODYsImV4cCI6MjA5Njc5Mjg4Nn0.SNPbyvdHeICpuswamoUeJ-bAUtMosv7RvlVoxYyOTc8';

export default async function handler(req, res) {
    try {
        // Com o RLS a resposta vem vazia, mas a consulta roda no Postgres e conta como uso
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/convidados_lista?select=id&limit=1`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        res.status(resp.ok ? 200 : 502).json({ ok: resp.ok, supabase_status: resp.status, em: new Date().toISOString() });
    } catch (err) {
        res.status(502).json({ ok: false, error: String(err) });
    }
}
