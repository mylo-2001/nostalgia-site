(function () {
  "use strict";

  var UPDATED_EL = "11 Αυγούστου 2026";
  var UPDATED_EN = "11 August 2026";

  var PAGES = {
    terms: {
      el: {
        title: "Όροι Πώλησης και Χρήσης",
        eyebrow: "Νομικό κείμενο",
        lead: "Οι όροι που διέπουν τη χρήση του ιστοτόπου και κάθε παραγγελία από τη Nostalgia Collection.",
        sections: [
          ["seller", "1. Πωλητής και στοιχεία επικοινωνίας", [
            "Πωλητής είναι η ατομική επιχείρηση «Γεροστάθη Μαρία του Ιωάννη», με εμπορικό σήμα Nostalgia Collection, ΑΦΜ 066971593, ΓΕΜΗ 195495706000, ΔΟΥ Δ΄ Θεσσαλονίκης και έδρα Ιβηρίδος 2, 543 51 Θεσσαλονίκη. Email εξυπηρέτησης: support@nostalgiacandle.gr.",
            "Οι παρόντες όροι εφαρμόζονται στις πωλήσεις μέσω του nostalgiacandle.gr. Αναγκαστικές διατάξεις προστασίας καταναλωτή υπερισχύουν όπου παρέχουν ευρύτερα δικαιώματα."
          ]],
          ["products", "2. Προϊόντα και διαθεσιμότητα", [
            "Καταβάλλουμε εύλογη προσπάθεια ώστε περιγραφές, διαστάσεις, υλικά, φωτογραφίες και διαθεσιμότητα να είναι ακριβή. Τα χειροποίητα προϊόντα μπορεί να παρουσιάζουν μικρές, μη ουσιώδεις διαφοροποιήσεις σε χρώμα, σχήμα ή υφή.",
            "Η εμφάνιση προϊόντος στον ιστότοπο δεν αποτελεί από μόνη της αποδοχή παραγγελίας. Αν προϊόν δεν είναι διαθέσιμο, δεν ολοκληρώνεται η αγορά ή επικοινωνούμε μαζί σας χωρίς αδικαιολόγητη καθυστέρηση."
          ]],
          ["ordering", "3. Παραγγελία και σύναψη σύμβασης", [
            "Πριν την υποβολή μπορείτε να ελέγξετε και να διορθώσετε προϊόντα, ποσότητες, στοιχεία παράδοσης και συνολικό τίμημα. Η παραγγελία υποβάλλεται μόνο αφού αποδεχθείτε ρητά τους ισχύοντες Όρους Πώλησης.",
            "Η αυτόματη παραλαβή αιτήματος δεν σημαίνει ότι έχει γίνει δεκτή η παραγγελία. Η σύμβαση ολοκληρώνεται όταν επιβεβαιωθεί επιτυχώς η πληρωμή και σας αποσταλεί επιβεβαίωση παραγγελίας σε σταθερό μέσο, συνήθως με email."
          ]],
          ["prices", "4. Τιμές, ΦΠΑ και επιβαρύνσεις", [
            "Οι τιμές εμφανίζονται σε ευρώ και περιλαμβάνουν τον εφαρμοζόμενο ΦΠΑ. Μεταφορικά και τυχόν λοιπές επιβαρύνσεις εμφανίζονται χωριστά πριν από την τελική υποβολή.",
            "Όταν ανακοινώνεται μείωση τιμής, ως τιμή αναφοράς εμφανίζεται κατά κανόνα η χαμηλότερη τιμή που εφαρμόστηκε στις προηγούμενες 30 ημέρες, με την επιφύλαξη τυχόν ειδικών νόμιμων κανόνων. Τηρούμε χρονικό ιστορικό των πραγματικά εφαρμοσμένων τιμών ανά προϊόν και παραλλαγή.",
            "Σε περίπτωση προφανούς τεχνικού σφάλματος τιμής δεν δεσμευόμαστε να εκτελέσουμε την παραγγελία στη λανθασμένη τιμή. Θα σας ενημερώσουμε και δεν θα πραγματοποιηθεί χρέωση χωρίς νέα επιβεβαίωση."
          ]],
          ["payment", "5. Πληρωμή", [
            "Η προβλεπόμενη μέθοδος πληρωμής είναι κάρτα μέσω φιλοξενούμενης σελίδας της Worldline. Η λειτουργία δεν είναι ακόμη ενεργή και καμία παραγγελία ή χρέωση με κάρτα δεν ολοκληρώνεται μέχρι να ενσωματωθεί και να δοκιμαστεί η επίσημη διασύνδεση Worldline.",
            "Όταν ενεργοποιηθεί, η Nostalgia δεν θα λαμβάνει ούτε θα αποθηκεύει πλήρη αριθμό κάρτας ή CVV. Οι ακριβείς όροι πληρωμής θα ενημερωθούν βάσει της επίσημης τεκμηρίωσης της Worldline πριν την ενεργοποίηση."
          ]],
          ["delivery", "6. Αποστολή και παράδοση", [
            "Οι διαθέσιμοι προορισμοί, τα μεταφορικά και οι εκτιμώμενοι χρόνοι αναφέρονται στην <a href='/shipping-returns'>Πολιτική Αποστολών και Επιστροφών</a> και εμφανίζονται πριν από την αγορά.",
            "Ο κίνδυνος απώλειας ή ζημίας παραμένει στον πωλητή μέχρι να παραλάβετε εσείς ή τρίτο πρόσωπο που έχετε ορίσει, εκτός αν επιλέξετε ανεξάρτητο μεταφορέα που δεν προτάθηκε από εμάς."
          ]],
          ["withdrawal", "7. Υπαναχώρηση και επιστροφές", [
            "Ο καταναλωτής μπορεί να υπαναχωρήσει χωρίς αιτιολογία εντός 14 ημερών από την ημέρα που παρέλαβε το προϊόν, σύμφωνα με τις νόμιμες προϋποθέσεις. Αναλυτικές οδηγίες, κόστος επιστροφής και υπόδειγμα δήλωσης υπάρχουν στην <a href='/cancellations'>Πολιτική Ακυρώσεων και Υπαναχώρησης</a>.",
            "Η υπαναχώρηση είναι διαφορετική από τα δικαιώματα για ελαττωματικό ή μη σύμφωνο προϊόν, τα οποία δεν περιορίζονται από την πολιτική επιστροφών."
          ]],
          ["conformity", "8. Νόμιμη εγγύηση συμμόρφωσης", [
            "Για προϊόν που είναι ελαττωματικό, δεν ανταποκρίνεται στην περιγραφή ή δεν έχει τις συμφωνημένες ιδιότητες, ισχύει η νόμιμη εγγύηση συμμόρφωσης. Οι διαθέσιμες λύσεις περιγράφονται στην <a href='/warranty'>Πολιτική Εγγυήσεων και Ελαττωματικών Προϊόντων</a>.",
            "Καμία διατύπωση των παρόντων όρων δεν αποκλείει ή περιορίζει δικαιώματα που παρέχονται υποχρεωτικά από την ελληνική και ενωσιακή νομοθεσία."
          ]],
          ["cancellation", "9. Ακύρωση πριν από την αποστολή", [
            "Μπορείτε να ζητήσετε ακύρωση χωρίς χρέωση πριν η παραγγελία παραδοθεί στον μεταφορέα. Μετά την αποστολή εφαρμόζεται το δικαίωμα υπαναχώρησης και οι κανόνες επιστροφής."
          ]],
          ["content", "10. Χρήση ιστοτόπου και πνευματική ιδιοκτησία", [
            "Το περιεχόμενο, τα διακριτικά γνωρίσματα, οι φωτογραφίες και τα κείμενα προστατεύονται από την εφαρμοστέα νομοθεσία. Δεν επιτρέπεται εμπορική αντιγραφή, αναδημοσίευση ή εκμετάλλευση χωρίς προηγούμενη άδεια.",
            "Δεν επιτρέπεται χρήση του ιστοτόπου για παράνομη δραστηριότητα, παραβίαση ασφάλειας, αυτοματοποιημένη κατάχρηση ή παρεμπόδιση της λειτουργίας του."
          ]],
          ["privacy", "11. Προσωπικά δεδομένα", [
            "Η επεξεργασία προσωπικών δεδομένων περιγράφεται στην <a href='/privacy'>Πολιτική Απορρήτου</a> και η χρήση τεχνολογιών αποθήκευσης στην <a href='/cookie-policy'>Πολιτική Cookies</a>. Η αποδοχή των όρων πώλησης δεν αποτελεί συγκατάθεση για marketing ή προαιρετικά cookies."
          ]],
          ["reviews", "12. Αξιολογήσεις προϊόντων", [
            "Δημοσιεύουμε θετικές και αρνητικές αξιολογήσεις με τους ίδιους κανόνες περιεχομένου και επισημαίνουμε χωριστά όσες συνδέονται με επαληθευμένη αγορά. Ο τρόπος συλλογής, ελέγχου και υπολογισμού της βαθμολογίας περιγράφεται στην <a href='/review-policy'>Πολιτική Αξιολογήσεων</a>."
          ]],
          ["law", "13. Παράπονα, καταγγελίες, εφαρμοστέο δίκαιο και αλλαγές", [
            "Για παράπονο ή εξωδικαστική επίλυση επικοινωνήστε πρώτα στο support@nostalgiacandle.gr. Διατηρείτε το δικαίωμα προσφυγής στις αρμόδιες αρχές ή στα δικαστήρια που ορίζει η υποχρεωτική νομοθεσία προστασίας καταναλωτή.",
            "Για καταγγελία σχετική με καταναλωτικά προϊόντα ή υπηρεσίες μπορείτε να χρησιμοποιήσετε την επίσημη υπηρεσία <a href='https://www.gov.gr/ipiresies/polites-kai-kathemerinoteta/kataggelies/kataggelia-katanalote' target='_blank' rel='noopener noreferrer'>Καταγγελία καταναλωτή στο gov.gr</a>. Για εξωδικαστική επίλυση διαφορών μπορείτε να απευθυνθείτε στον <a href='https://www.synigoroskatanaloti.gr/' target='_blank' rel='noopener noreferrer'>Συνήγορο του Καταναλωτή</a>. Για διασυνοριακή αγορά δείτε το <a href='https://www.eccgreece.gr/' target='_blank' rel='noopener noreferrer'>Ευρωπαϊκό Κέντρο Καταναλωτή Ελλάδας (ΕΚΚ)</a>.",
            "Η γενική σελίδα <a href='https://european-union.europa.eu/contact-eu/make-complaint_el?prefLang=el' target='_blank' rel='noopener noreferrer'>Υποβολής καταγγελίας στην Ευρωπαϊκή Ένωση</a> αφορά ιδίως παραβιάσεις του δικαίου της ΕΕ από κράτος μέλος, κακοδιοίκηση οργάνων της ΕΕ, αναφορές στο Ευρωπαϊκό Κοινοβούλιο και υποθέσεις OLAF· δεν αποτελεί υπηρεσία επίλυσης μιας συνήθους διαφοράς παραγγελίας με το κατάστημα.",
            "Εφαρμόζεται το ελληνικό δίκαιο, χωρίς να στερείται καταναλωτής άλλου κράτους ΕΕ την αναγκαστική προστασία που του παρέχει το δίκαιο της συνήθους διαμονής του. Οι αλλαγές ισχύουν για μελλοντικές παραγγελίες και η ημερομηνία έκδοσης εμφανίζεται στην παρούσα σελίδα."
          ]]
        ]
      },
      en: {
        title: "Terms of Sale and Use",
        eyebrow: "Legal notice",
        lead: "The terms governing use of the website and every order placed with Nostalgia Collection.",
        sections: [
          ["seller", "1. Seller and contact details", ["The seller is the Greek sole proprietorship Gerostathi Maria tou Ioanni, trading as Nostalgia Collection, Greek tax number 066971593, GEMI 195495706000, D΄ Thessaloniki tax office, registered at 2 Iviridos St., 543 51 Thessaloniki, Greece. Support: support@nostalgiacandle.gr.", "These terms apply to sales through nostalgiacandle.gr. Mandatory consumer law prevails wherever it grants broader rights."]],
          ["products", "2. Products and availability", ["We take reasonable care to keep descriptions, dimensions, materials, photographs and availability accurate. Handmade items may have small, non-material variations in colour, shape or texture.", "Displaying a product is not acceptance of an order. If an item is unavailable, the purchase will not complete or we will contact you without undue delay."]],
          ["ordering", "3. Ordering and contract formation", ["Before submission you can review and correct products, quantities, delivery details and the total price. An order can be submitted only after expressly accepting the current Terms of Sale.", "An automated acknowledgement is not acceptance. The contract is concluded after payment is successfully confirmed and an order confirmation is sent to you on a durable medium, normally by email."]],
          ["prices", "4. Prices, VAT and charges", ["Prices are in euro and include applicable VAT. Delivery and any other charge are shown separately before final submission.", "When a price reduction is announced, the reference price shown is generally the lowest price applied during the preceding 30 days, subject to any specific statutory rules. We keep a time-based history of prices actually applied to each product and variant.", "We are not required to fulfil an order at an obvious technical pricing error. We will notify you and no payment will be taken without renewed confirmation."]],
          ["payment", "5. Payment", ["The planned payment method is card payment on Worldline's hosted page. It is not active yet: no card order or charge can complete until the official Worldline integration is implemented and tested.", "Once enabled, Nostalgia will not receive or store full card numbers or CVV. The exact payment wording will be updated against Worldline's official documentation before activation."]],
          ["delivery", "6. Shipping and delivery", ["Destinations, charges and estimated times are set out in the <a href='/shipping-returns'>Shipping and Returns Policy</a> and displayed before purchase.", "Risk of loss or damage remains with the seller until you or a person designated by you receives the goods, unless you independently appoint a carrier not offered by us."]],
          ["withdrawal", "7. Withdrawal and returns", ["A consumer may withdraw without giving a reason within 14 days after receiving the goods, subject to the statutory conditions. Instructions, return costs and a model notice are in the <a href='/cancellations'>Cancellation and Withdrawal Policy</a>.", "Withdrawal is separate from remedies for faulty or non-conforming goods, which are not limited by the return policy."]],
          ["conformity", "8. Legal guarantee of conformity", ["If goods are faulty, differ from their description or lack agreed qualities, the legal guarantee of conformity applies. Remedies are described in the <a href='/warranty'>Guarantee and Faulty Products Policy</a>.", "Nothing in these terms excludes or limits rights mandatorily granted by Greek or EU law."]],
          ["cancellation", "9. Cancellation before dispatch", ["You may request cancellation without charge before the parcel is handed to the carrier. After dispatch, withdrawal and return rules apply."]],
          ["content", "10. Website use and intellectual property", ["Content, trade marks, photographs and text are protected by applicable law. Commercial copying, republication or exploitation requires prior permission.", "The website must not be used for unlawful activity, security attacks, automated abuse or interference with its operation."]],
          ["privacy", "11. Personal data", ["Personal-data processing is described in the <a href='/privacy'>Privacy Policy</a> and storage technologies in the <a href='/cookie-policy'>Cookie Policy</a>. Accepting sales terms is not consent to marketing or optional cookies."]],
          ["reviews", "12. Product reviews", ["Positive and negative reviews are published under the same content rules, and reviews linked to a verified purchase are identified separately. Collection, moderation and rating calculation are explained in the <a href='/review-policy'>Review Policy</a>."]],
          ["law", "13. Complaints, redress, governing law and changes", [
            "For a complaint or an attempt at informal resolution, contact support@nostalgiacandle.gr first. You retain any right to approach competent authorities or courts under mandatory consumer law.",
            "For complaints about consumer products or services, you may use the official <a href='https://www.gov.gr/ipiresies/polites-kai-kathemerinoteta/kataggelies/kataggelia-katanalote' target='_blank' rel='noopener noreferrer'>consumer complaint service on gov.gr</a>. For alternative dispute resolution, you may contact the Greek <a href='https://www.synigoroskatanaloti.gr/' target='_blank' rel='noopener noreferrer'>Consumer Ombudsman</a>. For cross-border purchases, see the <a href='https://www.eccgreece.gr/' target='_blank' rel='noopener noreferrer'>European Consumer Centre Greece</a>.",
            "The general <a href='https://european-union.europa.eu/contact-eu/make-complaint_en' target='_blank' rel='noopener noreferrer'>European Union complaint page</a> primarily covers breaches of EU law by a Member State, maladministration by EU bodies, petitions to the European Parliament and OLAF matters; it is not a service for resolving an ordinary order dispute with the store.",
            "Greek law applies without depriving an EU consumer of mandatory protection available in their country of habitual residence. Changes apply to future orders and the issue date is shown on this page."
          ]]
        ]
      }
    },
    "cookie-policy": {
      el: {
        title: "Πολιτική Cookies",
        eyebrow: "Έλεγχος επιλογών",
        lead: "Τι αποθηκεύεται στη συσκευή σας, για ποιον σκοπό και πώς αλλάζετε επιλογές.",
        sections: [
          ["what", "1. Τι είναι τα cookies", ["Cookies και παρόμοιες τεχνολογίες είναι μικρά δεδομένα που αποθηκεύονται ή διαβάζονται από τον browser. Χρησιμοποιούνται για βασικές λειτουργίες, προτιμήσεις και, μόνο με συγκατάθεση, στατιστικά ή marketing."]],
          ["controller", "2. Υπεύθυνος", ["Υπεύθυνη επεξεργασίας είναι η Γεροστάθη Μαρία του Ιωάννη, Nostalgia Collection, Ιβηρίδος 2, 543 51 Θεσσαλονίκη. Για ερωτήματα: privacy@nostalgiacandle.gr."]],
          ["categories", "3. Κατηγορίες", ["<strong>Απολύτως απαραίτητα:</strong> συνεδρία σύνδεσης, ασφάλεια, καλάθι, γλώσσα, θέμα και αποθήκευση της επιλογής cookies. Λειτουργούν χωρίς προαιρετική συγκατάθεση επειδή είναι αναγκαία για υπηρεσία που ζητάτε ή για ασφάλεια.", "<strong>Analytics:</strong> Google Analytics για ψευδωνυμοποιημένη μέτρηση χρήσης, μόνο μετά από επιλογή σας.", "<strong>Marketing:</strong> Meta Pixel και Klaviyo on-site, μόνο μετά από επιλογή σας και μόνο αν έχουν ενεργοποιηθεί από το κατάστημα."]],
          ["list", "4. Αναλυτικός κατάλογος", ["Ο πλήρης και επικαιροποιημένος πίνακας ονομάτων, παρόχων, σκοπών και διάρκειας βρίσκεται στην ενότητα <a href='/privacy#cookies'>Cookies της Πολιτικής Απορρήτου</a>. Η παρούσα σελίδα εξηγεί τον μηχανισμό επιλογών και ο πίνακας αποτελεί μέρος της."]],
          ["choice", "5. Συγκατάθεση και ανάκληση", ["Στην πρώτη επίσκεψη μπορείτε να αποδεχθείτε όλα, να απορρίψετε όλα τα προαιρετικά ή να επιλέξετε ανεξάρτητα analytics και marketing. Οι προαιρετικές επιλογές είναι εξ αρχής απενεργοποιημένες.", "Η ανάκληση είναι διαθέσιμη οποτεδήποτε από το κουμπί παρακάτω και είναι τόσο εύκολη όσο η παροχή συγκατάθεσης. Μετά την ανάκληση σταματά η μελλοντική φόρτωση και γίνεται προσπάθεια διαγραφής γνωστών προαιρετικών cookies/local-storage keys από το συγκεκριμένο browser." ]],
          ["evidence", "6. Απόδειξη επιλογής και διάρκεια", ["Η επιλογή στον browser ισχύει έως ένα έτος. Καταγράφουμε στην πλευρά του server έναν τυχαίο αναγνωριστικό browser, τις κατηγορίες, την ώρα, την πηγή και την έκδοση πολιτικής. Δεν συνδέεται με λογαριασμό και δεν αποθηκεύουμε IP ή user-agent στην εγγραφή συγκατάθεσης.", "Το ιστορικό επιλογών τηρείται έως 60 μήνες για απόδειξη συγκατάθεσης ή ανάκλησης και επίλυση διαφορών."]],
          ["browser", "7. Ρυθμίσεις browser και αλλαγές", ["Μπορείτε επίσης να διαγράψετε ή να αποκλείσετε cookies από τις ρυθμίσεις του browser. Η διαγραφή απαραίτητων δεδομένων μπορεί να αποσυνδέσει τον λογαριασμό ή να αδειάσει τοπικές προτιμήσεις.", "Αν προστεθεί νέος προαιρετικός σκοπός ή πάροχος, ενημερώνουμε την πολιτική και ζητούμε νέα συγκατάθεση όπου απαιτείται."]]
        ],
        action: "Ρυθμίσεις cookies"
      },
      en: {
        title: "Cookie Policy", eyebrow: "Choice and control", lead: "What is stored on your device, why it is used and how you change your choices.",
        sections: [
          ["what", "1. What cookies are", ["Cookies and similar technologies are small pieces of data stored or read by a browser. They support essential functions and preferences and, only with consent, analytics or marketing."]],
          ["controller", "2. Controller", ["The controller is Gerostathi Maria tou Ioanni, trading as Nostalgia Collection, 2 Iviridos St., 543 51 Thessaloniki, Greece. Contact: privacy@nostalgiacandle.gr."]],
          ["categories", "3. Categories", ["<strong>Strictly necessary:</strong> sign-in session, security, cart, language, theme and cookie-choice storage. These operate without optional consent because they are needed for a requested service or security.", "<strong>Analytics:</strong> Google Analytics pseudonymous usage measurement, only after your choice.", "<strong>Marketing:</strong> Meta Pixel and Klaviyo on-site, only after your choice and only if enabled by the store."]],
          ["list", "4. Detailed list", ["The current table of names, providers, purposes and durations is in the <a href='/privacy#cookies'>Cookies section of the Privacy Policy</a>. It forms part of this policy."]],
          ["choice", "5. Consent and withdrawal", ["On the first visit you may accept all, reject every optional category or independently choose analytics and marketing. Optional categories are off by default.", "You may withdraw at any time using the button below. Future loading stops and the site attempts to clear known optional cookies and local-storage keys from this browser."]],
          ["evidence", "6. Choice record and retention", ["The browser choice lasts up to one year. The server records a random browser id, categories, time, source and policy version. It is not linked to an account, and the consent record does not store an IP address or user-agent.", "Choice history is kept for up to 60 months to demonstrate consent or withdrawal and resolve disputes."]],
          ["browser", "7. Browser settings and changes", ["You can also remove or block cookies through browser settings. Removing essential data may sign you out or clear local preferences.", "If a new optional purpose or provider is introduced, we update the policy and request fresh consent where required."]]
        ], action: "Cookie settings"
      }
    },
    warranty: {
      el: {
        title: "Εγγυήσεις και Ελαττωματικά Προϊόντα", eyebrow: "Νόμιμη προστασία", lead: "Τι ισχύει όταν ένα προϊόν είναι ελαττωματικό ή δεν ανταποκρίνεται στη συμφωνία.",
        sections: [
          ["legal", "1. Νόμιμη εγγύηση συμμόρφωσης", ["Τα προϊόντα καλύπτονται από τη νόμιμη εγγύηση συμμόρφωσης. Για καταναλωτικές πωλήσεις στην ΕΕ παρέχεται τουλάχιστον διετής προστασία από την παράδοση για έλλειψη συμμόρφωσης που υπήρχε κατά την παράδοση και εμφανίζεται μέσα στη νόμιμη περίοδο.", "Η νόμιμη εγγύηση παρέχεται χωρίς πρόσθετη χρέωση και δεν επηρεάζεται από την πολιτική υπαναχώρησης."]],
          ["meaning", "2. Πότε ένα προϊόν δεν συμμορφώνεται", ["Ενδεικτικά, όταν δεν ανταποκρίνεται στην περιγραφή ή στο δείγμα, δεν έχει τις συμφωνημένες ιδιότητες, δεν είναι κατάλληλο για τη συνήθη χρήση ή παραδίδεται διαφορετικό από την παραγγελία.", "Μικρές φυσικές διαφοροποιήσεις χειροποίητου προϊόντος που είχαν γνωστοποιηθεί και δεν επηρεάζουν χρήση ή ασφάλεια δεν αποτελούν από μόνες τους ελάττωμα."]],
          ["remedies", "3. Διαθέσιμες λύσεις", ["Επικοινωνήστε χωρίς αδικαιολόγητη καθυστέρηση. Ανάλογα με τις νόμιμες προϋποθέσεις, δικαιούστε αποκατάσταση ή αντικατάσταση χωρίς χρέωση. Αν αυτά είναι αδύνατα, δυσανάλογα ή δεν ολοκληρωθούν σε εύλογο χρόνο χωρίς σημαντική ενόχληση, μπορεί να δικαιούστε μείωση τιμής ή λύση της σύμβασης και επιστροφή χρημάτων.", "Η επιλεγόμενη λύση εξαρτάται από τη φύση του ελαττώματος και τους υποχρεωτικούς κανόνες της νομοθεσίας· δεν περιορίζουμε εκ των προτέρων τα νόμιμα δικαιώματα."
          ]],
          ["report", "4. Πώς υποβάλλεται αίτημα", ["Στείλτε στο support@nostalgiacandle.gr ή μέσω της <a href='/contact'>επικοινωνίας</a> τον αριθμό παραγγελίας, περιγραφή του προβλήματος και, όπου βοηθά, φωτογραφίες προϊόντος και συσκευασίας. Οι φωτογραφίες διευκολύνουν τη διάγνωση αλλά δεν αποτελούν αυτόματα προϋπόθεση νόμιμου δικαιώματος.", "Μην αποστείλετε προϊόν πριν λάβετε οδηγίες, ώστε να δοθεί σωστή διεύθυνση και τρόπος μεταφοράς. Για επιβεβαιωμένη έλλειψη συμμόρφωσης δεν επιβαρύνεστε με τα αναγκαία έξοδα αποκατάστασης ή επιστροφής."]],
          ["commercial", "5. Εμπορική εγγύηση", ["Δεν παρέχεται πρόσθετη εμπορική εγγύηση εκτός αν αναγράφεται ρητά στη σελίδα συγκεκριμένου προϊόντος ή σε συνοδευτικό έγγραφο. Τυχόν εμπορική εγγύηση λειτουργεί επιπλέον και δεν αντικαθιστά τη νόμιμη εγγύηση."]],
          ["care", "6. Φθορά και σωστή χρήση", ["Η νόμιμη εγγύηση δεν καλύπτει ζημία που προκλήθηκε μετά την παράδοση από ατύχημα, μη τήρηση οδηγιών ασφάλειας, ακατάλληλη αποθήκευση ή φυσιολογική κατανάλωση του προϊόντος. Αυτό δεν επηρεάζει περίπτωση όπου η ζημία οφείλεται σε αρχική έλλειψη συμμόρφωσης."]]
        ]
      },
      en: {
        title: "Guarantees and Faulty Products", eyebrow: "Statutory protection", lead: "What applies when goods are faulty or do not conform to the contract.",
        sections: [
          ["legal", "1. Legal guarantee of conformity", ["Products are covered by the legal guarantee of conformity. EU consumer sales carry at least two years of protection from delivery for a lack of conformity that existed at delivery and becomes apparent within the statutory period.", "The legal guarantee is free and is separate from the right of withdrawal."]],
          ["meaning", "2. When goods do not conform", ["Examples include goods that differ from their description or sample, lack agreed qualities, are unsuitable for normal use or differ from what was ordered.", "Small disclosed variations inherent in handmade goods that do not affect use or safety are not by themselves defects."]],
          ["remedies", "3. Available remedies", ["Contact us without undue delay. Subject to statutory conditions, you are entitled to free repair or replacement. If these are impossible, disproportionate, or not completed within a reasonable time and without significant inconvenience, you may be entitled to a price reduction or termination and refund.", "The remedy depends on the defect and mandatory law; statutory rights are not limited in advance."]],
          ["report", "4. Making a claim", ["Email support@nostalgiacandle.gr or use <a href='/contact'>Contact</a> with the order number, a description and, where useful, photographs of the goods and packaging. Photographs help assessment but are not automatically a condition of a statutory right.", "Wait for return instructions so the correct address and method can be provided. Necessary remedy or return costs for confirmed non-conformity are not charged to you."]],
          ["commercial", "5. Commercial warranty", ["No additional commercial warranty is offered unless expressly stated on a product page or accompanying document. Any commercial warranty is additional and never replaces the legal guarantee."]],
          ["care", "6. Damage and proper use", ["The legal guarantee does not cover damage caused after delivery by accident, failure to follow safety instructions, unsuitable storage or normal consumption. This does not affect damage caused by an original lack of conformity."]]
        ]
      }
    },
    cancellations: {
      el: {
        title: "Ακυρώσεις, Υπαναχώρηση και Επιστροφές", eyebrow: "Δικαίωμα επιλογής", lead: "Πώς ακυρώνετε πριν την αποστολή ή υπαναχωρείτε μετά την παραλαβή.",
        sections: [
          ["before-dispatch", "1. Ακύρωση πριν την αποστολή", ["Ζητήστε ακύρωση το συντομότερο δυνατό μέσω support@nostalgiacandle.gr ή της <a href='/contact'>επικοινωνίας</a>, αναφέροντας αριθμό παραγγελίας. Αν το δέμα δεν έχει παραδοθεί στον μεταφορέα, ακυρώνουμε χωρίς χρέωση και επιστρέφουμε κάθε ποσό που καταβλήθηκε με την αρχική μέθοδο πληρωμής.", "Αν έχει ήδη αποσταλεί, η ακύρωση μετατρέπεται σε άσκηση υπαναχώρησης μετά την παραλαβή, εφόσον πληρούνται οι νόμιμες προϋποθέσεις."]],
          ["withdrawal", "2. Δικαίωμα υπαναχώρησης 14 ημερών", ["Ο καταναλωτής μπορεί να υπαναχωρήσει από εξ αποστάσεως αγορά χωρίς αιτιολογία εντός 14 ημερών από την ημέρα που ο ίδιος ή τρίτος που όρισε παρέλαβε το προϊόν. Για περισσότερα προϊόντα της ίδιας παραγγελίας που παραδίδονται χωριστά, η προθεσμία αρχίζει από την παραλαβή του τελευταίου.", "Αρκεί να αποστείλετε σαφή δήλωση πριν λήξει η προθεσμία. Δεν απαιτείται ειδικός τύπος ή αιτιολογία."]],
          ["return", "3. Επιστροφή προϊόντων", ["Μετά τη δήλωση υπαναχώρησης επιστρέφετε τα προϊόντα χωρίς αδικαιολόγητη καθυστέρηση και το αργότερο εντός 14 ημερών, ακολουθώντας τις οδηγίες που θα σας αποσταλούν.", "Επιβαρύνεστε με το άμεσο κόστος επιστροφής για απλή υπαναχώρηση, εκτός αν συμφωνήσουμε διαφορετικά. Για ελαττωματικό ή λάθος προϊόν εφαρμόζεται η <a href='/warranty'>Πολιτική Εγγυήσεων</a> και δεν επιβαρύνεστε με τα αναγκαία έξοδα."]],
          ["inspection", "4. Έλεγχος και μείωση αξίας", ["Μπορείτε να χειριστείτε το προϊόν μόνο όσο είναι αναγκαίο για να διαπιστώσετε φύση, χαρακτηριστικά και λειτουργία, όπως θα μπορούσατε σε φυσικό κατάστημα. Ευθύνεστε μόνο για μείωση αξίας που προκύπτει από χειρισμό πέρα από αυτό το αναγκαίο μέτρο.", "Η αρχική συσκευασία βοηθά στην ασφαλή επιστροφή, αλλά η απουσία της δεν καταργεί αυτομάτως το νόμιμο δικαίωμα υπαναχώρησης. Ενδέχεται να αξιολογηθεί πραγματική μείωση αξίας."]],
          ["refund", "5. Επιστροφή χρημάτων", ["Επιστρέφουμε τα ποσά που λάβαμε, συμπεριλαμβανομένου του κόστους της οικονομικότερης τυπικής παράδοσης που προσφέραμε, εντός 14 ημερών από την ενημέρωση για υπαναχώρηση. Μπορούμε να παρακρατήσουμε την επιστροφή έως ότου παραλάβουμε τα προϊόντα ή λάβουμε απόδειξη αποστολής, όποιο συμβεί πρώτο.", "Η επιστροφή γίνεται με την ίδια μέθοδο πληρωμής, εκτός αν συμφωνήσετε ρητά διαφορετικά και χωρίς πρόσθετη επιβάρυνση για εσάς."]],
          ["exceptions", "6. Νόμιμες εξαιρέσεις", ["Το δικαίωμα υπαναχώρησης δεν εφαρμόζεται μόνο στις περιπτώσεις που εξαιρούνται υποχρεωτικά από τον νόμο, όπως προϊόντα κατασκευασμένα σύμφωνα με σαφώς προσωπικές προδιαγραφές. Τυχόν σχετική εξαίρεση θα γνωστοποιείται καθαρά πριν από την αγορά· δεν θεωρούμε ένα προϊόν εξαιρούμενο απλώς επειδή είναι χειροποίητο."]],
          ["model", "7. Υπόδειγμα δήλωσης", ["Προς: Nostalgia Collection, Γεροστάθη Μαρία του Ιωάννη, Ιβηρίδος 2, 543 51 Θεσσαλονίκη, support@nostalgiacandle.gr.<br><br>Σας γνωστοποιώ ότι υπαναχωρώ από τη σύμβαση πώλησης των ακόλουθων αγαθών: [περιγραφή]. Αριθμός παραγγελίας: [αριθμός]. Ημερομηνία παραγγελίας/παραλαβής: [ημερομηνίες]. Ονοματεπώνυμο και διεύθυνση καταναλωτή: [στοιχεία]. Ημερομηνία: [ημερομηνία]. Υπογραφή απαιτείται μόνο αν η δήλωση αποσταλεί σε χαρτί."]]
        ]
      },
      en: {
        title: "Cancellations, Withdrawal and Returns", eyebrow: "Your right to choose", lead: "How to cancel before dispatch or withdraw after delivery.",
        sections: [
          ["before-dispatch", "1. Cancellation before dispatch", ["Request cancellation promptly through support@nostalgiacandle.gr or <a href='/contact'>Contact</a>, quoting the order number. If the parcel has not been handed to the carrier, we cancel without charge and return any payment to the original method.", "After dispatch, cancellation becomes a withdrawal after receipt, subject to statutory conditions."]],
          ["withdrawal", "2. 14-day right of withdrawal", ["A consumer may withdraw from a distance purchase without giving a reason within 14 days after the consumer or a designated third party receives the goods. Where one order is delivered separately, the period begins on receipt of the last item.", "A clear statement sent before the deadline is sufficient. No prescribed form or reason is required."]],
          ["return", "3. Returning goods", ["After notifying withdrawal, return the goods without undue delay and no later than 14 days, following the instructions provided.", "You bear the direct return cost for a change-of-mind withdrawal unless agreed otherwise. For faulty or incorrect goods, the <a href='/warranty'>Guarantee Policy</a> applies and necessary costs are not charged to you."]],
          ["inspection", "4. Inspection and diminished value", ["You may handle goods only as needed to establish their nature, characteristics and functioning, as in a shop. You are liable only for diminished value caused by handling beyond that necessary level.", "Original packaging helps safe transport, but its absence does not automatically remove the statutory right. Any actual diminished value may be assessed."]],
          ["refund", "5. Refund", ["We reimburse sums received, including the cost of our least expensive standard delivery, within 14 days after being informed of withdrawal. We may withhold reimbursement until the goods are received or proof of return is supplied, whichever occurs first.", "Refunds use the original payment method unless you expressly agree otherwise and incur no fee for you."]],
          ["exceptions", "6. Statutory exceptions", ["Withdrawal is excluded only in cases provided by law, such as goods made to clearly personalised specifications. Any exception will be disclosed clearly before purchase; an item is not excluded merely because it is handmade."]],
          ["model", "7. Model withdrawal notice", ["To: Nostalgia Collection, Gerostathi Maria tou Ioanni, 2 Iviridos St., 543 51 Thessaloniki, Greece, support@nostalgiacandle.gr.<br><br>I hereby give notice that I withdraw from my contract for the sale of the following goods: [description]. Order number: [number]. Ordered/received on: [dates]. Consumer name and address: [details]. Date: [date]. Signature is required only if this notice is sent on paper."]]
        ]
      }
    }
  };

  function lang() {
    return window.NostalgiaI18n && window.NostalgiaI18n.getLang
      ? window.NostalgiaI18n.getLang()
      : (/^en/i.test(document.documentElement.lang) ? "en" : "el");
  }

  function render() {
    var page = document.body.getAttribute("data-page");
    var definition = PAGES[page];
    var root = document.getElementById("legal-dynamic-content");
    if (!definition || !root) return;
    var currentLang = lang() === "en" ? "en" : "el";
    var content = definition[currentLang];
    var title = document.getElementById("legal-page-title");
    var eyebrow = document.getElementById("legal-page-eyebrow");
    var lead = document.getElementById("legal-page-lead");
    var updated = document.getElementById("legal-page-updated");
    if (title) title.textContent = content.title;
    if (eyebrow) eyebrow.textContent = content.eyebrow;
    if (lead) lead.textContent = content.lead;
    if (updated) updated.textContent = (currentLang === "en" ? "Last updated: " + UPDATED_EN : "Τελευταία ενημέρωση: " + UPDATED_EL);
    document.title = "Nostalgia Collection · " + content.title;

    var labels = currentLang === "en";
    var sourceLinksByPage = {
      terms: [
        ["https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng", labels ? "Directive 2011/83/EU on consumer rights" : "Οδηγία 2011/83/ΕΕ για τα δικαιώματα των καταναλωτών"],
        ["https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32019L2161", labels ? "Directive (EU) 2019/2161 (Omnibus)" : "Οδηγία (ΕΕ) 2019/2161 (Omnibus)"],
        ["https://eur-lex.europa.eu/eli/dir/2005/29/oj/eng", labels ? "Directive 2005/29/EC on unfair commercial practices" : "Οδηγία 2005/29/ΕΚ για τις αθέμιτες εμπορικές πρακτικές"],
        ["https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/unfair-contract-terms-directive_en", labels ? "European Commission: unfair contract terms" : "Ευρωπαϊκή Επιτροπή: καταχρηστικοί συμβατικοί όροι"],
        ["https://commission.europa.eu/digital-life/protecting-you-when-buying-online_en", labels ? "European Commission: buying online" : "Ευρωπαϊκή Επιτροπή: προστασία στις online αγορές"]
      ],
      "cookie-policy": [
        ["https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng", labels ? "Regulation (EU) 2016/679 (GDPR)" : "Κανονισμός (ΕΕ) 2016/679 (GDPR)"],
        ["https://eur-lex.europa.eu/eli/dir/2002/58/oj/eng", labels ? "Directive 2002/58/EC (ePrivacy)" : "Οδηγία 2002/58/ΕΚ (ePrivacy)"],
        ["https://www.dpa.gr/el/enimerwtiko/thematikes_enotites/electronikesepikoinwnies/cookies", labels ? "Hellenic DPA: cookies and similar technologies" : "ΑΠΔΠΧ: cookies και συναφείς τεχνολογίες"],
        ["https://www.dpa.gr/el/enimerwtiko/deltia/systaseis-gia-ti-symmorfosi-ypeythynon-epexergasias-dedomenon-me-tin-eidiki", labels ? "Hellenic DPA: cookie compliance recommendations" : "ΑΠΔΠΧ: συστάσεις συμμόρφωσης για cookies"],
        ["https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en", labels ? "EDPB Guidelines 05/2020 on consent" : "EDPB Κατευθυντήριες γραμμές 05/2020 για τη συγκατάθεση"]
      ],
      warranty: [
        ["https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32019L0771", labels ? "Directive (EU) 2019/771 on sales of goods" : "Οδηγία (ΕΕ) 2019/771 για τις πωλήσεις αγαθών"],
        ["https://commission.europa.eu/digital-life/protecting-you-when-buying-online_en", labels ? "European Commission: buying online" : "Ευρωπαϊκή Επιτροπή: προστασία στις online αγορές"]
      ],
      cancellations: [
        ["https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng", labels ? "Directive 2011/83/EU on consumer rights" : "Οδηγία 2011/83/ΕΕ για τα δικαιώματα των καταναλωτών"],
        ["https://commission.europa.eu/digital-life/protecting-you-when-buying-online_en", labels ? "European Commission: buying online" : "Ευρωπαϊκή Επιτροπή: προστασία στις online αγορές"]
      ]
    };
    var sourceLinks = sourceLinksByPage[page] || sourceLinksByPage.terms;
    var sourceSection = ["official-sources",
      currentLang === "en" ? "Official legal sources" : "Επίσημες νομικές πηγές",
      [currentLang === "en"
        ? "The following official European Union sources are provided for direct reference to the rules described on this page."
        : "Οι παρακάτω επίσημες πηγές της Ευρωπαϊκής Ένωσης παρέχονται για άμεση αναφορά στους κανόνες που περιγράφονται σε αυτή τη σελίδα."]];
    var sections = content.sections.concat([sourceSection]);
    root.innerHTML = sections.map(function (section, index) {
      var sources = section[0] === "official-sources"
        ? '<ul class="legal-source-list">' + sourceLinks.map(function (source) {
            return '<li><a href="' + source[0] + '" target="_blank" rel="noopener noreferrer">' + source[1] + '</a></li>';
          }).join("") + "</ul>"
        : "";
      return '<section class="legal-section" id="' + section[0] + '">' +
        '<span class="legal-section__number" aria-hidden="true">' + String(index + 1).padStart(2, "0") + '</span>' +
        '<h2>' + section[1] + '</h2>' +
        section[2].map(function (paragraph) { return "<p>" + paragraph + "</p>"; }).join("") +
        sources +
        "</section>";
    }).join("");

    var action = document.getElementById("legal-cookie-settings");
    if (action) {
      action.textContent = content.action || "Cookie settings";
      action.hidden = !content.action;
    }
  }

  function init() {
    render();
    var action = document.getElementById("legal-cookie-settings");
    if (action) action.addEventListener("click", function () {
      if (window.NostalgiaCookies) window.NostalgiaCookies.openSettings();
    });
    window.NostalgiaOnLangApplied = (function (previous) {
      return function () {
        render();
        if (typeof previous === "function") previous();
      };
    })(window.NostalgiaOnLangApplied);
  }

  window.NostalgiaLegalPages = { pages: PAGES, render: render, termsVersion: "2026-08-11" };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
