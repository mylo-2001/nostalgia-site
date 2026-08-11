(function () {
  /* COD is not offered on the storefront right now. Keep the policy text
     here and flip to true when cash-on-delivery returns. */
  var INCLUDE_COD_PRIVACY = false;

  var COD_PRIVACY_EL =
    "Για την πρόληψη απάτης στην αντικαταβολή εφαρμόζεται κανoνιστική αξιολόγηση κινδύνου με στοιχεία όπως ποσό/πλήθος προϊόντων, πρόσφατη συχνότητα παραγγελιών και προηγούμενες αποτυχημένες παραδόσεις. Το αποτέλεσμα μπορεί να ζητήσει κάρτα ή ανθρώπινο έλεγχο, δεν οδηγεί σε οριστική απόρριψη χωρίς δυνατότητα επικοινωνίας. Μπορείτε να ζητήσετε ανθρώπινη επανεξέταση στο privacy@nostalgiacandle.gr.";
  var COD_PRIVACY_EN =
    "For fraud prevention on cash-on-delivery orders, a rule-based risk assessment uses information such as order value/quantity, recent order frequency and previous failed deliveries. It may require card payment or human review; it does not produce a final refusal without a way to contact us. You may request human review at privacy@nostalgiacandle.gr.";
  var EL = {
    intro: [
      "Η παρούσα πολιτική περιγράφει τον τρόπο με τον οποίο η Nostalgia Collection (Maria Gerostathi) διαχειρίζεται τα προσωπικά δεδομένα στον ιστότοπό μας.",
      "Τελευταία ενημέρωση: 11 Αυγούστου 2026.",
      "Στο πλαίσιο της εμπορικής μας δραστηριότητας, η Nostalgia Collection, ως υπεύθυνος επεξεργασίας, συλλέγει και επεξεργάζεται προσωπικά δεδομένα όταν χρησιμοποιείτε τον ιστότοπο και την online υπηρεσία παραγγελιών.",
      "Κατανοούμε τις ανησυχίες σας σχετικά με την ιδιωτικότητα των πληροφοριών που μας κοινοποιείτε. Η παροχή προσωπικών δεδομένων δεν σημαίνει σε κάθε περίπτωση συγκατάθεση: κάθε επεξεργασία βασίζεται στην κατάλληλη νομική βάση, όπως η εκτέλεση παραγγελίας, η συμμόρφωση με νόμιμη υποχρέωση, η συγκατάθεση ή το έννομο συμφέρον, όπου αυτό επιτρέπεται.",
      "Η παρούσα πολιτική ισχύει για όλα τα προσωπικά δεδομένα που μας παρέχετε.",
    ],
    sections: [
      {
        id: "controller-details",
        title: "Στοιχεία υπευθύνου και συνεργατών",
        paragraphs: [
          /* Keep in sync with js/business-info.js, which is the canonical copy
             of these details and renders them in the footer. */
          "Υπεύθυνη επεξεργασίας είναι η Μαρία Γεροστάθη του Ιωάννη, ως ατομική επιχείρηση με επωνυμία «Γεροστάθη Μαρία του Ιωάννη», η οποία δραστηριοποιείται με το εμπορικό σήμα Nostalgia Collection. ΑΦΜ: 066971593 · ΓΕΜΗ: 195495706000 · ΔΟΥ: Δ΄ Θεσσαλονίκης · Έδρα: Ιβηρίδος 2, 543 51 Θεσσαλονίκη · Μέλος του Βιοτεχνικού Επιμελητηρίου Θεσσαλονίκης. Ημερομηνία έναρξης: 04/06/2026. Για θέματα απορρήτου: privacy@nostalgiacandle.gr.",
          "Ο ιστότοπος δεν απευθύνεται σε παιδιά. Δεν ζητούμε σκόπιμα προσωπικά δεδομένα ανηλίκων· αν διαπιστώσουμε ότι συλλέχθηκαν χωρίς την απαιτούμενη νόμιμη βάση, θα τα διαγράψουμε.",
          "Συνεργάτες/εκτελούντες που χρησιμοποιούνται ανάλογα με την υπηρεσία: ACS Courier για διανομή, Worldline για φιλοξενούμενες πληρωμές με κάρτα όταν ενεργοποιηθούν, Pointer.gr για επαγγελματικό email, Papaki για το domain, Cloudinary για εικόνες προϊόντων, Cloudflare Turnstile για προστασία φορμών, Google Analytics για στατιστικά μόνο με συγκατάθεση και Klaviyo για λειτουργίες marketing μόνο με συγκατάθεση. Η παραγωγή φιλοξενείται σε διαχειριζόμενο από εμάς VPS με PostgreSQL. Κάθε πάροχος λαμβάνει μόνο τα δεδομένα που απαιτούνται για τον συγκεκριμένο σκοπό.",
          "Στη σελίδα ολοκλήρωσης παραγγελίας, το πεδίο διεύθυνσης χρησιμοποιεί την υπηρεσία Google Maps για να σας προτείνει διευθύνσεις καθώς πληκτρολογείτε. Όσο πληκτρολογείτε, το κείμενο που εισάγετε αποστέλλεται στην Google ώστε να επιστρέψει προτάσεις. Αν πατήσετε το κουμπί εντοπισμού τοποθεσίας, ο browser σας ζητά πρώτα τη ρητή άδειά σας και μόνο τότε αποστέλλονται οι συντεταγμένες σας στην Google για να μετατραπούν σε διεύθυνση — δεν συλλέγουμε ούτε αποθηκεύουμε ποτέ την τοποθεσία σας, ούτε τη ζητάμε χωρίς την ενέργειά σας. Η λειτουργία είναι διευκόλυνση: μπορείτε πάντα να γράψετε τη διεύθυνσή σας με το χέρι και η παραγγελία ολοκληρώνεται κανονικά. Για την επεξεργασία που διενεργεί η Google ισχύει η Πολιτική Απορρήτου της Google (policies.google.com/privacy).",
          "Αν επιλέξετε «Συνέχεια με Google» για να συνδεθείτε ή να δημιουργήσετε λογαριασμό, η Google μάς γνωστοποιεί το όνομα, το επώνυμο, τη διεύθυνση email σας και ένα σταθερό αναγνωριστικό λογαριασμού. Τα χρησιμοποιούμε αποκλειστικά για να δημιουργήσουμε ή να εντοπίσουμε τον λογαριασμό σας και να σας συνδέσουμε. Δεν λαμβάνουμε ούτε αποθηκεύουμε ποτέ τον κωδικό σας Google. Νομική βάση είναι η εκτέλεση της σύμβασης, δηλαδή η παροχή του λογαριασμού που ζητήσατε. Η σύνδεση με Google είναι προαιρετική: η εγγραφή με email και κωδικό παραμένει πάντα διαθέσιμη, και μπορείτε να διαγράψετε τον λογαριασμό σας οποτεδήποτε από τη σελίδα «Ο λογαριασμός μου». Η Google δεν μαθαίνει τι αγοράσατε ή τι είδατε στον ιστότοπο — μόνο ότι συνδεθήκατε.",
          "Εφόσον δώσετε συγκατάθεση για cookies ανάλυσης, τα δεδομένα του Google Analytics κοινοποιούνται στην Google (Google Ireland Limited και Google LLC) και για σκοπούς πέραν της παροχής της υπηρεσίας μέτρησης, για τους οποίους η Google ενεργεί ως αυτοτελής υπεύθυνος επεξεργασίας και όχι ως εκτελών: βελτίωση των προϊόντων και υπηρεσιών της Google· παραγωγή συγκεντρωτικών συγκριτικών στοιχείων και προβλέψεων κλάδου, όπου τα στοιχεία ταυτότητας καταργούνται πριν από τη χρήση· παροχή τεχνικής υποστήριξης στον λογαριασμό μας· και διατύπωση προτάσεων βελτιστοποίησης προς εμάς με βάση δεδομένα χρήσης του λογαριασμού. Η Google δεν χρησιμοποιεί τα δεδομένα αυτά για εξατομίκευση ή στόχευση διαφημίσεων. Νομική βάση είναι η συγκατάθεσή σας, την οποία μπορείτε να ανακαλέσετε οποτεδήποτε από τις ρυθμίσεις cookies· η ανάκληση σταματά κάθε περαιτέρω κοινοποίηση. Για την επεξεργασία που διενεργεί η Google ως αυτοτελής υπεύθυνος ισχύει η Πολιτική Απορρήτου της Google (policies.google.com/privacy).",
          "Όπου πάροχος ενδέχεται να επεξεργάζεται δεδομένα εκτός ΕΟΧ, χρησιμοποιούμε τον εφαρμοστέο μηχανισμό του GDPR, όπως απόφαση επάρκειας ή Τυποποιημένες Συμβατικές Ρήτρες, και αξιολογούμε τις σχετικές εγγυήσεις.",
          "Σε περίπτωση περιστατικού παραβίασης δεδομένων, αξιολογούμε άμεσα τον κίνδυνο, τηρούμε αρχείο περιστατικού και γνωστοποιούμε στην ΑΠΔΠΧ εντός 72 ωρών όπου απαιτείται. Ενημερώνουμε και τα επηρεαζόμενα πρόσωπα όταν υπάρχει υψηλός κίνδυνος."
        ],
      },
      {
        id: "general",
        title: "1. Γενικές πληροφορίες",
        paragraphs: [
          "Η Nostalgia Collection ενδέχεται να συλλέξει προσωπικά δεδομένα όταν δημιουργείτε λογαριασμό επικοινωνίας, υποβάλλετε παραγγελία ή συμπληρώνετε φόρμες στον ιστότοπο.",
          "Η επεξεργασία αυτή είναι απαραίτητη για την εκπλήρωση των συμβατικών μας υποχρεώσεων προς εσάς.",
          "Τα προσωπικά δεδομένα που ενδέχεται να ζητηθούν υπόκεινται στον Γενικό Κανονισμό Προστασίας Δεδομένων (ΕΕ 2016/679 — GDPR) και την ελληνική νομοθεσία περί προστασίας δεδομένων.",
        ],
      },
      {
        id: "rights",
        title: "2. Τα δικαιώματά σας",
        paragraphs: [
          "Έχετε δικαίωμα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού ή φορητότητας των δεδομένων σας, δικαίωμα εναντίωσης και δικαίωμα ανάκλησης συγκατάθεσης χωρίς να επηρεάζεται η νομιμότητα της προηγούμενης επεξεργασίας.",
          "• Απευθείας από τη σελίδα «Ο λογαριασμός μου»: μπορείτε να κατεβάσετε όλα τα προσωπικά σας δεδομένα («Εξαγωγή των δεδομένων μου») ή να διαγράψετε οριστικά τον λογαριασμό σας («Διαγραφή λογαριασμού»).",
          "• Με email στο privacy@nostalgiacandle.gr",
          "• Ή μέσω της φόρμας επικοινωνίας στο /contact",
          "Απαντάμε χωρίς αδικαιολόγητη καθυστέρηση και κατά κανόνα εντός ενός μήνα. Η προθεσμία μπορεί να παραταθεί έως δύο επιπλέον μήνες για πολύπλοκα ή πολλαπλά αιτήματα, αφού σας ενημερώσουμε.",
          "Σε διαγραφή λογαριασμού αφαιρούνται τα στοιχεία επικοινωνίας και αποστολής από τις παραγγελίες. Στοιχεία τιμολογίου διατηρούνται μόνο όταν και όσο απαιτείται από φορολογική/λογιστική υποχρέωση. Τα υπόλοιπα αρχεία αποσυνδέονται ή ψευδωνυμοποιούνται όπου απαιτείται για ασφάλεια, πρόληψη κατάχρησης ή νομικές αξιώσεις.",
          "Μπορείτε επίσης να υποβάλετε καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα μέσω του www.dpa.gr.",
          "Εάν αντιταχθείτε στην επεξεργασία, ενδέχεται να μην είναι δυνατή η ικανοποίηση ορισμένων αιτημάτων σας (π.χ. αποστολή παραγγελίας).",
        ],
      },
      {
        id: "management",
        title: "3. Διαχείριση προσωπικών δεδομένων",
        paragraphs: [
          "Πηγή δεδομένων: οι περισσότερες πληροφορίες προέρχονται απευθείας από εσάς, όταν δημιουργείτε λογαριασμό, υποβάλλετε παραγγελία ή φόρμα, γράφετε αξιολόγηση ή εγγράφεστε στο newsletter. Αν χρησιμοποιήσετε σύνδεση Google, τα βασικά στοιχεία λογαριασμού προέρχονται από την Google. Τεχνικά δεδομένα ασφάλειας και χρήσης δημιουργούνται από τον browser, τον server και τους παρόχους μας κατά τη λειτουργία της υπηρεσίας.",
          "Τα προσωπικά δεδομένα που μπορεί να συλλέξουμε, ανάλογα με τη χρήση, περιλαμβάνουν:",
          "• στοιχεία ταυτότητας και επικοινωνίας: ονοματεπώνυμο, email, τηλέφωνο,",
          "• στοιχεία αποστολής και χρέωσης: διεύθυνση, πόλη, Τ.Κ., χώρα,",
          "• δεδομένα παραγγελίας: προϊόντα, ποσότητες, αξία, κατάσταση, ιστορικό επικοινωνίας σχετικά με την παραγγελία,",
          "• δεδομένα πληρωμής σε επίπεδο συναλλαγής (κατάσταση πληρωμής, αναγνωριστικά παρόχου) — χωρίς πλήρη αριθμό κάρτας ή CVV,",
          "• δεδομένα λογαριασμού: προτιμήσεις, wishlist, ιστορικό εξαγωγής/διαγραφής όπου εφαρμόζεται,",
          "• περιεχόμενο που μας στέλνετε: μηνύματα φόρμας επικοινωνίας, αξιολογήσεις,",
          "• τεχνικά δεδομένα συσκευής/σύνδεσης όπου απαιτούνται για ασφάλεια ή λειτουργία (π.χ. IP σε αρχεία ασφαλείας), καθώς και ψευδωνυμοποιημένα στατιστικά ή marketing αναγνωριστικά μόνο μετά από συγκατάθεση.",
          "Δεν συλλέγουμε ημερομηνία γέννησης για τη δημιουργία ή λειτουργία λογαριασμού.",
          "Τα υποχρεωτικά πεδία στις φόρμες μας σημειώνονται με αστερίσκο (*). Χωρίς αυτά δεν μπορούμε να επεξεργαστούμε το αίτημά σας.",
          "Μέσω του ιστότοπου επεξεργαζόμαστε δεδομένα αποκλειστικά απαραίτητα για:",
          "• τη διαχείριση παραγγελιών (στοιχεία αποστολής, επικοινωνίας, τιμολόγησης όπου απαιτείται),",
          "• την επικοινωνία μαζί σας σχετικά με την παραγγελία σας,",
          "• την αποθήκευση προτιμήσεων (γλώσσα, θέμα, καλάθι) όπου επιλέγετε.",
          "Η Nostalgia Collection είναι ο κύριος αποδέκτης των δεδομένων σας. Κοινοποιούμε δεδομένα σε τρίτους μόνο όταν:",
          "• απαιτείται για την εκτέλεση της παραγγελίας ή την παροχή υπηρεσίας, όπως σε εταιρεία courier, εξωτερικό πάροχο πληρωμών ή πάροχο τεχνικής υποστήριξης,",
          "• μας έχετε δώσει ρητή συγκατάθεση, όπου αυτή απαιτείται,",
          "• υποχρεούμαστε από δικαστική ή διοικητική αρχή.",
          "Η επεξεργασία για την εκτέλεση παραγγελίας βασίζεται στην εκτέλεση της σύμβασης. Η έκδοση παραστατικών και η διατήρηση των σχετικών στοιχείων βασίζονται σε νόμιμες φορολογικές και λογιστικές υποχρεώσεις. Η αποστολή newsletter και η χρήση μη απαραίτητων cookies βασίζονται στη συγκατάθεσή σας. Για την ασφάλεια του ιστότοπου, την πρόληψη απάτης και την τεχνική λειτουργία μπορούμε να βασιζόμαστε σε έννομο συμφέρον, όπου αυτό επιτρέπεται.",
          "Δεν πραγματοποιούμε σήμερα αποκλειστικά αυτοματοποιημένη λήψη αποφάσεων ή profiling που παράγει έννομα αποτελέσματα ή σας επηρεάζει με παρόμοιο σημαντικό τρόπο. Αν ενεργοποιηθεί στο μέλλον τέτοια επεξεργασία, θα ενημερώσουμε προηγουμένως την παρούσα πολιτική για τη λογική, τη σημασία, τις συνέπειες και τις διαθέσιμες εγγυήσεις.",
          "Ο ιστότοπος φιλοξενείται σε υποδομή VPS και η βάση PostgreSQL διαχειρίζεται στο ίδιο production περιβάλλον. Όταν ενεργοποιηθούν οι πληρωμές με κάρτα, ο πελάτης θα ανακατευθύνεται στη φιλοξενούμενη σελίδα της Worldline· δεν θα συλλέγουμε ούτε θα αποθηκεύουμε πλήρη αριθμό κάρτας ή CVV.",
          ...(INCLUDE_COD_PRIVACY ? [COD_PRIVACY_EL] : []),
          "Έχουμε λάβει τεχνικά και οργανωτικά μέτρα για την ασφάλεια των δεδομένων. Ωστόσο, δεν ελέγχουμε όλους τους κινδύνους του Διαδικτύου.",
          "Τα δεδομένα παραγγελίας διατηρούνται έως 6 έτη για φορολογικούς, λογιστικούς ή αποδεικτικούς σκοπούς. Μετά την πάροδο του χρόνου αυτού, η παραγγελία παραμένει μόνο σε ανωνυμοποιημένη μορφή, εκτός αν απαιτείται διαφορετικά από τον νόμο ή από εκκρεμή διαφορά.",
        ],
      },
      {
        id: "newsletter",
        title: "4. Newsletter και εμπορική επικοινωνία",
        paragraphs: [
          "Η εγγραφή στο newsletter είναι προαιρετική και βασίζεται αποκλειστικά στη συγκατάθεσή σας. Μετά την υποβολή της φόρμας στέλνουμε σύνδεσμο επιβεβαίωσης στο δηλωμένο email. Μέχρι να χρησιμοποιηθεί ο σύνδεσμος, η διεύθυνση δεν περιλαμβάνεται σε καμία marketing αποστολή.",
          "Καταγράφουμε το email, προαιρετικά το όνομα, την πηγή και τον χρόνο του αιτήματος, τον χρόνο επιβεβαίωσης και την έκδοση της ενημέρωσης συγκατάθεσης. Δεν θεωρούμε την αγορά ή τη δημιουργία λογαριασμού αυτόματη άδεια marketing.",
          "Κάθε διαφημιστικό email περιλαμβάνει δωρεάν σύνδεσμο διαγραφής. Μπορείτε επίσης να ανακαλέσετε τη συγκατάθεση από τον λογαριασμό σας ή στο privacy@nostalgiacandle.gr.",
        ],
      },
      {
        id: "cookies",
        title: "5. Cookies",
        paragraphs: [
          "Όταν επισκέπτεστε τον ιστότοπό μας, πληροφορίες περιήγησης ενδέχεται να αποθηκεύονται σε αρχεία «cookies» στη συσκευή σας.",
          "Κατά την πρώτη επίσκεψη εμφανίζεται banner στο κάτω μέρος της οθόνης. Σας ενημερώνει για τον υπεύθυνο επεξεργασίας και σας επιτρέπει να ρυθμίσετε τα cookies.",
          "Τα cookies που χρησιμοποιούμε μας βοηθούν να:",
          "• αποθηκεύουμε τις προτιμήσεις σας (γλώσσα, θέμα),",
          "• διατηρούμε το καλάθι αγορών σας,",
          "• αποθηκεύουμε τις επιλογές σας σχετικά με τα cookies,",
          "• βελτιώνουμε την εμπειρία χρήσης του ιστότοπου.",
          "Ορισμένα cookies είναι απαραίτητα για τη λειτουργία του site (π.χ. καλάθι, γλώσσα) και δεν απαιτούν ξεχωριστή συγκατάθεση.",
          "Μπορείτε ανά πάσα στιγμή να αποδεχτείτε όλα τα cookies, να τα απορρίψετε (εκτός των απαραίτητων) ή να ρυθμίσετε τις προτιμήσεις σας από το banner.",
          "Οι επιλογές σας αποθηκεύονται για ένα έτος· μετά το banner εμφανίζεται ξανά.",
          "Κάθε επιλογή καταγράφεται με τη χρονική στιγμή, την έκδοση της πολιτικής και έναν τυχαίο αναγνωριστικό αριθμό browser που δεν συνδέεται με λογαριασμό. Δεν αποθηκεύουμε IP ή user-agent στο αρχείο συγκατάθεσης.",
          "Μπορείτε επίσης να ρυθμίσετε τον browser σας ώστε να αποδέχεται ή να απορρίπτει cookies. Η άρνηση ορισμένων cookies ενδέχεται να περιορίσει λειτουργίες (π.χ. καλάθι).",
          "Για περισσότερες πληροφορίες: Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (www.dpa.gr) ή CNIL (www.cnil.fr).",
          "Η ξεχωριστή Πολιτική Cookies στο /cookie-policy εξηγεί κατηγορίες, συγκατάθεση και ανάκληση· ο πίνακας παρακάτω αποτελεί μέρος και των δύο κειμένων.",
        ],
        html:
          "<p><strong>Αναλυτικός πίνακας cookies:</strong></p>" +
          "<div class='legal-table-wrap'><table class='legal-table'>" +
          "<thead><tr><th>Cookie</th><th>Σκοπός</th><th>Πάροχος</th><th>Λήξη</th></tr></thead><tbody>" +
          "<tr><td colspan='4'><strong>Απολύτως απαραίτητα — πάντα ενεργά</strong></td></tr>" +
          "<tr><td>nostalgia_sid</td><td>Διατήρηση της σύνδεσης του χρήστη</td><td>Nostalgia</td><td>30 ημέρες</td></tr>" +
          "<tr><td>nostalgia_admin_sid</td><td>Σύνδεση διαχειριστή (admin)</td><td>Nostalgia</td><td>12 ώρες</td></tr>" +
          "<tr><td>nostalgia_admin_trust</td><td>Αναγνώριση έμπιστης συσκευής διαχειριστή</td><td>Nostalgia</td><td>30 ημέρες</td></tr>" +
          "<tr><td>nostalgia_oauth_state</td><td>Προστασία της σύνδεσης με Google από πλαστογραφία αιτήματος (CSRF). Διαγράφεται μόλις ολοκληρωθεί η σύνδεση.</td><td>Nostalgia</td><td>10 λεπτά</td></tr>" +
          "<tr><td>nostalgia-cookie-consent</td><td>Αποθήκευση των προτιμήσεών σας για τα cookies</td><td>Nostalgia</td><td>1 έτος</td></tr>" +
          "<tr><td>Local/session storage</td><td>Καλάθι, γλώσσα, θέμα, wishlist, προσωρινή κατάσταση checkout, προσωρινά στοιχεία εμφάνισης λογαριασμού, κατάσταση αιτήματος newsletter και τυχαίο cookie-consent id</td><td>Nostalgia</td><td>Έως διαγραφή από τον χρήστη, κλείσιμο της καρτέλας ή λήξη της λειτουργίας</td></tr>" +
          "<tr><td>cf_clearance (μόνο αν ενεργοποιηθεί Turnstile pre-clearance)</td><td>Απόδειξη επιτυχούς ελέγχου ασφαλείας</td><td>Cloudflare</td><td>30 λεπτά από προεπιλογή, ρυθμιζόμενο</td></tr>" +
          "<tr><td colspan='4'><strong>Ανάλυσης — μόνο με τη συγκατάθεσή σας</strong></td></tr>" +
          "<tr><td>_ga</td><td>Ψευδωνυμοποιημένη μέτρηση μοναδικών επισκεπτών</td><td>Google Analytics</td><td>2 έτη</td></tr>" +
          "<tr><td>_ga_*</td><td>Διατήρηση κατάστασης session</td><td>Google Analytics</td><td>2 έτη</td></tr>" +
          "<tr><td>_gid</td><td>Στατιστικά χρήσης ανά ημέρα</td><td>Google Analytics</td><td>24 ώρες</td></tr>" +
          "<tr><td colspan='4'><strong>Marketing — μόνο με τη συγκατάθεσή σας</strong></td></tr>" +
          "<tr><td>_fbp</td><td>Διαφημίσεις & retargeting</td><td>Meta (Facebook/Instagram)</td><td>90 ημέρες</td></tr>" +
          "<tr><td>__kla_id</td><td>Αναγνώριση επισκέπτη για email marketing</td><td>Klaviyo</td><td>2 έτη</td></tr>" +
          "<tr><td>__kla_session</td><td>Αναγνώριση session για email marketing</td><td>Klaviyo</td><td>Session</td></tr>" +
          "</tbody></table></div>" +
          "<p>Τα cookies ανάλυσης και marketing εμφανίζονται μόνο εφόσον τα αποδεχτείτε στο banner και εφόσον τα αντίστοιχα εργαλεία είναι ενεργοποιημένα από το κατάστημα.</p>" +
          "<p>Εφόσον αποδεχτείτε τα cookies ανάλυσης, τα δεδομένα του Google Analytics κοινοποιούνται στην Google και για δικούς της σκοπούς, ως αυτοτελή υπεύθυνο επεξεργασίας. Δείτε αναλυτικά στην ενότητα «Στοιχεία υπευθύνου και συνεργατών».</p>" +
          "<p>Δείτε επίσης την <a href='/cookie-policy'>Πολιτική Cookies</a> για τον μηχανισμό επιλογών και ανάκλησης.</p>",
      },
      {
        id: "retention",
        title: "6. Χρόνοι τήρησης δεδομένων",
        paragraphs: [
          "Διατηρούμε τα δεδομένα μόνο για όσο είναι απαραίτητο για τον σκοπό συλλογής τους ή για όσο απαιτείται από φορολογικές, λογιστικές ή άλλες νόμιμες υποχρεώσεις.",
          "Τα δεδομένα που υποβάλλονται μέσω της φόρμας επικοινωνίας διαγράφονται μετά από έως 24 μήνες. Τα αρχεία ασφαλείας και διαχειριστικών ενεργειών διατηρούνται έως 12 μήνες, ενώ τα αρχεία συνδέσεων διαχειριστών έως 6 μήνες.",
          "Η ενεργή εγγραφή newsletter διατηρείται μέχρι να ανακαλέσετε τη συγκατάθεσή σας. Μη επιβεβαιωμένες εγγραφές διαγράφονται μετά τη λήξη τους και περίοδο ασφαλείας 7 ημερών. Εγγραφές που ανακλήθηκαν διαγράφονται μετά από έως 24 μήνες, ενώ τα επιμέρους αρχεία αποστολής καμπανιών μετά από έως 12 μήνες.",
          "Οι παραγγελίες δεν διαγράφονται μετά την ολοκλήρωσή τους όταν απαιτείται η διατήρησή τους για φορολογικούς ή λογιστικούς σκοπούς. Μετά από έως 6 έτη ανωνυμοποιούνται τα στοιχεία που ταυτοποιούν τον πελάτη, ενώ διατηρούνται μόνο τα στοιχεία που είναι αναγκαία για την απόδειξη της συναλλαγής.",
          "Το ιστορικό επιλογών cookies διατηρείται έως 60 μήνες για απόδειξη συγκατάθεσης ή ανάκλησης και επίλυση διαφορών.",
          "Οι χρόνοι αυτοί επανεξετάζονται όταν αλλάζει ο σκοπός επεξεργασίας ή η σχετική νομοθεσία.",
        ],
      },
      {
        id: "security",
        title: "7. Ασφάλεια δεδομένων & Οδηγία NIS2",
        paragraphs: [
          "Λαμβάνουμε υπόψη σχετικές αρχές κυβερνοασφάλειας της Οδηγίας NIS2, χωρίς η παρούσα αναφορά να κρίνει αν η επιχείρηση εμπίπτει στο πεδίο εφαρμογής της. Καθοδήγηση παρέχει η Εθνική Αρχή Κυβερνοασφάλειας: https://cyber.gov.gr/odigia-nis2/",
          "Στο πλαίσιο αυτό εφαρμόζουμε τεχνικά και οργανωτικά μέτρα, μεταξύ άλλων:",
          "• κρυπτογραφημένη σύνδεση (HTTPS/TLS) σε όλη την κίνηση και επιβολή HSTS,",
          "• κεφαλίδες ασφαλείας (Content-Security-Policy, X-Frame-Options, κ.ά.) για προστασία από επιθέσεις (π.χ. XSS, clickjacking),",
          "• ασφαλή αποθήκευση κωδικών με κρυπτογραφικό hashing και έλεγχο ταυτότητας δύο παραγόντων (2FA) για τη διαχείριση,",
          "• περιορισμό ρυθμού αιτημάτων (rate limiting) και προστασία από κατάχρηση,",
          "• τήρηση αρχείου καταγραφής ενεργειών ασφαλείας (audit log) χωρίς αποθήκευση κωδικών ή στοιχείων καρτών,",
          "• τις πληρωμές διαχειρίζεται αποκλειστικά εξωτερικός πάροχος πληρωμών — δεν αποθηκεύουμε πλήρη στοιχεία κάρτας.",
          "Παρά τα μέτρα αυτά, καμία μετάδοση δεδομένων στο Διαδίκτυο δεν είναι απολύτως ασφαλής· δεσμευόμαστε να ανταποκρινόμαστε έγκαιρα σε τυχόν περιστατικά ασφαλείας.",
        ],
      },
      {
        id: "policy-changes",
        title: "8. Αλλαγές πολιτικής",
        paragraphs: [
          "Δημοσιεύουμε την ημερομηνία τελευταίας ενημέρωσης στην αρχή της πολιτικής.",
          "Για ουσιώδη αλλαγή που επηρεάζει ενεργό λογαριασμό ή νέα χρήση δεδομένων, ενημερώνουμε με εμφανή ειδοποίηση στον ιστότοπο και, όπου είναι κατάλληλο ή απαιτείται, με email πριν αρχίσει η νέα επεξεργασία.",
          "Όπου απαιτείται νέα συγκατάθεση, δεν βασιζόμαστε στην παλαιά επιλογή. Η συνέχιση χρήσης του ιστοτόπου μετά από μη ουσιώδεις ενημερώσεις σημαίνει ότι έχετε λάβει γνώση της επικαιροποιημένης πολιτικής.",
        ],
      },
    ],
  };

  var EN = {
    intro: [
      "This policy details how Nostalgia Collection (Maria Gerostathi) handles personal data on our website.",
      "Last updated: 11 August 2026.",
      "As part of our commercial activity, Nostalgia Collection, as data controller, collects and processes your personal data when you use the website and online ordering service.",
      "We understand your concerns about the privacy of the personal information you share with us. Providing personal data does not always mean consent: each processing activity relies on the appropriate legal basis, such as fulfilling an order, complying with a legal obligation, consent or legitimate interest where permitted.",
      "This policy applies to all personal data you provide to Nostalgia Collection.",
    ],
    sections: [
      {
        id: "general",
        title: "1. General information",
        paragraphs: [
          "The data controller is Maria Gerostathi, daughter of Ioannis, operating as the sole proprietorship «Gerostathi Maria tou Ioanni» under the Nostalgia Collection brand. Greek tax number (AFM): 066971593 · GEMI (business registry) no.: 195495706000 · Tax office (DOY): D΄ Thessaloniki · Registered address: 2 Iviridos St., 543 51 Thessaloniki, Greece · Member of the Thessaloniki Chamber of Small Industries. Business commencement date: 04/06/2026. Privacy contact: privacy@nostalgiacandle.gr.",
          "The website is not directed at children. We do not knowingly request children’s personal data; if we discover that such data was collected without the required legal basis, we will delete it.",
          "Nostalgia Collection may collect personal data when you place an order or complete forms on the website.",
          "This processing is necessary to fulfil our contractual obligations to you.",
          "Personal data is processed in accordance with the EU General Data Protection Regulation (2016/679) and applicable Greek data protection law.",
        ],
      },
      {
        id: "rights",
        title: "2. Your rights",
        paragraphs: [
          "You have the right to access, rectify, erase, restrict or port your personal data, to object to processing and to withdraw consent without affecting processing that was lawful before withdrawal.",
          "• Directly from the “My account” page: you can download all of your personal data (“Export my data”) or permanently delete your account (“Delete account”).",
          "• By email at privacy@nostalgiacandle.gr",
          "• Or via our contact form at /contact",
          "We respond without undue delay and normally within one month. This may be extended by up to two further months for complex or multiple requests, after we inform you.",
          "When you delete your account, contact and shipping details are removed from orders. Invoice identity is retained only where and for as long as tax/accounting law requires. Other records are detached or pseudonymised where required for security, abuse prevention or legal claims.",
          "You may also lodge a complaint with the Hellenic Data Protection Authority at www.dpa.gr.",
          "If you object to processing, we may not be able to fulfil certain requests (e.g. shipping an order).",
        ],
      },
      {
        id: "management",
        title: "3. Management of personal data",
        paragraphs: [
          "Source of data: most information comes directly from you when you create an account, place an order, submit a form or review, or subscribe to the newsletter. If you use Google sign-in, basic account details come from Google. Technical security and usage data is generated by the browser, server and our providers while operating the service.",
          "Depending on use, personal data we may collect includes:",
          "• identity and contact details: name, email, phone number,",
          "• shipping and billing details: address, city, postcode, country,",
          "• order data: products, quantities, value, status, and related order communications,",
          "• payment data at transaction level (payment status, provider references) — never full card number or CVV,",
          "• account data: preferences, wishlist, export/erasure history where applicable,",
          "• content you send us: contact-form messages and reviews,",
          "• technical device/connection data where needed for security or operation (for example IP addresses in security logs), plus pseudonymous analytics or marketing identifiers only after consent.",
          "Depending on the service, our processors/partners include ACS Courier for delivery, Worldline for hosted card payments when enabled, Pointer.gr for business email, Papaki for the domain, Cloudinary for product images, Cloudflare Turnstile for form protection, Google Analytics for consent-based statistics and Klaviyo for consent-based marketing features. Production is hosted on a VPS with PostgreSQL managed by us.",
          "On the checkout page, the address field uses Google Maps to suggest addresses as you type. What you type is sent to Google so it can return those suggestions. If you press the locate-me button, your browser asks for your explicit permission first, and only then are your coordinates sent to Google to be turned into an address — we never collect or store your location, and never request it without an action from you. The feature is a convenience: you can always type your address by hand and the order completes normally. Google's own Privacy Policy (policies.google.com/privacy) governs the processing Google carries out.",
          "If you choose \"Continue with Google\" to sign in or create an account, Google discloses your first name, last name, email address and a stable account identifier to us. We use them solely to create or find your account and sign you in. We never receive or store your Google password. The legal basis is performance of the contract — providing the account you asked for. Google sign-in is optional: registering with an email and password remains available, and you can delete your account at any time from the \"My account\" page. Google does not learn what you bought or viewed on the site, only that you signed in.",
          "If you consent to analytics cookies, Google Analytics data is also shared with Google (Google Ireland Limited and Google LLC) for purposes beyond providing the measurement service, for which Google acts as an independent controller rather than a processor: improving Google's products and services; producing aggregated benchmarks and industry modelling, where identifiers are removed before use; providing technical support on our account; and making optimisation suggestions to us based on account usage data. Google does not use this data to personalise or target advertising. The legal basis is your consent, which you may withdraw at any time from the cookie settings; withdrawal stops any further sharing. Google's own Privacy Policy (policies.google.com/privacy) governs the processing Google carries out as an independent controller.",
          "Where a provider may process data outside the EEA, we use the applicable GDPR mechanism, such as an adequacy decision or Standard Contractual Clauses, and assess the relevant safeguards.",
          "Through our website we process data strictly necessary for:",
          "• managing orders (shipping details, contact information, invoicing where required),",
          "• communicating with you about your order,",
          "• storing preferences (language, theme, cart) where you choose.",
          "We do not collect date of birth to create or operate an account.",
          "Mandatory fields on our forms are marked with an asterisk (*). Without them we cannot process your request.",
          "Nostalgia Collection is the primary recipient of your data. We share data with third parties only when:",
          "• sharing is required to fulfil an order or provide a service, such as a courier, external payment provider or technical support provider,",
          "• you have given consent where consent is required,",
          "• we are required by a judicial or administrative authority.",
          "Processing an order is based on performing the contract. Invoicing and retention of related records are based on tax and accounting obligations. Newsletter messages and non-essential cookies are based on your consent. For site security, fraud prevention and technical operation, we may rely on legitimate interest where permitted.",
          "We currently carry out no solely automated decision-making or profiling that produces legal effects or similarly significantly affects you. If such processing is enabled in the future, we will first update this policy with the logic, significance, expected consequences and available safeguards.",
          "The website is hosted on VPS infrastructure and its PostgreSQL database is managed in the same production environment. Once card payments are enabled, customers will be redirected to Worldline’s hosted payment page; we will not collect or store full card numbers or CVV.",
          ...(INCLUDE_COD_PRIVACY ? [COD_PRIVACY_EN] : []),
          "We have implemented technical and organisational security measures. However, we cannot control all Internet-related risks.",
          "Order data is retained for up to 6 years where required for tax, accounting or evidentiary purposes. After that period, the order remains only in anonymised form unless the law or an ongoing dispute requires otherwise.",
        ],
      },
      {
        id: "newsletter",
        title: "4. Newsletter and marketing communications",
        paragraphs: [
          "Newsletter subscription is optional and based solely on consent. After submitting the form, we send a confirmation link to the address provided. Until that link is used, the address is not included in any marketing mailing.",
          "We record the email, optional name, request source and time, confirmation time and the version of the consent notice. We do not treat a purchase or account creation as automatic marketing permission.",
          "Every marketing email includes a free unsubscribe link. You may also withdraw consent through your account or at privacy@nostalgiacandle.gr.",
        ],
      },
      {
        id: "cookies",
        title: "5. Cookies",
        paragraphs: [
          "When you visit our website, browsing information may be saved in “cookie” files on your device.",
          "On your first visit, a banner appears at the bottom of the screen. It informs you of the data controller and allows you to configure cookies.",
          "Cookies we use help us to:",
          "• store your preferences (language, theme),",
          "• maintain your shopping cart,",
          "• remember your cookie choices,",
          "• improve your experience on the website.",
          "Some cookies are essential for the site to function (e.g. cart, language) and do not require separate consent.",
          "You may accept all cookies, refuse non-essential cookies, or configure preferences via the banner at any time.",
          "Your choices are stored for one year; after that the banner will appear again.",
          "Each cookie choice is recorded with its timestamp, policy version and a random browser identifier that is not linked to an account. We do not store IP addresses or user-agent strings in the consent record.",
          "You may also configure your browser to accept or reject cookies. Refusing certain cookies may limit functionality (e.g. cart).",
          "For more information visit the Hellenic DPA (www.dpa.gr) or CNIL (www.cnil.fr).",
          "The separate Cookie Policy at /cookie-policy explains categories, consent and withdrawal; the table below forms part of both texts.",
        ],
        html:
          "<p><strong>Detailed cookie table:</strong></p>" +
          "<div class='legal-table-wrap'><table class='legal-table'>" +
          "<thead><tr><th>Cookie</th><th>Purpose</th><th>Provider</th><th>Expiry</th></tr></thead><tbody>" +
          "<tr><td colspan='4'><strong>Strictly necessary — always on</strong></td></tr>" +
          "<tr><td>nostalgia_sid</td><td>Keeps the user signed in</td><td>Nostalgia</td><td>30 days</td></tr>" +
          "<tr><td>nostalgia_admin_sid</td><td>Admin panel session</td><td>Nostalgia</td><td>12 hours</td></tr>" +
          "<tr><td>nostalgia_admin_trust</td><td>Recognises a trusted administrator device</td><td>Nostalgia</td><td>30 days</td></tr>" +
          "<tr><td>nostalgia_oauth_state</td><td>Protects Google sign-in against cross-site request forgery. Deleted as soon as sign-in completes.</td><td>Nostalgia</td><td>10 minutes</td></tr>" +
          "<tr><td>nostalgia-cookie-consent</td><td>Stores your cookie preferences</td><td>Nostalgia</td><td>1 year</td></tr>" +
          "<tr><td>Local/session storage</td><td>Cart, language, theme, wishlist, temporary checkout state, temporary account display details, newsletter request status and random consent id</td><td>Nostalgia</td><td>Until removed by the user, the browser tab closes, or the feature expires</td></tr>" +
          "<tr><td>cf_clearance (only if Turnstile pre-clearance is enabled)</td><td>Evidence of a successful security challenge</td><td>Cloudflare</td><td>30 minutes by default, configurable</td></tr>" +
          "<tr><td colspan='4'><strong>Analytics — only with your consent</strong></td></tr>" +
          "<tr><td>_ga</td><td>Pseudonymous measurement of unique visitors</td><td>Google Analytics</td><td>2 years</td></tr>" +
          "<tr><td>_ga_*</td><td>Persists session state</td><td>Google Analytics</td><td>2 years</td></tr>" +
          "<tr><td>_gid</td><td>Daily usage statistics</td><td>Google Analytics</td><td>24 hours</td></tr>" +
          "<tr><td colspan='4'><strong>Marketing — only with your consent</strong></td></tr>" +
          "<tr><td>_fbp</td><td>Advertising &amp; retargeting</td><td>Meta (Facebook/Instagram)</td><td>90 days</td></tr>" +
          "<tr><td>__kla_id</td><td>Visitor identification for email marketing</td><td>Klaviyo</td><td>2 years</td></tr>" +
          "<tr><td>__kla_session</td><td>Session identification for email marketing</td><td>Klaviyo</td><td>Session</td></tr>" +
          "</tbody></table></div>" +
          "<p>Analytics and marketing cookies appear only if you accept them in the banner and if the corresponding tools are enabled by the store.</p>" +
          "<p>If you accept analytics cookies, Google Analytics data is also shared with Google for its own purposes, as an independent controller. See the section “Controller and partner details” for the full description.</p>" +
          "<p>See also the <a href='/cookie-policy'>Cookie Policy</a> for the choice and withdrawal mechanism.</p>",
      },
      {
        id: "retention",
        title: "6. Data retention periods",
        paragraphs: [
          "We retain personal data only for as long as necessary for the purpose for which it was collected or as required by tax, accounting or other legal obligations.",
          "Data submitted through the contact form is deleted after up to 24 months. Security and administrative activity records are retained for up to 12 months, while administrator login records are retained for up to 6 months.",
          "An active newsletter subscription is retained until consent is withdrawn. Unconfirmed requests are deleted after expiry plus a 7-day safety period. Withdrawn subscription records are deleted after up to 24 months, and individual campaign delivery records after up to 12 months.",
          "Orders are not deleted where they must be retained for tax or accounting purposes. After up to 6 years, customer-identifying details are anonymised, while only information necessary to evidence the transaction is kept.",
          "Cookie-choice history is retained for up to 60 months to demonstrate consent or withdrawal and resolve disputes.",
          "These periods are reviewed when the processing purpose or applicable law changes.",
        ],
      },
      {
        id: "security",
        title: "7. Data security & the NIS2 Directive",
        paragraphs: [
          "If a personal-data breach occurs, we promptly assess the risk, keep an incident record and notify the competent authority without undue delay and, where required, within 72 hours of awareness. We also inform affected people where the breach is likely to create a high risk.",
          "We take into account relevant cybersecurity principles of the NIS2 Directive, without this statement determining whether the business falls within its scope. Guidance is available from the Greek National Cybersecurity Authority: https://cyber.gov.gr/odigia-nis2/",
          "To that end we apply technical and organisational measures, including:",
          "• encrypted connections (HTTPS/TLS) for all traffic, with HSTS enforced,",
          "• security headers (Content-Security-Policy, X-Frame-Options, etc.) to protect against attacks such as XSS and clickjacking,",
          "• secure password storage using cryptographic hashing, and two-factor authentication (2FA) for administration,",
          "• request rate limiting and abuse protection,",
          "• a security audit log of key actions, storing no passwords or card data,",
          "• payments handled solely by an external payment provider — we never store full card details.",
          "Despite these measures, no transmission of data over the Internet is completely secure; we are committed to responding promptly to any security incident.",
        ],
      },
      {
        id: "policy-changes",
        title: "8. Policy changes",
        paragraphs: [
          "The last-updated date is published at the start of this policy.",
          "For a material change affecting an active account or introducing a new use of data, we provide a prominent website notice and, where appropriate or required, email notice before the new processing starts.",
          "Where fresh consent is required, we do not rely on the previous choice. Continuing to use the website after non-material updates means you have been informed of the revised policy.",
        ],
      },
    ],
  };

  window.NostalgiaPrivacyContent = {
    getContent: function (lang) {
      return lang === "en" ? EN : EL;
    },
  };
})();
