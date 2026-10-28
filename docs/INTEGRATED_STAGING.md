# Launchpad 5.1 — versão Staging integrada

Branch única: **`integration/launchpad-5-1-staging`**.
Reúne `feat/launchpad-5-1-premium-commercial` (`437bfcd`) e
`feat/launchpad-5-auth-billing-integration` (`bdbe0cf`) mediante merge real,
preservando os históricos e a correção Paddle `3e2e993`.

Não houve deploy, merge no main, alteração de credenciais, migração no banco,
ativação comercial/legal ou cobrança real. O build local é validado; o build
com Auth do proprietário ainda exige sua chave **pública**. Nenhuma chave foi
inventada ou adicionada ao GitHub.

## O que foi integrado

- Identidade premium, sidebar, ilustração original, bento dashboard, cards/planos,
  navegação mobile, marcas de empresas/fallbacks, temas claro/escuro e telas Auth.
- SDK Supabase, configuração pública publishable/anon, callbacks em query/fragmento,
  sessão, recuperação e separação dos dados de visitante/conta.
- Diagnóstico de pré-requisitos, versão de termos consistente, espera limitada
  pelo webhook, tratamento de falha/fechamento e proteção exclusiva Sandbox no
  endereço de staging conhecido. Nenhum evento do navegador concede plano.
- Exportação/restauração JSON, dados locais, RLS, SQL e regras de propriedade
  preservados. Nenhuma migração ou limite/preço de plano foi alterado.

Conflitos resolvidos: `commerce.js`, `scripts/build.cjs`,
`scripts/build-env.test.cjs`, `scripts/public-files.cjs`. A lista pública contém
os assets premium **e** os módulos de Auth. A FAQ premium e o diagnóstico de
billing coexistem. O dashboard usa um único indicador premium `dashboardPlanStatus`,
com estado confirmado pelo servidor e limpeza no logout. Os testes dos dois
componentes foram alinhados a esse indicador, preservando suas verificações.

## Resultado dos testes

| Verificação executada | Resultado |
| --- | --- |
| `npm ci --cache /tmp/launchpad-npm-cache` | Aprovado |
| `npm run build` | Aprovado; 51 arquivos públicos |
| `npm run build:check` | Aprovado; SDK, catálogo, licenças e hashes reproduzíveis |
| `CI=true CHROMIUM_PATH=/usr/bin/chromium npm test` | **144 aprovados**, zero pulados: 86 Playwright de fonte, 13 Playwright do artefato compilado, 38 backend/modelos/diagnósticos, 3 suítes PostgreSQL/PGlite e 4 testes de build/configuração |
| Bundles das seis Edge Functions | Aprovados localmente, sem deploy |
| Auditoria adicional do artefato | 51 arquivos únicos; hashes corretos; módulos premium e Auth presentes; backend/SQL/docs/env excluídos |
| `npm audit` | Zero vulnerabilidades conhecidas apontadas |
| `git diff --check` | Aprovado |

Ambiente local: Node 24.19.0, Debian 13, Chromium 154.0.8037.57. Os testes das duas
branches permanecem presentes; somente o seletor/texto do indicador unificado foi
alinhado. Foi adicionado um teste do artefato integrado que percorre design premium,
login, preços, checkout simulado, confirmação pelo servidor e limpeza no logout.
O build padrão validado continua em modo visitante (`publicAuthConfigured=false`),
pois a chave pública real não foi fornecida. Gere o build configurado conforme os
comandos abaixo antes de publicar com Auth. Não há resultado de CI hospedado ou
de integração real externa afirmado nesta entrega.

As integrações de navegador/API usam fixtures determinísticas. As suítes
PostgreSQL/PGlite executam SQL real em banco local isolado, com contexto de Auth
simulado; não acessam o banco do proprietário. Não confundir com entrega real de
email, compra Sandbox ou certificação de RLS no projeto hospedado.

## Windows CMD — baixar e testar

Instale Git e Node.js 24. Abra **Prompt de Comando (CMD)**. Se já tiver o projeto,
entre na pasta e pule os dois primeiros comandos; preserve alterações locais.

```bat
git clone https://github.com/theskullguy499-sketch/launchpad-career.git
cd launchpad-career
git fetch origin
git switch --track origin/integration/launchpad-5-1-staging
set "PUBLIC_SUPABASE_URL="
set "PUBLIC_PUBLISHABLE_KEY="
set "REQUIRE_PUBLIC_AUTH_CONFIG="
npm ci
npx playwright install chromium
npm run build
npm run build:check
npm test
```

Se essa branch já existir localmente, substitua `git switch --track ...` por:

```bat
git switch integration/launchpad-5-1-staging
```

Não execute testes determinísticos com a configuração de um projeto real no build.
Os comandos acima limpam apenas variáveis públicas da sessão CMD, não dados de
usuários ou credenciais de serviços. Não use reset do banco ou force no Git.

## Gerar a única pasta `_site` configurada

No projeto Supabase `oyatshlhqdxosvbelsvp`, abra **Project Settings → API Keys**
e copie somente a **publishable** (`sb_publishable_…`) ou a antiga **anon/public**.
Nunca use `service_role`, `sb_secret_`, senha SMTP, chave Paddle ou senha de banco.

