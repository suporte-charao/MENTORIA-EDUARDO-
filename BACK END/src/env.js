import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Caminho explícito para o .env: não depende do cwd de onde o processo foi iniciado
// (systemd/pm2 podem iniciar com cwd diferente da pasta do projeto).
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })
