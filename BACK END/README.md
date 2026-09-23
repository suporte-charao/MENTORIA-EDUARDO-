# BACK END — metodo-charao-api

API de pré-inscrição da landing **Método Charão** (Charão Educacional). Recebe o formulário,
grava em SQLite e encaminha o lead ao CRM Charão Leads via webhook autenticado.

## Rodar local

```bash
npm install
cp .env.example .env      # CRM_FORWARD_ENABLED=false para não bater no CRM
npm run dev               # http://localhost:3004
npm test
```

## Endpoints

- `GET /health` → `{ status: "ok", service: "metodo-charao-api" }`
- `POST /api/inscricoes` → `201 { id, message }` | `400 { errors }` | `429` | `500`
  Campos obrigatórios: nome, telefone (10–11 dígitos), email, empresa, cargo, cidade, estado (UF),
  faturamento, funcionarios, problemas, aprender, dificuldades, consentimento (true).
  Campo honeypot `website`: se preenchido, responde 201 sem gravar.

## Fluxo do lead

1. Valida e grava em `data/inscricoes.db` (tabela `inscricoes`, coluna `crm_status`).
2. Encaminha ao CRM (`CRM_WEBHOOK_URL`, header `Authorization: Bearer CRM_WEBHOOK_SECRET`) com
   `origemLead = "Método Charão Eduardo"`. `notas` traz todas as respostas do questionário, mas
   cada resposta longa (problemas/aprender/dificuldades) é cortada em até 550 caracteres — o
   texto completo continua íntegro no SQLite.
3. Responde 201 ao visitante mesmo se o CRM falhar. `crm_status` fica `erro` e `crm_erro` guarda o motivo.

Reenviar pendentes: consultar `SELECT id, email, crm_status FROM inscricoes WHERE crm_status <> 'enviado'`
e repetir o POST manualmente (ver guia `integracao-landing-pages.md` no repositório do CRM).

## Produção (VPS srv1309622)

Deploy roda com usuário não-root (sem sudo além do `mkdir`/`chown` inicial):

```bash
sudo mkdir -p /var/www/metodo-charao && sudo chown -R $USER:$USER /var/www/metodo-charao
cd /var/www/metodo-charao
git clone git@github.com:suporte-charao/MENTORIA-EDUARDO-.git .   # repo privado: use deploy key (ssh) ou GCM
node -v   # precisa ser >= 20 (better-sqlite3 12 traz binário pronto p/ Node 20/22/24; se compilar, instale build-essential python3)
cd "BACK END" && npm ci --omit=dev
cp .env.example .env && nano .env   # PORT=3004, HOST=127.0.0.1, CORS_ORIGIN=https://grupocharao.com.br,https://www.grupocharao.com.br, CRM_WEBHOOK_SECRET=<mesmo do CRM>, NODE_ENV=production
pm2 start src/index.js --name metodo-charao-api --cwd "/var/www/metodo-charao/BACK END" && pm2 save
curl -s localhost:3004/health
```

**Backup:** `data/inscricoes.db` é a única cópia completa do questionário (as notas enviadas ao
CRM vêm truncadas por resposta — ver "Fluxo do lead"). Inclua o arquivo na rotina de backup da VPS:

```bash
sqlite3 data/inscricoes.db ".backup /backup/inscricoes-$(date +%F).db"
```

ou copie o arquivo com a aplicação parada/ociosa, para evitar copiar em plena escrita.

nginx (`/etc/nginx/sites-available/api-metodo.charaotechub.com`):

```nginx
server {
    server_name api-metodo.charaotechub.com;
    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api-metodo.charaotechub.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api-metodo.charaotechub.com
```

DNS (Hostinger, zona charaotechub.com): registro `A` `api-metodo` → IP da VPS.

Atualizar: `cd /var/www/metodo-charao && git pull && cd "BACK END" && npm ci --omit=dev && pm2 restart metodo-charao-api`.
