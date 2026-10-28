# Launchpad integrado — cadastro e Paddle no staging

Este guia usa o projeto **já existente**. Não cria outro projeto, não reexecuta
migrações, não troca chaves e não autoriza cobrança real ou aprovação legal.
A versão integrada reúne o redesign 5.1 e a correção Auth/billing, preservando
a base `3e2e993`. Use `integration/launchpad-5-1-staging`; o
[guia unificado](INTEGRATED_STAGING.md) é a referência atual de publicação.

- Site: https://launchpad-career-staging.pages.dev/
- Supabase: https://oyatshlhqdxosvbelsvp.supabase.co
- Callback: https://launchpad-career-staging.pages.dev/auth/callback.html

## 1. O motivo mais importante para conferir primeiro

**Direct Upload não executa npm nem injeta variáveis no JavaScript.** Cadastrar
variáveis no painel Cloudflare não modifica uma pasta `_site` já compilada.
É necessário gerar essa pasta no computador com os dois valores públicos e
republicá-la no mesmo projeto. Não basta enviar o código-fonte ou `auth-config.js`
em branco. A chave pública não foi fornecida nesta tarefa e não foi inventada.

## 2. Baixar e testar no Windows CMD

Instale Node.js 24 e Git, se ainda não estiverem instalados. Abra **Prompt de
Comando (CMD)** na pasta onde quer baixar o projeto. Se você já tem o repositório,
entre na pasta dele e pule os dois primeiros comandos.

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
npm run build:check
npm test
```

Se a branch já existir no seu computador, use
`git switch integration/launchpad-5-1-staging` em vez de `--track`.
Os testes usam fixtures, não enviam e-mails nem compram planos reais. Execute-os
**antes** de configurar o build do seu projeto. Se algum comando falhar, pare e
verifique o erro; não publique uma pasta `_site` antiga por engano.

## 3. Copiar somente a chave pública e gerar `_site`

No Supabase, abra **Project Settings → API Keys** no projeto
`oyatshlhqdxosvbelsvp`. Copie a chave **publishable** (`sb_publishable_…`). A antiga
chave **anon/public** também é aceita se corresponder a esse projeto. Não copie
`service_role`, `sb_secret_…`, chave de banco, senha SMTP ou chave Paddle.
Não envie esses segredos por chat nem os coloque em arquivos do GitHub.

No CMD, substitua somente o texto `COLE_SUA_CHAVE_PUBLICA_AQUI` pelo valor público:

```bat
set "PUBLIC_SUPABASE_URL=https://oyatshlhqdxosvbelsvp.supabase.co"
set "PUBLIC_PUBLISHABLE_KEY=COLE_SUA_CHAVE_PUBLICA_AQUI"
set "REQUIRE_PUBLIC_AUTH_CONFIG=true"
npm run build
```

Alternativa curta: depois de definir a chave pública, `npm run build:staging`
usará automaticamente a URL acima e exigirá a configuração pública completa.
Ele rejeita outro projeto; não habilita nenhum serviço comercial.

Ao terminar sem erros, existe a pasta `_site`. Confira:

- `_site/index.html` existe na raiz.
- `_site/auth-config.js` contém somente `supabaseUrl` e `publishableKey` públicos.
- `_site/build-manifest.json` mostra `publicAuthConfigured: true`.
- `_site/vendor/supabase.js` e `_site/auth/callback.html` existem.
- Não há SQL, funções de servidor, `node_modules` ou credenciais privadas no artefato.

O `auth-config.js` do código-fonte continua em branco intencionalmente. Não edite
esse arquivo para colocar credenciais privadas. A validação de uma chave anon
confere sua categoria/projeto, não concede sessão ou assinatura; o Supabase continua
validando a chave e as credenciais no servidor.

## 4. Republicar no mesmo Cloudflare Pages

1. Entre na Cloudflare e abra **Workers & Pages → launchpad-career-staging**.
2. Abra **Deployments → Create deployment** (ou **Upload assets**, conforme a tela).
3. Use **Direct Upload** e selecione a pasta `_site` recém-gerada como raiz dos
   arquivos. `index.html` deve ficar na raiz do upload, não dentro de outra `_site`.
4. Confira que o destino é **launchpad-career-staging**, não outro site comercial.
5. Publique manualmente essa atualização de staging e aguarde a confirmação.
6. Abra o site em janela anônima e teste **Account**. Confirme que
   `/auth-config.js` no site tem a URL correta e apenas a chave pública.
7. No CMD, execute o diagnóstico somente de leitura:

```bat
npm run check:staging
```

Ele verifica arquivos, configuração pública, política de confirmação disponível
na API e o catálogo de cobrança. Não cria conta, envia e-mail, compra planos ou
modifica o banco. `PASS` nos pré-requisitos não comprova entrega de e-mail nem
compra. `NOT VERIFIED` indica que não foi possível verificar, não um sucesso.

Limpe os valores da sessão CMD ao terminar:

```bat
set "PUBLIC_SUPABASE_URL="
set "PUBLIC_PUBLISHABLE_KEY="
set "REQUIRE_PUBLIC_AUTH_CONFIG="
```

## 5. Conferir Supabase Auth — sem reexecutar migrações

No dashboard do projeto existente:

1. **Authentication → Providers/Sign In → Email**: mantenha e-mail e cadastro
   habilitados, **Confirm email habilitado**, senha mínima 12 e os rate limits.
2. **Authentication → URL Configuration**:
   - Site URL: `https://launchpad-career-staging.pages.dev/`
   - Redirect URL: `https://launchpad-career-staging.pages.dev/auth/callback.html`
   - Adicione somente o callback exato de qualquer outra origem que você realmente
     usar. Não use wildcard amplo. Preserve origens anteriores intencionais.
