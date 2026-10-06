<div align="center">

<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='28' fill='%2316a34a'/%3E%3Cpath d='M30 88 52 62l16 14 30-34' fill='none' stroke='%23fff' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M76 42h22v22' fill='none' stroke='%23fff' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" width="104" alt="FinDek logo">

# FinDek

**Um tracker financeiro pessoal à moda antiga — simples, offline e em verde e branco.**

Transações · Orçamentos · Salário & Fixos · Renda externa · **Planejador de investimentos** · Notas

Zero dependências · Roda 100% offline · Tudo em `localStorage`

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![No dependencies](https://img.shields.io/badge/dependencies-none-success?style=flat-square)](#)
[![No build step](https://img.shields.io/badge/build-none-informational?style=flat-square)](#)
[![Offline first](https://img.shields.io/badge/offline-first-16a34a?style=flat-square)](#)
[![Made in Brazil](https://img.shields.io/badge/made_in-Brasil-009c3b?style=flat-square)](#)

[Features](#features) · [Quick start](#quick-start) · [Keyboard shortcuts](#keyboard-shortcuts) · [Themes](#themes) · [Data & storage](#data--storage) · [Project structure](#project-structure) · [License](#license)

</div>

---

## O que é?

FinDek é um **planejador financeiro minimalista** com paleta verde e branca. Sem cadastro, sem anúncios, sem servidor — apenas uma tela que responde às perguntas que importam:

1. **Para onde foi meu dinheiro neste mês?**
2. **Quais contas ainda estão abertas?**
3. **Estou dentro dos meus orçamentos?**
4. **Onde o meu dinheiro rende mais no longo prazo?**

É uma adaptação financeira do [StudyTrack](https://github.com/), preservando a mesma arquitetura zero-dependência e offline-first.

## Features

<table>
<tr>
<td width="50%" valign="top">

**Dashboard**

- 9 cards vivos: gastos do mês, receitas, **saldo**, salário, gastos fixos, contas pendentes, uso de orçamento, notas e renda externa
- Cards **clicáveis** — cada um leva direto à área certa para editar
- **Saldo = salário + renda externa recebida − fixos pagos − gastos do mês**
- Anel de uso de orçamento com gasto/limite
- Barras horizontais de gasto **por categoria** (mês atual)
- *Próximas contas* ordenadas por vencimento
- Notas editadas recentemente em destaque

**Transações**

- Despesa / receita com valor (R$), categoria, vencimento e método de pagamento
- Marcar como pago com um clique — o histórico registra
- Filtros por categoria, tipo, status e *somente vencidas*
- 5 modos de ordenação: inteligente, data, valor, recentes, descrição
- Busca instantânea em descrição, categoria, método e anotações
- Selos coloridos de vencimento — *hoje*, *amanhã*, *vencida*
- Parcelas como sub-linhas expansíveis
- Sidebar de categorias com contadores de pendências

</td>
<td valign="top">

**Salário & Fixos**

- Salário por mês com resumo do saldo
- Gastos fixos como **checklist** — marque o que já pagou
- A cada fixo concluído o saldo do mês é recalculado na hora
- Resumo: salário, renda externa, fixos pagos, gastos e saldo

**Renda externa**

- Freelance, PJ e serviços com cliente, vencimento e anotações
- Checklist "recebida / pendente" com resumo do mês

**Investimentos** 🚀

- Cadastro de produtos: **Inter**, **Nubank**, **PagBank**, **Mercado Bitcoin** e outros
- Rendimento por % do CDI, taxa fixa anual ou expectativa de cripto
- **Simulação de médio/longo prazo**: informe aportes mensais e o horizonte (1–20 anos)
- **Ranking "onde rende mais"**: R$1.000/mês em cada produto lado a lado
- Taxas de **transferência (entrada)** e **resgate (fixa + %)** já descontadas
- CDI projetado ajustável e total líquido estimado

**Orçamentos**

- Limite mensal por categoria com barra de progresso
- Fica âmbar ao passar de 100% do limite
- Gasto calculado automaticamente das transações
- Checklist de metas com vencimento e sub-metas
- Links úteis (banco, fatura…) com copiar
- Notas Markdown por orçamento

**Notas**

- Editor com salvamento automático
- Markdown leve: `**negrito**`, `*itálico*`, `` `código` ``, listas, checklists, títulos
- Tags por nota e pin de destaques
- Contador de palavras e caracteres

**Todo o resto**

- ✅ 100% offline — zero requisições de rede
- ✅ Exportar & importar JSON
- ✅ Relógio e barra de status ao vivo
- ✅ Atalhos de teclado
- ✅ Responsivo (gaveta lateral no mobile)
- ✅ Papel de parede opcional com véu, transparência e blur

</td>
</tr>
</table>

## Quick start

**Sem build, sem package manager, sem instalar nada.**

```bash
git clone https://github.com/joaofantindev/FinDek.git
cd FinDek
```

Depois, uma das opções:

- **Dê dois cliques em `index.html`**, ou
- sirva localmente (recomendado para evitar detalhes de `file://`):

```bash
python -m http.server 8000     # depois abra http://localhost:8000
```

O primeiro acesso sembra 14 transações, 2 orçamentos, 3 notas, gastos fixos e produtos de investimento de exemplo. Vá em **Temas → Dados → Apagar tudo** para começar do zero.

## Keyboard shortcuts

| Tecla | Ação |
| :---- | :---- |
| <kbd>/</kbd> | Focar na busca |
| <kbd>N</kbd> | Nova transação |
| <kbd>Esc</kbd> | Fechar modal / gaveta |

## Themes

Todos os seis temas são variáveis CSS puras — sem imagens, sem folhas extras.

| Tema | Destaque | Ideal para |
| :--- | :------- | :--------- |
| **Verde** | `#16a34a` | Padrão. Fundo branco com acentos esmeralda. |
| **Floresta** | `#22c55e` | Verde escuro, agradável à noite. |
| **Hortelã** | `#0d9488` | Menta suave, fresco e calmo. |
| **Azul noite** | `#34d399` | Azul profundo com acento verde. |
| **Âmbar** | `#d97706` | Luz do dia quente. |
| **Papel** | `#16a34a` | Papel neutro para impressão. |

Escolher um **acento personalizado** é seguro: o app mede a cor e a escurece automaticamente até os rótulos dos botões ficarem legíveis (WCAG AA, ≥ 4.5:1). Use *Temas → Aparência → cor do tema* para voltar ao padrão.

## Data & storage

Tudo vive em `localStorage` — nada de servidor, nada de cookies:

| Chave | Conteúdo |
| :---- | :------- |
| `findek.transactions` | `Transaction[]` |
| `findek.notes` | `Note[]` |
| `findek.budgets` | `Budget[]` |
| `findek.salary` | Salários por mês (`YYYY-MM` → valor) |
| `findek.fixed` | `FixedExpense[]` (checklist de pagos) |
| `findek.external` | `ExternalIncome[]` (freelance/PJ) |
| `findek.investments` | `Investment[]` (produtos e taxas) |
| `findek.prefs` | Tema, acento, densidade, fonte, movimento, CDI projetado, horizonte |
| `findek.categories` | Nomes de categorias + cores |
| `findek.history` | Transações pagas (7 dias) |

Formato de transação:

```json
{
  "id": "m1x2y3z4ab",
  "title": "Mercado da semana",
  "category": "Alimentação",
  "type": "despesa",
  "amount": 432.5,
  "due": "2026-10-03",
  "method": "Cartão",
  "paid": true,
  "notes": "",
  "subtasks": [],
  "createdAt": 1772400000000,
  "completedAt": 1772400000500
}
```

Formato de produto de investimento:

```json
{
  "id": "p1x2y3z4ab",
  "bank": "Nubank",
  "name": "Caixinha 100% CDI",
  "kind": "cdi",
  "rate": 100,
  "balance": 2500,
  "aporte": 250,
  "inFee": 0,
  "outFee": 0,
  "outFeePct": 0
}
```

A interface é em português brasileiro. `type` é `despesa` ou `receita`; datas são ISO `YYYY-MM-DD`; valores são números exibidos como BRL na tela. `kind` de investimento é `cdi`, `pct` ou `crypto`.

> Limpar os dados do navegador apaga o `localStorage`. Use **Temas → Dados → Exportar** para um backup JSON.

## Project structure

```
FinDek/
├── index.html        # markup de todas as views
├── css/
│   └── style.css     # variáveis de tema, layout, componentes
├── js/
│   └── app.js        # estado, renderização, armazenamento, eventos
└── LICENSE
```

HTML, CSS e JavaScript puros — sem framework, sem bundler, sem dependências para instalar.

## License

Lançado sob a [Licença MIT](LICENSE).

---

<div align="center">

Feito para quem quer um lugar silencioso para ver o próprio dinheiro.

**Sem cookies. Sem trackers. Sem contas. Só verde, branco e os seus números.**

</div>