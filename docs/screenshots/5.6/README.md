# Launchpad 5.6 — evidência real do navegador local

Capturas Chromium em 1440 × 1050 e 390 × 1050, light/dark. Baseline: 5.5 `4e02d55`; depois: build novo 5.6. **Modo visitante real e serviços não configurados**, sem conta, vaga fictícia ou resposta de IA. Não são screenshots do Staging publicado e não comprovam email, RLS remoto ou compra Sandbox.

[Manifesto](manifest.json) registra horário UTC, hash do manifesto de build, erros de página, respostas HTTP de assets e overflow. Os scripts abortam se houver erro/overflow/asset com falha. Fotografias não equivalem a uma auditoria WCAG; a suíte axe é evidência complementar, sem certificação legal.

| Tela | Desktop light | Desktop dark | Mobile light | Mobile dark |
|---|---|---|---|---|
| Landing 5.5 antes | [Ver](before-home-light-1440.jpg) | [Ver](before-home-dark-1440.jpg) | [Ver](before-home-light-390.jpg) | [Ver](before-home-dark-390.jpg) |
| Landing 5.6 | [Ver](after-home-light-1440.jpg) | [Ver](after-home-dark-1440.jpg) | [Ver](after-home-light-390.jpg) | [Ver](after-home-dark-390.jpg) |
| Account/Auth não configurado | [Ver](after-login-light-1440.jpg) | [Ver](after-login-dark-1440.jpg) | [Ver](after-login-light-390.jpg) | [Ver](after-login-dark-390.jpg) |
| Job Explorer indisponível | [Ver](after-jobs-light-1440.jpg) | [Ver](after-jobs-dark-1440.jpg) | [Ver](after-jobs-light-390.jpg) | [Ver](after-jobs-dark-390.jpg) |
| Coach visitante | [Ver](after-coach-light-1440.jpg) | [Ver](after-coach-dark-1440.jpg) | [Ver](after-coach-light-390.jpg) | [Ver](after-coach-dark-390.jpg) |
| Billing sem backend | [Ver](after-billing-light-1440.jpg) | [Ver](after-billing-dark-1440.jpg) | [Ver](after-billing-light-390.jpg) | [Ver](after-billing-dark-390.jpg) |

A identidade visual e composição premium anterior foram preservadas. A mudança visual intencional desta fase é a apresentação mais fiel das capacidades/limitações, não um redesign. Estados vazios e de erro permanecem sem métricas inventadas.

Reprodução: após build guest novo, extraia `git archive 4e02d55` em pasta temporária separada; configure `LAUNCHPAD_BASELINE_DIR` para essa pasta e execute `node scripts/capture-readiness56.cjs`. Neste executor foi usado `CHROMIUM_PATH=/usr/bin/chromium`. O script bloqueia requests externos e rejeita build com Auth configurado para evitar captura acidental de dados privados.