3. Confira o hook de idade/termos já preparado e as políticas RLS existentes.
   Conta e IA são para 16+; contratação paga exige 18+ e os consentimentos atuais.
4. **Authentication → Email Templates**: os modelos de staging não devem apontar
   para o antigo GitHub Pages. Após revisar/backupear os modelos atuais, use:

Confirmação de cadastro:

```html
<h2>Confirm your Launchpad account</h2>
<p><a href="https://launchpad-career-staging.pages.dev/auth/callback.html#token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
<p>If you did not request this account, you can ignore this message.</p>
```

Recuperação de senha:

```html
<h2>Reset your Launchpad password</h2>
<p><a href="https://launchpad-career-staging.pages.dev/auth/callback.html#token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>
<p>If you did not request this, you can ignore this message.</p>
```

Os links com `token_hash` funcionam sem o verificador PKCE do primeiro navegador.
Os links padrão com `?code=…` continuam exigindo o mesmo navegador/origem em que
foram solicitados. O callback aceita também templates `?token_hash=…&type=…`,
mas os fragmentos acima evitam enviar o token no pedido HTTP do arquivo estático.
Não compartilhe links ou tokens; são credenciais temporárias.

### SMTP: o que precisa ser conferido

Não foi possível inspecionar seu SMTP. O código não pode certificar a entrega.
Em **Authentication → Emails → SMTP Settings**, confira:

- Provedor SMTP contratado/controlado por você; host, porta TLS, usuário e senha
  cadastrados **somente no Supabase**.
- Remetente e domínio verificados no provedor; registros SPF/DKIM e política DMARC.
- Cotas e limites do Supabase e do provedor, logs de envio e rejeições, pasta spam.
- Rastreamento/regravação de links desativado se consumir ou quebrar o token.

O envio padrão do Supabase tem restrições e não deve ser considerado entrega geral
para qualquer usuário. “Email sent” na tela não comprova chegada ao destinatário.
Use o log e a caixa postal real para cada teste abaixo. Não exponha credenciais
SMTP em screenshots ou chamados.

## 6. Conferir as condições de cobrança

As seis chaves Paddle foram informadas pelo proprietário como existentes; seus
valores não foram lidos, alterados nem impressos. A existência delas não garante
que o checkout esteja liberado. O catálogo/status agora lista pré-requisitos locais
incompletos, sem revelar chaves. Se CORS estiver incorreto, corrija a origem no painel
antes de esperar que o navegador consiga ler essa lista.

