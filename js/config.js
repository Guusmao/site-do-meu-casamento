// js/config.js
// Endereço e chave pública (anon) do Supabase usados pelo site, pela portaria e pelo admin.
// A chave anon é pública por design: quem protege os dados é o RLS + as Edge Functions.
//
// Para testar no seu computador (Supabase local, ver TESTE_LOCAL.md), crie o arquivo
// js/config.local.js (ele não vai para o GitHub) com:
//   window.SUPABASE_CONFIG = { url: 'http://127.0.0.1:54321', anonKey: '<chave do supabase status>' };
// Ele só é carregado quando o site é aberto em localhost / 127.0.0.1.

window.SUPABASE_CONFIG = {
    url: 'https://faccbfidybfsoplaeqjw.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2NiZmlkeWJmc29wbGFlcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTY4ODYsImV4cCI6MjA5Njc5Mjg4Nn0.SNPbyvdHeICpuswamoUeJ-bAUtMosv7RvlVoxYyOTc8'
};

if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    document.write('<script src="js/config.local.js"><\/script>');
}
