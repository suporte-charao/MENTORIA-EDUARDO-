// Configuração do envio das inscrições.
// Enquanto SUPABASE_URL estiver vazio, o formulário roda em modo de teste:
// valida, mostra a tela de sucesso e só registra os dados no console.
window.APP_CONFIG = {
  SUPABASE_URL: '',       // ex.: https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: '',  // chave pública "anon" (protegida pelas policies RLS)
  TABELA: 'inscricoes'
};