| Configuração | Conferir no projeto existente | Permissão |
| --- | --- | --- |
| `commercial_settings.enabled` | Valor atual no banco; não presumir que está true | Alterar só após aprovação explícita do proprietário |
| `BILLING_CHECKOUT_ENABLED` | Flag atual da função | Alterar só após aprovação explícita |
| `BILLING_LEGAL_APPROVED` | Termos/revisão realmente aprovados | **Não marcar true para contornar erro** |
| `PUBLIC_SITE_URL` | `https://launchpad-career-staging.pages.dev/` | Configuração técnica de staging pelo proprietário |
| `ALLOWED_ORIGINS` | Incluir origem exata `https://launchpad-career-staging.pages.dev` sem barra final/caminho; manter somente origens intencionais | Configuração técnica pelo proprietário |
| `BILLING_TERMS_VERSION` | Versão dos termos efetivamente revisados/publicados | Depende da aprovação dos termos |
| `BUSINESS_NAME` | Identidade real do operador | Fornecida pelo proprietário, nunca inventada |
| `PUBLIC_SUPPORT_EMAIL` | E-mail real monitorado | Fornecido pelo proprietário |
| `PADDLE_ENVIRONMENT` | `sandbox`; deve corresponder ao banco | Não mudar para live |
| `PADDLE_CLIENT_TOKEN` | Token público de cliente Sandbox `test_…` | Não substituir chaves já corretas |
| `PADDLE_PRICE_PRO` / `PADDLE_PRICE_PREMIUM` | IDs distintos de preços mensais USD 900/1900 centavos, consistentes com o catálogo | Conferir, sem criar produtos live |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Existentes no secret manager e pertencentes ao Sandbox/destino correto | Não alterar/rotacionar nesta correção |
| `ALLOW_LIVE_BILLING` | Ausente ou false | Não habilitar |

Para consultar o banco sem alterar nada, o proprietário pode executar no SQL Editor:

```sql
select enabled, environment,
       plans->'pro'->>'monthlyCents' as pro_monthly_cents,
       plans->'premium'->>'monthlyCents' as premium_monthly_cents
from public.commercial_settings where id = true;

select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('user_profiles','job_applications','tasks',
                   'billing_customers','billing_subscriptions','billing_events');
```

Não execute novamente migrações já aplicadas. Esta branch não altera o SQL.
Confira no Paddle Sandbox a URL de pagamento padrão/domínio permitido, destino de
notificações e eventos realmente selecionados — o número “11” sozinho não verifica
a seleção. Os eventos de transação necessários, incluindo `transaction.completed`,
e os eventos de assinatura/lifecycle devem estar presentes conforme
[commercial setup](commercial/SETUP.md). Guarde o segredo existente.

O destino existente deve ser
`https://oyatshlhqdxosvbelsvp.supabase.co/functions/v1/paddle-webhook`.
Confira os nomes dos eventos, sem criar um segundo destino nem trocar o segredo:

```text
subscription.created
subscription.activated
subscription.updated
subscription.past_due
subscription.paused
subscription.resumed
subscription.canceled
transaction.completed
transaction.payment_failed
transaction.updated
transaction.canceled
```

O código atualizado de `billing` precisa ser publicado pelo proprietário para que
os novos diagnósticos/termos estejam disponíveis no servidor. Pelo terminal com
login Supabase autorizado, depois de revisar a branch:

```bat
npx supabase login
npx supabase functions deploy billing --project-ref oyatshlhqdxosvbelsvp
```

Essa instrução não reexecuta migrações, não troca secrets e não publica automaticamente
nesta tarefa. O arquivo compartilhado de readiness é incluído no bundle. O webhook
já publicado pode permanecer em `3e2e993`; não há mudança na assinatura ou na lógica
de concessão de direitos. Não cole o token do login Supabase em arquivos/chats.

## 7. Testar cadastro, login e senha — passo a passo

1. Em janela anônima, abra staging → **Account → Create account**.
2. Use um e-mail real que você controle, senha nova de pelo menos 12 caracteres,
   faixa etária correta e aceite os termos apenas após lê-los.
3. Antes de confirmar, tente entrar: deve receber orientação de verificação e
   continuar sem acesso autenticado. Confira também uma senha incorreta.
4. Aguarde na caixa postal real. Teste **resend** respeitando limites. Abra o
   último link de confirmação e confira a origem staging, sem compartilhar o link.
