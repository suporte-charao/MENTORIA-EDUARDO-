# Método Charão — Pré-inscrição

Landing page de pré-inscrição do Programa de Aceleração e Implementação do Método Charão.
Site estático (HTML + CSS + JS, sem build).

## Estrutura

```
index.html
assets/css/style.css
assets/js/config.js      ← credenciais do Supabase (vazio = modo teste)
assets/js/inscricao.js   ← único ponto de envio dos dados
assets/js/main.js        ← máscara, validação, progresso, tela de sucesso
assets/img/              ← logos e foto (webp)
supabase/schema.sql      ← tabela + RLS (rodar no Supabase)
.htaccess                ← HTTPS e cache na Hostinger
```

## Rodar localmente

```bash
python -m http.server 8080
```

Abra http://localhost:8080. Sem Supabase configurado, o envio só aparece no console do navegador.

## Ligar o Supabase

1. Rode `supabase/schema.sql` no SQL Editor do projeto.
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `assets/js/config.js`.

A chave anon é pública por natureza; a policy RLS só permite inserir, nunca ler.

## Publicar na Hostinger

Envie o conteúdo da pasta (exceto `supabase/`, `README.md` e `.git`) para `public_html/`
pelo Gerenciador de Arquivos ou FTP.

## Pendências de infraestrutura (dev de backend/deploy)

O front está pronto e funciona em modo teste. Falta:

- [ ] **Supabase:** rodar `supabase/schema.sql` e preencher `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `assets/js/config.js`.
  Nunca colocar a `service_role` no repositório.
- [ ] **Domínio:** trocar `og:image` no `<head>` do `index.html` pelo endereço absoluto
  (`https://<dominio>/assets/img/og-image.jpg`). Sem isso, o link não mostra imagem no WhatsApp.
- [ ] **Hostinger:** publicar `index.html`, `assets/` e `.htaccess` em `public_html/`
  (o `.htaccess` força HTTPS e define cache).
- [ ] **Teste final:** enviar uma inscrição real e conferir a linha na tabela `inscricoes`.

