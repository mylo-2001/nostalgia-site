# Nostalgia Collection

Ελληνικό e-shop χειροποίητου αρώματος χώρου — κεριά, reed diffusers, perfume και σετ δώρου.  
Δίγλωσσο περιβάλλον (Ελληνικά / Αγγλικά), Express API, PostgreSQL και React admin σε ένα ενιαίο Node process.

| | |
|---|---|
| **Επιχείρηση** | Γεροστάθη Μαρία του Ιωάννη |
| **ΑΦΜ** | `066971593` |
| **ΓΕΜΗ** | `195495706000` |
| **Έδρα** | Θεσσαλονίκη |
| **Επικοινωνία** | `info@nostalgiacandle.gr` · `support@nostalgiacandle.gr` · `privacy@nostalgiacandle.gr` · `+30 693 941 1774` |

## Δομή project

```
nostalgia/
├── html/                 # Frontend — στατικές σελίδες (home, shop, checkout, account, …)
├── css/                  # Frontend — styles
├── js/                   # Frontend — storefront scripts (cart, checkout, i18n, …)
│   └── i18n-bundles/
├── images/               # Frontend — media
├── admin/                # Frontend — React admin (Vite)
│   └── src/
├── server/               # Backend — Express API + domain
│   ├── domain/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── payments/
│   ├── fiscal/
│   ├── notifications/
│   ├── workers/
│   ├── migrations/
│   └── data/
├── deploy/               # Nginx, systemd, cron, deploy helpers
├── scripts/              # Dev / seed / backup helpers
├── test/                 # Unit & integration tests
├── docs/                 # Internal docs
└── tools/                # One-off tooling
```

| Στρώμα | Φάκελοι | Ρόλος |
|---|---|---|
| **Frontend (storefront)** | `html/`, `css/`, `js/`, `images/` | Δημόσιο site |
| **Frontend (admin)** | `admin/` | React πίνακας διαχείρισης |
| **Backend** | `server/` | API, pricing, orders, payments, DB |
