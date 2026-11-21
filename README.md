# Pyros — Comentário → DM no Instagram (estilo ManyChat)

Quando alguém comenta uma palavra-chave num post/reels da Pyros:
1. responde o comentário em público ("Te mandei no direct! 📩");
2. manda uma DM privada com o botão **"Quero o link"**;
3. ao tocar no botão, verifica se a pessoa **segue a Pyros** — se não, pede para seguir (botão "Já segui ✅");
4. entrega o link e salva o lead.

## Painel
`https://SEU-PROJETO.vercel.app/admin` (senha = `ADMIN_TOKEN`)
- **Campanhas:** palavras-chave, respostas públicas, mensagens do direct, link, exigir follow, ativar/pausar, com prévia ao vivo e testador de comentário. Ao salvar, o bot já usa a nova versão (fica no Redis).
- **Leads:** lista, contadores por status e botão para baixar a planilha (CSV).

`campanhas.js` é só o conteúdo inicial, usado até a 1ª vez que o painel salvar.

Testar o painel localmente: `node scripts/dev.js` → http://localhost:3000/admin (senha `teste`, dados em memória).

## Estrutura
| Arquivo | Função |
|---|---|
| `api/webhook.js` | recebe os eventos da Meta (comentários e DMs) |
| `lib/fluxo.js` | regras: palavra-chave, anti-duplicidade, follow, entrega |
| `lib/ig.js` | chamadas à API do Instagram |
| `lib/store.js` | Redis (Upstash): leads, deduplicação, token |
| `api/cron-refresh.js` | renova o token todo dia (vence em 60 dias) |
| `scripts/test-local.js` | simulação local (`node scripts/test-local.js`) |

## Configuração (uma vez)

### 1. Conta
O Instagram da Pyros precisa ser **Profissional (Business ou Creator)**.
No app do Instagram: Configurações → Mensagens e respostas a stories → Ferramentas conectadas → **Permitir acesso às mensagens** = ligado.

### 2. App na Meta
1. https://developers.facebook.com/apps → **Criar app** → caso de uso **"Gerenciar mensagens e conteúdo no Instagram"** → tipo Empresa.
2. Em **Instagram → Configuração da API com login do Instagram**:
   - **Gerar token de acesso**: adicionar a conta da Pyros → copiar o token (`IG_ACCESS_TOKEN`).
   - Anotar o **Instagram app secret** (`IG_APP_SECRET`).
3. **Configurar webhooks**:
   - URL de callback: `https://SEU-PROJETO.vercel.app/api/webhook`
   - Token de verificação: o mesmo valor de `WEBHOOK_VERIFY_TOKEN`
   - Assinar os campos: **comments**, **messages**, **messaging_postbacks**.
4. Deixar o app em modo **Ao vivo** (Publicar). Para uso só na conta da Pyros (que é admin/testadora do app), não precisa de App Review.

### 3. Vercel
1. Deploy: `vercel deploy --prod` nesta pasta.
2. Storage → **Upstash for Redis** (Marketplace, plano grátis) → conectar ao projeto (cria `KV_REST_API_URL`/`KV_REST_API_TOKEN`).
3. Variáveis de ambiente (ver `.env.example`) → redeploy.

## Limites da Meta
- **1 resposta privada por comentário**, até **7 dias** depois do comentário.
- Depois que a pessoa responde/toca no botão, abre uma janela de **24h** para mais mensagens.
- O sistema não manda DM duas vezes para a mesma pessoa na mesma campanha (7 dias), e ignora comentários da própria Pyros.

## Como achar o ID de um post (para campanha em post específico)
`GET https://graph.instagram.com/v23.0/me/media?fields=id,caption,permalink&access_token=TOKEN`