5. Volte ao site, entre e atualize a página: a sessão deve permanecer. **Account**
   deve mostrar sua identidade; não deve mostrar registros locais como privados.
6. Abra Profile & Settings e salve um nome/faixa etária corretos. Dados de perfil
   pertencem à conta. No plano Free, a organização de carreira é local; edição
   privada na nuvem exige Pro/Premium ou o grant legado existente.
7. Saia, clique **Forgot password**, solicite o e-mail, abra o link recebido,
   defina uma senha nova e entre com ela. Links expirados/usados devem falhar.
8. Após acesso cloud válido, crie uma candidatura e uma tarefa de teste. Em outro
   dispositivo, entre com a mesma conta e confirme leitura/persistência.
9. Entre com uma segunda conta autorizada: os registros da primeira não devem
   aparecer. Volte para a primeira: os dados devem continuar lá.
10. Importar dados visitantes deve pedir confirmação e não apagar dados existentes.
    Baixe JSON antes de testes de restauração; use somente registros descartáveis.
11. Teste exclusão apenas em uma conta descartável, com senha atual e sem cobrança
    ativa ou checkout pendente. O servidor deve bloquear exclusão financeira insegura.

## 8. Testar compra fictícia — somente após autorização dos gates

1. Use um adulto e uma conta de teste confirmada, não um usuário com grant legado
   que já possui as funcionalidades. Não compre em nome de outra pessoa.
2. Em **Plans & Billing**, confira Sandbox, perfil, preços, lista de pendências e
   os termos. Enquanto houver gates pendentes, a compra deve falhar sem falso sucesso.
3. Depois da aprovação e configuração pelo proprietário, aceite os termos e escolha
   Pro. O backend deve criar a transação; não altere localStorage para liberar acesso.
4. No checkout oficial Paddle, use somente o método/cartão de teste publicado na
   documentação Sandbox da Paddle. Nunca digite cartão real nesta validação.
5. Ao concluir, a interface informa que está aguardando o servidor. Ela consulta
   o status no máximo seis vezes; só mostra confirmação após resposta autenticada
   do backend. Se continuar pendente, confira webhook/logs e use **Refresh status**;
   não clique repetidamente para tentar gerar uma segunda compra.
6. Confira o ID da transação e a assinatura no dashboard Paddle Sandbox, o evento
   real `evt_`, sua assinatura válida e o registro pertencente à conta no banco.
   Eventos `ntfsimevt_` recebem confirmação sem criar assinaturas ou planos pagos.
7. Abra o Dashboard: deve mostrar o acesso confirmado pelo servidor. Teste a
   sincronização cloud, o portal e o cancelamento ao fim do período.
8. Repita com Premium em conta de teste própria; teste mudança de plano com preview
   e confirmação da prorrata, falha de pagamento e cancelamento imediato somente
   em dados descartáveis. Confira renovação, vencimento, eventos duplicados e fora
   de ordem no ambiente Sandbox autorizado.
9. Teste fechar o checkout sem pagar. O aplicativo deve informar fechamento, sem
   afirmar pagamento ou ativação. Saia durante espera: nenhum resultado tardio
   pode atualizar a próxima conta.

Registre apenas evidências redigidas: cenário, horário, resultado, SHA do build e
IDs necessários para reconciliação privada. Não grave senhas, tokens, chaves,
links de recuperação ou dados de cartão em tickets/GitHub.

## 9. Situação e limites desta entrega

Os testes locais verificam SDK, callbacks, privacidade/RLS e cobrança com fixtures;
PostgreSQL/PGlite executa o SQL real com contexto Auth simulado. Isso não comprova
entrega de e-mail nem compra na sua infraestrutura. O staging/Supabase retornaram
403 ao acesso deste ambiente. As condições reais de SMTP, flags, produtos e domínio
não puderam ser inspecionadas. Nenhuma flag legal/comercial foi ativada.

O relatório técnico registra os resultados locais. **Não aceitar clientes pagantes**
até validar a matriz real acima, concluir revisões/aprovações e obter autorização
separada para produção. Este trabalho prepara funcionamento e aceitação no Sandbox.
