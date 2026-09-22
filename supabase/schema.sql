-- Tabela das pré-inscrições do Método Charão.
-- Rodar no SQL Editor do Supabase quando for ligar o envio.
create table if not exists public.inscricoes (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  nome          text not null,
  telefone      text not null,
  email         text not null,
  empresa       text not null,
  cargo         text not null,
  cidade        text not null,
  estado        text not null,
  faturamento   text not null,
  funcionarios  text not null,
  problemas     text not null,
  aprender      text not null,
  dificuldades  text not null,
  consentimento boolean not null check (consentimento)
);

alter table public.inscricoes enable row level security;

-- O site (chave anon) só pode INSERIR. Ler as inscrições exige login/service role.
create policy "site pode inserir" on public.inscricoes
  for insert to anon with check (true);
