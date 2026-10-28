# Launchpad 5.4 — capturas reais

Antes: commit `b161d85`. Depois: build estático 5.4 local. Chromium 154, 1440×1000 (desktop) e 390×1000 (mobile). 48 capturas de viewport, não páginas artificiais desenhadas como imagens. Kanban e Calendar adicionais focam a área de trabalho; as comparações principais começam no topo da página.

**UI TEST FIXTURES:** os registros foram inseridos somente em contextos de navegador descartáveis. Não são clientes, vagas, ofertas ou métricas reais. Nenhuma integração externa é validada por estas imagens. A faixa inferior e os títulos identificam os dados de teste. A tela Coach mostra boas-vindas/estado disponível localmente, não uma resposta inventada de IA.

As referências do usuário orientaram composição e hierarquia; não foram redistribuídas. [Análise objetiva](../../releases/5.4-VISUAL.md).

## Antes e depois — claro

| Página | Antes desktop | Depois desktop | Antes mobile | Depois mobile |
| --- | --- | --- | --- | --- |
| Applications | [Antes](before-applications-light-desktop.jpg) | [Depois](after-applications-light-desktop.jpg) | [Antes](before-applications-light-mobile.jpg) | [Depois](after-applications-light-mobile.jpg) |
| Roadmap | [Antes](before-roadmap-light-desktop.jpg) | [Depois](after-roadmap-light-desktop.jpg) | [Antes](before-roadmap-light-mobile.jpg) | [Depois](after-roadmap-light-mobile.jpg) |
| Coach | [Antes](before-coach-light-desktop.jpg) | [Depois](after-coach-light-desktop.jpg) | [Antes](before-coach-light-mobile.jpg) | [Depois](after-coach-light-mobile.jpg) |
| Analytics | [Antes](before-analytics-light-desktop.jpg) | [Depois](after-analytics-light-desktop.jpg) | [Antes](before-analytics-light-mobile.jpg) | [Depois](after-analytics-light-mobile.jpg) |
| Companies | [Antes](before-companies-light-desktop.jpg) | [Depois](after-companies-light-desktop.jpg) | [Antes](before-companies-light-mobile.jpg) | [Depois](after-companies-light-mobile.jpg) |
| Settings | [Antes](before-settings-light-desktop.jpg) | [Depois](after-settings-light-desktop.jpg) | [Antes](before-settings-light-mobile.jpg) | [Depois](after-settings-light-mobile.jpg) |

## Depois — tema escuro

| Página | Desktop | Mobile |
| --- | --- | --- |
| Applications | [Abrir](after-applications-dark-desktop.jpg) | [Abrir](after-applications-dark-mobile.jpg) |
| Roadmap | [Abrir](after-roadmap-dark-desktop.jpg) | [Abrir](after-roadmap-dark-mobile.jpg) |
| Coach | [Abrir](after-coach-dark-desktop.jpg) | [Abrir](after-coach-dark-mobile.jpg) |
| Analytics | [Abrir](after-analytics-dark-desktop.jpg) | [Abrir](after-analytics-dark-mobile.jpg) |
| Companies | [Abrir](after-companies-dark-desktop.jpg) | [Abrir](after-companies-dark-mobile.jpg) |
| Settings | [Abrir](after-settings-dark-desktop.jpg) | [Abrir](after-settings-dark-mobile.jpg) |

## Novos estados funcionais

| Estado | Claro desktop | Escuro desktop | Claro mobile | Escuro mobile |
| --- | --- | --- | --- | --- |
| kanban | [Abrir](after-kanban-light-desktop.jpg) | [Abrir](after-kanban-dark-desktop.jpg) | [Abrir](after-kanban-light-mobile.jpg) | [Abrir](after-kanban-dark-mobile.jpg) |
| calendar | [Abrir](after-calendar-light-desktop.jpg) | [Abrir](after-calendar-dark-desktop.jpg) | [Abrir](after-calendar-light-mobile.jpg) | [Abrir](after-calendar-dark-mobile.jpg) |
| application-form | [Abrir](after-application-form-light-desktop.jpg) | [Abrir](after-application-form-dark-desktop.jpg) | [Abrir](after-application-form-light-mobile.jpg) | [Abrir](after-application-form-dark-mobile.jpg) |

## Reproduzir

Em Linux, depois de `npm ci` e `npm run build`, exporte a base sem alterar sua branch:

```sh
mkdir -p /tmp/launchpad54-baseline
git archive b161d85 | tar -x -C /tmp/launchpad54-baseline
LAUNCHPAD_BASELINE_DIR=/tmp/launchpad54-baseline CHROMIUM_PATH=/usr/bin/chromium node scripts/capture-workspace54.cjs
```

Não execute junto com a suíte completa. O script usa somente portas locais 8002/8003 e bloqueia rede externa; testa o build `_site` em prefixo `/launchpad-career/`. A base mantém o mesmo conjunto de fixtures. [Manifesto das capturas](capture-manifest.json) registra dimensões, temas e erros de página. Novos controles e dados não existem na base; o calendário e o formulário agrupado são estados adicionais do depois.
