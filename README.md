<div align="center">

<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='28' fill='%2316a34a'/%3E%3Cpath d='M30 88 52 62l16 14 30-34' fill='none' stroke='%23fff' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M76 42h22v22' fill='none' stroke='%23fff' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" width="104" alt="FinDek logo">

# FinDek

**A minimal personal finance tracker in green and white — transactions, budgets and notes.**

Zero dependencies · Runs offline · Everything in `localStorage`

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![No dependencies](https://img.shields.io/badge/dependencies-none-success?style=flat-square)](#)
[![No build step](https://img.shields.io/badge/build-none-informational?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Features](#features) · [Quick start](#quick-start) · [Keyboard shortcuts](#keyboard-shortcuts) · [Themes](#themes) · [Data & storage](#data--storage) · [Project structure](#project-structure) · [License](#license)

</div>

---

## What is it?

FinDek is a **clean, minimalist finance tracker** with a green-and-white palette. No accounts, no ads, no noise — just a single screen that answers three questions:

1. **Where did my money go this month?**
2. **Which bills are still open?**
3. **Am I inside my budgets?**

It is a finance-focused adaptation of [StudyTrack](https://github.com/), keeping the same zero-dependency, offline-first architecture.

## Features

<table>
<tr>
<td width="50%" valign="top">

**Dashboard**

- 6 live stat cards: month expenses, month income, balance, pending bills, budget usage, notes
- Budget usage ring with spent/limit amounts
- Horizontal bar chart of spending **per category** (current month)
- *Upcoming bills* list sorted by due date
- Recently edited notes at a glance

**Transactions**

- Expense / income with amount (R$), category, due date and payment method
- Mark as paid with one click — history records it
- Filters by category, type, status and *overdue only*
- 5 sort modes: smart, date, amount, recent, description
- Instant search across description, category, method and notes
- Colour-coded due badges — *hoje*, *amanhã*, *vencida*
- Installments ("parcelas") as expandable sub-rows
- Category sidebar with live pending counters

</td>
<td valign="top">

**Budgets**

- Monthly limit per category with live progress bar
- Turns amber when you pass 100% of the limit
- Spending is computed automatically from your transactions
- Goals checklist with due dates and sub-goals
- Useful links (bank, invoice, etc.) with copy-to-clipboard
- Markdown notes per budget

**Notes**

- Auto-saving editor — type, never lose anything
- Lightweight Markdown: `**bold**`, `*italic*`, `` `code` ``, lists, checklists, headings
- Toolbar buttons for all of it
- Tags per note (used as categories in search)
- Pin important notes to the top
- Live word and character counter

**Everything else**

- ✅ 100% offline, no network requests ever
- ✅ JSON export & import
- ✅ Live clock and status bar
- ✅ Keyboard shortcuts
- ✅ Fully responsive (mobile sidebar drawer)
- ✅ Optional wallpaper with veil, alpha and blur

</td>
</tr>
</table>

## Quick start

**No build step, no package manager, no install.**

```bash
git clone https://github.com/your-username/findek.git
cd findek
```

Then either:

- **Double-click `index.html`**, or
- serve it locally (recommended, avoids any `file://` quirks):

```bash
python -m http.server 8000     # then open http://localhost:8000
```

First launch seeds 14 example transactions, 2 budgets and 3 notes. Go to **Temas → Dados → Apagar tudo** to start from zero.

## Keyboard shortcuts

| Key | Action |
| :-- | :----- |
| <kbd>/</kbd> | Focus search |
| <kbd>N</kbd> | New transaction |
| <kbd>Esc</kbd> | Close modal / sidebar |

## Themes

All six themes are pure CSS custom properties — no image assets, no extra stylesheets.

| Theme | Accent | Best for |
| :----- | :----- | :------- |
| **Verde** | `#16a34a` | The default. White background, emerald accents. |
| **Floresta** | `#22c55e` | Dark green, easy on the eyes at night. |
| **Hortelã** | `#0d9488` | Soft mint, fresh and calm. |
| **Azul noite** | `#34d399` | Deep blue with a green accent. |
| **Âmbar** | `#d97706` | Warm daylight. |
| **Papel** | `#16a34a` | Neutral paper for printing. |

Picking a **custom accent** is safe: the app measures the colour and automatically darkens it until white button labels stay readable (WCAG AA, ≥ 4.5:1). Use *Temas → Aparência → cor do tema* to switch back.

## Data & storage

Everything lives in `localStorage` — no server, no cookies:

| Key | Contents |
| :--- | :------- |
| `findek.transactions` | `Transaction[]` |
| `findek.notes` | `Note[]` |
| `findek.budgets` | `Budget[]` |
| `findek.prefs` | Theme, accent, density, font, motion |
| `findek.categories` | Category names + colours |
| `findek.history` | Paid transactions (7 days) |

Transaction shape:

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

The UI is in Brazilian Portuguese. `type` is `despesa` or `receita`; dates are ISO `YYYY-MM-DD`; amounts are plain numbers formatted as BRL on screen.

> Clearing your browser data erases localStorage. Use **Temas → Dados → Exportar** for a JSON backup.

## Project structure

```
findek/
├── index.html        # markup for all six views
├── css/
│   └── style.css     # theme variables, layout, components
├── js/
│   └── app.js        # state, rendering, storage, events
└── LICENSE
```

Vanilla HTML, CSS and JavaScript — no framework, no bundler, no dependencies to install.

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

Made for people who want a quiet place to see their money.

**No cookies. No trackers. No accounts. Just green, white and your numbers.**

</div>
