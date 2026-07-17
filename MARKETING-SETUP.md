# Nostalgia Collection — Οδηγός Marketing & Analytics

Οδηγός για τον **ιδιοκτήτη του καταστήματος**. Ο ιστότοπος είναι έτοιμος να συνδεθεί με
εργαλεία marketing & στατιστικών. Εσύ χρειάζεται μόνο να **ανοίξεις τους λογαριασμούς**
και να στείλεις στον developer **3 κωδικούς (IDs)**. Τα υπόλοιπα τα κάνει ο developer.

> ✅ Ο ιστότοπος τηρεί το GDPR: **κανένα** εργαλείο δεν καταγράφει τίποτα μέχρι ο
> επισκέπτης να πατήσει «Αποδοχή» στο banner cookies. Δεν χρειάζεται να κάνεις κάτι γι' αυτό.

---

## Τι είναι το καθένα (με απλά λόγια)

| Εργαλείο | Τι κάνει | Κόστος |
|---|---|---|
| **Google Analytics 4** | Στατιστικά: πόσοι μπαίνουν, από πού, ποιες σελίδες βλέπουν, τι αγοράζουν. | Δωρεάν |
| **Meta Pixel** (Facebook/Instagram) | Παρακολουθεί τις πωλήσεις από διαφημίσεις Facebook/Instagram & επιτρέπει retargeting. | Δωρεάν |
| **Klaviyo** | Email marketing & newsletter — συλλέγει επισκέπτες για καμπάνιες email. | Δωρεάν (μικρό tier) |

Δεν είναι υποχρεωτικά και τα 3. Βάζουμε όσα θέλεις. Αν κάποιο δεν το θες τώρα, το προσθέτουμε αργότερα.

---

## 1) Google Analytics 4 (στατιστικά)

**Τι θα μου στείλεις:** το **Measurement ID** — έχει τη μορφή `G-XXXXXXXXXX`

**Βήματα:**
1. Πήγαινε στο **https://analytics.google.com** και συνδέσου με έναν λογαριασμό Google (Gmail).
2. Πάτα **Start measuring / Ξεκινήστε** → φτιάξε **Account** (π.χ. «Nostalgia Collection»).
3. Φτιάξε **Property** (τύπος: **Web**) → βάλε το όνομα και τη διεύθυνση του site.
4. Όταν ολοκληρωθεί, πήγαινε: **Admin (γρανάζι κάτω αριστερά) → Data streams → Web → [το stream σου]**.
5. Αντίγραψε το **Measurement ID** (πάνω δεξιά, `G-...`) και στείλ' το.

---

## 2) Meta Pixel (Facebook / Instagram διαφημίσεις)

**Τι θα μου στείλεις:** το **Pixel ID** — ένας αριθμός ~15–16 ψηφίων

**Βήματα:**
1. Χρειάζεσαι έναν **Facebook Business** λογαριασμό: **https://business.facebook.com**
2. Άνοιξε το **Events Manager**: https://business.facebook.com/events_manager
3. Πάτα **Connect data sources → Web → Create / Δημιουργία**.
4. Δώσε όνομα (π.χ. «Nostalgia Pixel»).
5. Στη σελίδα του Pixel θα δεις το **Pixel ID** (ο αριθμός). Στείλ' τον.

---

## 3) Klaviyo (email / newsletter)

**Τι θα μου στείλεις:** το **Public API Key** (6 χαρακτήρες — λέγεται και «Company ID / Site ID»)

**Βήματα:**
1. Φτιάξε λογαριασμό στο **https://www.klaviyo.com**
2. Πήγαινε: **Settings (κάτω αριστερά) → Account → API Keys**
3. Αντίγραψε το **Public API Key** (σύντομος κωδικός, π.χ. `AbC123`) και στείλ' το.

> ⚠️ Το Klaviyo έχει και **Private** API keys. **ΜΗΝ** στείλεις private key εδώ — μόνο το **Public**.
> (Private key χρειάζεται μόνο αν στέλνουμε αυτόματα email από τον server· αυτό μπαίνει ξεχωριστά, με ασφάλεια.)

---

## Ασφάλεια — τι είναι δημόσιο και τι μυστικό

- ✅ **Δημόσια** (στείλ' τα ελεύθερα, εμφανίζονται έτσι κι αλλιώς στον browser):
  GA4 Measurement ID, Meta Pixel ID, Klaviyo **Public** key.
- 🔒 **Μυστικά** (ΠΟΤΕ σε email/chat χωρίς ασφάλεια): Stripe **secret** key, κωδικοί πληρωμών,
  Klaviyo **Private** key, κωδικοί email/βάσης. Αυτά είναι ξεχωριστό θέμα από τα παραπάνω.

---

## ✅ Τι να μου στείλεις (checklist)

Αντίγραψε και συμπλήρωσε:

```
Google Analytics 4 (Measurement ID): G-________________
Meta Pixel (Pixel ID):               ________________
Klaviyo (Public API Key):            ________________
```

Μόλις τα λάβω, τα ενεργοποιώ στον ιστότοπο (5 λεπτά δουλειά) και ενημερώνω και τη σελίδα
«Πολιτική Cookies» με τα αντίστοιχα cookies.

---

## Σημειώσεις για τον developer

- Τα IDs μπαίνουν στο `js/tracking.js` → αντικείμενο `CONFIG`.
- Η φόρτωση είναι **consent-gated** (μέσω `js/cookies.js`): `analytics` → GA4, `marketing` → Meta Pixel + Klaviyo.
- Όποιο πεδίο μείνει `""` δεν φορτώνει.
- Αφού μπουν, ενημέρωσε τη σελίδα `/privacy#cookies` με: `_ga`, `_ga_*`, `_gid` (GA), `_fbp` (Meta), `__kla_id`, `__kla_session` (Klaviyo).
