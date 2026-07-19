# Deploy no Vercel (com Turso)

O app virou um **SaaS multi-time**: cada conta tem seu próprio time e dados
isolados. Em produção (Vercel), o banco é o **Turso** (SQLite na nuvem). No
desenvolvimento local continua sendo SQLite em arquivo — nada muda.

Conta principal criada automaticamente no primeiro boot:
- **usuário:** `leviathan`  ·  **senha:** `lev@2026`  ·  **time:** Tenebra Leviathan

---

## 1. Criar o banco no Turso (grátis)

1. Crie a conta em https://turso.tech e instale o CLI (ou use o dashboard).
2. Crie um banco e pegue as credenciais:
   ```bash
   turso db create tenebra
   turso db show tenebra --url          # → TURSO_DATABASE_URL (libsql://...)
   turso db tokens create tenebra       # → TURSO_AUTH_TOKEN
   ```
   (Dá pra fazer tudo pelo painel web também — copie a **Database URL** e crie um **token**.)

## 2. Subir o código no GitHub

Na raiz do projeto:
```bash
git init
git add -A
git commit -m "Tenebra Leviathan — SaaS multi-time"
git branch -M main
# crie um repositório vazio no GitHub e:
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

## 3. Importar no Vercel

1. https://vercel.com → **Add New… → Project** → importe o repositório do GitHub.
2. **Framework Preset:** _Other_ (o `vercel.json` já define build e saída).
3. Em **Environment Variables**, adicione:

   | Nome                  | Valor                                             |
   |-----------------------|---------------------------------------------------|
   | `TURSO_DATABASE_URL`  | a URL `libsql://...` do passo 1                   |
   | `TURSO_AUTH_TOKEN`    | o token do passo 1                                |
   | `JWT_SECRET`          | string longa aleatória (veja abaixo)              |
   | `RIOT_API_KEY`        | sua chave `RGAPI-...` (SoloQ/import da Riot)       |
   | `RIOT_PLATFORM`       | `br1`                                             |

   Gerar um `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. **Deploy**. No primeiro acesso, a conta `leviathan` é criada no Turso.

## 4. (Opcional) Levar seus dados locais para o Turso

Seus 17 scrims estão no banco local. Para copiá-los ao Turso, rode **localmente**
apontando para o Turso (os `.rofl` ficam em `server/src/data/replays/`):

```bash
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/import-replays.mjs
```

Ou simplesmente reimporte os `.rofl` pela tela **Importar** no site já publicado.
Depois use **Editar partida → Atualizar elo** para preencher os elos.

---

## Rodar local (sem Turso)

```bash
npm install
npm run dev      # API :3001 + client :5173  (login leviathan / lev@2026)
```

## Notas
- Recursos locais removidos na versão hospedada: "Assistir no cliente" (LCU) e o
  armazenamento do arquivo `.rofl` — agora o `.rofl` é só processado (os stats são
  extraídos) e o arquivo é descartado.
- A chave de desenvolvimento da Riot expira a cada 24h; troque no Vercel quando
  a SoloQ/importação começar a falhar com 401/403.
