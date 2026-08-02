(function () {
  var EL = {
    intro: [
      "Θέλουμε οι κριτικές στη Nostalgia Collection να αντικατοπτρίζουν πραγματικές εμπειρίες πελατών — καλές και κακές. Αυτή η σελίδα εξηγεί με σαφήνεια πώς συλλέγουμε, ελέγχουμε και δημοσιεύουμε τις κριτικές προϊόντων.",
    ],
    sections: [
      {
        id: "policy",
        title: "1. Δημοσιεύουμε θετικές και αρνητικές κριτικές",
        paragraphs: [
          "Δεν επιλέγουμε ποιες κριτικές θα δημοσιευτούν με βάση τη βαθμολογία ή το αν μας αρέσει το περιεχόμενό τους. Η πολιτική μας είναι απλή: δημοσιεύουμε όλες τις αυθεντικές κριτικές — θετικές και αρνητικές — και αφαιρούμε μόνο όσες παραβιάζουν συγκεκριμένους, δημόσιους κανόνες περιεχομένου (δείτε παρακάτω).",
          "Μια κριτική δεν απορρίπτεται επειδή λέει, για παράδειγμα, «το άρωμα δεν μου άρεσε» ή «δεν άξιζε τα χρήματα». Αυτές είναι έγκυρες, φυσιολογικές εμπειρίες πελατών.",
        ],
      },
      {
        id: "rejected",
        title: "2. Τι περιεχόμενο απορρίπτουμε",
        paragraphs: [
          "Απορρίπτουμε ή αφαιρούμε κριτικές μόνο όταν περιέχουν:",
          "• Βρισιές, απειλές ή ρατσιστικό περιεχόμενο",
          "• Προσωπικά δεδομένα (τηλέφωνα, διευθύνσεις, email)",
          "• Spam ή διαφημιστικούς συνδέσμους",
          "• Περιεχόμενο εντελώς άσχετο με το προϊόν (π.χ. παράπονα μόνο για courier — αυτά τα διαχειριζόμαστε ξεχωριστά, μέσω της φόρμας επικοινωνίας)",
          "• Διπλή κριτική από τον ίδιο χρήστη για το ίδιο προϊόν",
          "• Κριτική που δεν μπορεί να επιβεβαιωθεί ότι προέρχεται από πραγματικό επισκέπτη",
          "Κάθε απόρριψη καταγράφεται με συγκεκριμένο λόγο — δεν υπάρχει γενικός λόγος τύπου «δεν μας άρεσε».",
        ],
      },
      {
        id: "verification",
        title: "3. Πώς ελέγχουμε ότι μια κριτική είναι από πραγματικό πελάτη",
        paragraphs: [
          "Όταν μια κριτική προέρχεται από επιβεβαιωμένη, παραδομένη παραγγελία του συγκεκριμένου προϊόντος, εμφανίζεται με το σήμα «✓ Επαληθευμένη».",
          "Δεχόμαστε επίσης κριτικές χωρίς απόδειξη αγοράς· αυτές δεν φέρουν το σήμα, ώστε να ξεχωρίζουν καθαρά από τις επιβεβαιωμένες.",
          "Κάθε πελάτης (συνδεδεμένος ή guest μέσω του συνδέσμου παρακολούθησης της παραγγελίας του) μπορεί να αξιολογήσει ένα προϊόν μία μόνο φορά ανά παραγγελία.",
        ],
      },
      {
        id: "average",
        title: "4. Πώς υπολογίζεται ο μέσος όρος",
        paragraphs: [
          "Ο μέσος όρος και η κατανομή αστεριών υπολογίζονται αποκλειστικά από τις εγκεκριμένες, δημοσιευμένες κριτικές — ποτέ από κριτικές σε αναμονή ή απορριφθείσες.",
        ],
      },
      {
        id: "editing",
        title: "5. Επεξεργασία & καταστάσεις κριτικών",
        paragraphs: [
          "Μια κριτική δεν μπορεί να επεξεργαστεί μετά την υποβολή της. Αν χρειάζεται διόρθωση, επικοινωνήστε μαζί μας.",
          "Σε σπάνιες περιπτώσεις όπου μια ήδη δημοσιευμένη κριτική πρέπει να αφαιρεθεί αργότερα (π.χ. μεταγενέστερη αναφορά παραβίασης), αυτό καταγράφεται με συγκεκριμένο λόγο, όχι σιωπηλά.",
        ],
      },
      {
        id: "sponsored",
        title: "6. Καμία χορηγούμενη αξιολόγηση",
        paragraphs: [
          "Δεν πληρώνουμε, δεν ανταλλάσσουμε δώρα και δεν χορηγούμε αξιολογήσεις. Όλες οι κριτικές προέρχονται από ανεξάρτητους επισκέπτες και πελάτες.",
        ],
      },
      {
        id: "reply",
        title: "7. Δημόσιες απαντήσεις μας",
        paragraphs: [
          "Αντί να κρύβουμε αρνητικές κριτικές, μπορούμε να απαντήσουμε δημόσια κάτω από αυτές — ειδικά όταν ένα πρόβλημα έχει ήδη επιλυθεί (π.χ. αντικατάσταση προϊόντος).",
        ],
      },
    ],
  };

  var EN = {
    intro: [
      "We want reviews on Nostalgia Collection to reflect real customer experiences — good and bad. This page explains clearly how we collect, screen and publish product reviews.",
    ],
    sections: [
      {
        id: "policy",
        title: "1. We publish both positive and negative reviews",
        paragraphs: [
          "We do not choose which reviews get published based on their rating or whether we like the content. Our policy is simple: we publish every authentic review — positive and negative — and only remove ones that break specific, public content rules (see below).",
          "A review is never rejected for saying, for example, \"I didn't like the scent\" or \"wasn't worth the money\". Those are valid, ordinary customer experiences.",
        ],
      },
      {
        id: "rejected",
        title: "2. What content we reject",
        paragraphs: [
          "We reject or remove reviews only when they contain:",
          "• Insults, threats or racist content",
          "• Personal data (phone numbers, addresses, emails)",
          "• Spam or promotional links",
          "• Content entirely unrelated to the product (e.g. courier-only complaints — these are handled separately, via our contact form)",
          "• A duplicate review from the same person for the same product",
          "• A review that cannot be confirmed as coming from a genuine visitor",
          "Every rejection is logged with a specific reason — there is no generic \"we didn't like it\" reason.",
        ],
      },
      {
        id: "verification",
        title: "3. How we verify a review comes from a real customer",
        paragraphs: [
          "When a review comes from a confirmed, delivered order for that specific product, it is shown with the \"✓ Verified\" badge.",
          "We also accept reviews without proof of purchase; these do not carry the badge, so they're clearly distinguished from verified ones.",
          "Each customer (signed in, or a guest via their order-tracking link) can review a product once per order.",
        ],
      },
      {
        id: "average",
        title: "4. How the average rating is calculated",
        paragraphs: [
          "The average and star distribution are computed only from approved, published reviews — never from pending or rejected ones.",
        ],
      },
      {
        id: "editing",
        title: "5. Editing & review states",
        paragraphs: [
          "A review cannot be edited after submission. If it needs a correction, please contact us.",
          "In rare cases where an already-published review needs to be taken down later (e.g. a subsequent report of a violation), that is logged with a specific reason, never silently.",
        ],
      },
      {
        id: "sponsored",
        title: "6. No sponsored reviews",
        paragraphs: [
          "We do not pay for, exchange gifts for, or sponsor reviews. Every review comes from an independent visitor or customer.",
        ],
      },
      {
        id: "reply",
        title: "7. Our public replies",
        paragraphs: [
          "Instead of hiding negative reviews, we may reply publicly underneath them — especially once an issue has already been resolved (e.g. a product replacement).",
        ],
      },
    ],
  };

  window.NostalgiaReviewPolicyContent = {
    getContent: function (lang) {
      return lang === "en" ? EN : EL;
    },
  };
})();
