# Launchpad 5.5 — capturas reais do navegador

36 capturas em Chromium 154, desktop 1440×1000 e mobile 390×1000. Antes: 5.4 em `c5dd8bd`. Depois: build estático 5.5. Temas claro e escuro.

**UI TEST FIXTURES:** dados de currículo, exercícios, candidaturas e vagas são exemplos de teste rotulados, em contextos descartáveis. A faixa inferior identifica a condição. O provedor de vagas e a configuração comercial são mockados; não houve acesso real a Supabase, e-mail, IA, Paddle ou Remotive. As imagens são screenshots de interfaces funcionais, não mockups desenhados como imagens.

Resume Studio, Interview Lab, Job Fit e Global Search não existiam na 5.4; não fabricamos uma tela “antes” para eles. Dashboard e Job Details têm comparação direta com as mesmas fixtures. [Revisão visual](../../releases/5.5-VISUAL.md).

## Antes/depois — Dashboard e Job Details

| Tela / tema | Antes desktop | Depois desktop | Antes mobile | Depois mobile |
| --- | --- | --- | --- | --- |
| dashboard / light | [Abrir](before-dashboard-light-desktop.jpg) | [Abrir](after-dashboard-light-desktop.jpg) | [Abrir](before-dashboard-light-mobile.jpg) | [Abrir](after-dashboard-light-mobile.jpg) |
| dashboard / dark | [Abrir](before-dashboard-dark-desktop.jpg) | [Abrir](after-dashboard-dark-desktop.jpg) | [Abrir](before-dashboard-dark-mobile.jpg) | [Abrir](after-dashboard-dark-mobile.jpg) |
| job-details / light | [Abrir](before-job-details-light-desktop.jpg) | [Abrir](after-job-details-light-desktop.jpg) | [Abrir](before-job-details-light-mobile.jpg) | [Abrir](after-job-details-light-mobile.jpg) |
| job-details / dark | [Abrir](before-job-details-dark-desktop.jpg) | [Abrir](after-job-details-dark-desktop.jpg) | [Abrir](before-job-details-dark-mobile.jpg) | [Abrir](after-job-details-dark-mobile.jpg) |

## Módulos e estados novos

| Tela | Light desktop | Dark desktop | Light mobile | Dark mobile |
| --- | --- | --- | --- | --- |
| resume | [Abrir](after-resume-light-desktop.jpg) | [Abrir](after-resume-dark-desktop.jpg) | [Abrir](after-resume-light-mobile.jpg) | [Abrir](after-resume-dark-mobile.jpg) |
| resume-modern | [Abrir](after-resume-modern-light-desktop.jpg) | [Abrir](after-resume-modern-dark-desktop.jpg) | [Abrir](after-resume-modern-light-mobile.jpg) | [Abrir](after-resume-modern-dark-mobile.jpg) |
| interview | [Abrir](after-interview-light-desktop.jpg) | [Abrir](after-interview-dark-desktop.jpg) | [Abrir](after-interview-light-mobile.jpg) | [Abrir](after-interview-dark-mobile.jpg) |
| search | [Abrir](after-search-light-desktop.jpg) | [Abrir](after-search-dark-desktop.jpg) | [Abrir](after-search-light-mobile.jpg) | [Abrir](after-search-dark-mobile.jpg) |
| job-fit | [Abrir](after-job-fit-light-desktop.jpg) | [Abrir](after-job-fit-dark-desktop.jpg) | [Abrir](after-job-fit-light-mobile.jpg) | [Abrir](after-job-fit-dark-mobile.jpg) |

Modern e Job Fit são capturados com foco no documento/painel; as outras telas começam no topo. As versões Classic e Modern são dados reais do editor em execução, com texto explicitamente marcado como fixture, não qualificações de uma pessoa real.

## Reprodução local

Depois de instalar dependências e gerar `_site`, exporte a base para uma pasta isolada:

```sh
mkdir -p /tmp/launchpad55-baseline
git archive c5dd8bd | tar -x -C /tmp/launchpad55-baseline
LAUNCHPAD_BASELINE_DIR=/tmp/launchpad55-baseline CHROMIUM_PATH=/usr/bin/chromium node scripts/capture-career55.cjs
```

O script usa somente servidores locais em 8002/8003, bloqueia rede externa e intercepta os serviços de teste com fixtures. Não o execute junto com a suíte completa. [Manifesto](capture-manifest.json) registra temas, tamanhos, data de execução e erros de página. Publicação e testes reais de integração são etapas separadas, descritas no [guia Windows/Staging](../../releases/5.5-STAGING.md).