No CMD, substitua o texto abaixo pela chave pública:

```bat
set "PUBLIC_PUBLISHABLE_KEY=COLE_SUA_CHAVE_PUBLICA_AQUI"
npm run build:staging
```

O comando usa automaticamente
`https://oyatshlhqdxosvbelsvp.supabase.co`, exige configuração pública válida e gera
`_site` com o design e os fluxos integrados. Não ativa flags no servidor.

Alternativa explícita equivalente:

```bat
set "PUBLIC_SUPABASE_URL=https://oyatshlhqdxosvbelsvp.supabase.co"
set "REQUIRE_PUBLIC_AUTH_CONFIG=true"
npm run build
```

Só prossiga se terminar sem erros. **Não envie uma `_site` antiga após um erro.**
Confira `_site/build-manifest.json`: `publicAuthConfigured` precisa ser `true`.
O arquivo `_site/auth-config.js` deve conter só os dois valores públicos.
A origem do código `auth-config.js` permanece em branco intencionalmente.

A pasta contém o SDK e os assets necessários. SQL, funções de servidor, docs,
node_modules e credenciais privadas ficam fora da lista de publicação. Não envie
o repositório inteiro como se fosse a pasta pública.

## Publicação manual no projeto existente Cloudflare

1. Entre em **Workers & Pages → launchpad-career-staging**.
2. Abra **Deployments → Create deployment / Upload assets**.
3. Escolha a pasta `_site` recém-gerada; `index.html` deve ficar na raiz do upload.
4. Confirme o destino **launchpad-career-staging**, sem criar outro projeto.
5. Somente quando decidir publicar, confirme manualmente e aguarde a conclusão.
6. Abra `https://launchpad-career-staging.pages.dev/` em janela anônima.
7. Confira **Account**, as telas premium e **Plans & Billing**. Execute:

```bat
npm run check:staging
```

Esse diagnóstico é somente de leitura e não cria conta, envia email, compra plano
ou modifica o banco. `PASS` não comprova compra nem entrega de email.
**Direct Upload não executa build nem injeta variáveis após o upload**; configure
os valores no CMD antes de gerar a pasta.

Ao terminar, limpe os valores públicos desta sessão CMD:

```bat
set "PUBLIC_SUPABASE_URL="
set "PUBLIC_PUBLISHABLE_KEY="
set "REQUIRE_PUBLIC_AUTH_CONFIG="
```

## Configurações e validações externas ainda pendentes

- **Supabase Auth:** confirmar provider Email, Confirm email obrigatório, mínimo
  12 caracteres, limites e onboarding/idade. Site URL:
  `https://launchpad-career-staging.pages.dev/`; redirect exato:
  `https://launchpad-career-staging.pages.dev/auth/callback.html`.
- **SMTP:** conferir provedor/remetente, SPF/DKIM/DMARC, quotas, logs e entrega real
  de confirmação/reenvio/recuperação. Não foi possível inspecionar seus valores.
- **Billing:** o código de `billing` da branch Auth precisa de publicação revisada
  pelo proprietário se ainda não foi atualizado. O webhook pode permanecer na
  correção já publicada `3e2e993`; a assinatura e o processamento não mudaram.
- **Flags:** conferir, sem presumir valores, `commercial_settings.enabled`,
  `BILLING_CHECKOUT_ENABLED`, `BILLING_LEGAL_APPROVED`, `BILLING_TERMS_VERSION`,
  `BUSINESS_NAME` e `PUBLIC_SUPPORT_EMAIL`. Aprovações legais/comerciais exigem
  autorização explícita; não marque true para contornar erro.
- **Origem das funções:** `PUBLIC_SITE_URL` deve ser a URL staging com barra final;
  `ALLOWED_ORIGINS` deve incluir apenas origens intencionais e a origem staging
  exata sem caminho/barra final.
- **Paddle:** confirmar ambiente Sandbox no banco e funções, preços mensais USD
  Pro 900/Premium 1900 centavos, token `test_…`, domínio de pagamento e eventos
  reais de transação/assinatura. Não alterar secrets existentes nem usar live.
- **Aceitação:** testar caixa postal, duas contas reais/RLS, persistência entre
  dispositivos, checkout fictício completo, webhook `evt_`, portal, falhas,
  renovação, mudança e cancelamento. `ntfsimevt_` não concede planos.

Os acessos externos anteriores ao staging/Supabase retornaram 403 no ambiente de
execução. Nenhum novo deploy ou teste real de compra/email foi realizado nesta
integração. Confira o [guia completo de Auth e billing](AUTH_BILLING_STAGING_PT.md)
para modelos de email, consulta SQL somente leitura e roteiro de testes reais.
Não reexecute migrações já aplicadas.

**Recomendação:** revisão e testes controlados de staging; **NO-GO para clientes
pagantes** até concluir configuração, testes reais e aprovações. Não houve merge
no main nem implantação automática. Para rollback de frontend, retenha o artefato
anterior no Cloudflare e exporte JSON antes de mudanças de origem; não apague dados.
