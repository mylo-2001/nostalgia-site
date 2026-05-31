(function () {
  var STORAGE_LANG = "nostalgia-lang";

  var STRINGS = {
    el: {
      meta_title_home: "Nostalgia Collection · Αρχική",
      meta_title_about: "Nostalgia Collection · Σχετικά",
      meta_title_collection: "Nostalgia Collection · Συλλογή",
      meta_title_contact: "Nostalgia Collection · Επικοινωνία",
      nav_home: "Αρχική",
      nav_collection: "Συλλογή",
      nav_about: "Σχετικά",
      nav_contact: "Επικοινωνία",
      nav_menu: "Μενού",
      side_nav_all_collections: "Όλες οι συλλογές",
      side_nav_see_all: "Δείτε όλα",
      side_nav_about_all: "Η Nostalgia",
      side_nav_discover: "Ανακάλυψε",
      side_nav_visual_home_title: "Nostalgia Collection",
      side_nav_visual_home_desc: "Κεριά αναμνήσεων — χειροποίητη τέχνη φωτός.",
      side_nav_visual_cat_desc: "Μια συλλογή χειροποίητων κεριών με μοναδικό χαρακτήρα.",
      side_nav_visual_contact_title: "Επικοινωνία",
      side_nav_visual_contact_desc: "Είμαστε εδώ για κάθε απορία ή παραγγελία.",
      nav_aria: "Κύρια πλοήγηση",
      logo_aria: "Nostalgia Collection · Αρχική",
      lang_aria: "Αλλαγή γλώσσας",
      lang_go_en: "English",
      lang_go_el: "Ελληνικά",
      theme_go_light: "Φωτεινό",
      theme_go_dark: "Σκοτεινό",
      theme_aria_to_light: "Εναλλαγή σε φωτεινό θέμα",
      theme_aria_to_dark: "Εναλλαγή σε σκοτεινό θέμα",
      hero_aria: "Εισαγωγή",
      hero_title: "Κεριά αναμνήσεων. Ποίηση που ανάβει.",
      hero_lead:
        "Μια συλλογή χειροποίητων αρωματικών κεριών εμπνευσμένη από ιστορίες, φυσικά υλικά και την τέχνη της ανάμνησης.",
      hero_cta: "Ανακαλύψτε τη συλλογή",
      hero_whisper: "Νοσταλγείς όσα δεν πρόλαβες να πεις.",
      home_discover_aria: "Σχετικά και συλλογή",
      home_about_heading: "Σχετικά",
      home_about_btn: "Μάθετε περισσότερα",
      home_about_section_title: "Σχετικά με τη Nostalgia",
      home_about_card1_title: "Η Φιλοσοφία μας",
      home_about_card1_sub: "Φτιαγμένο για να Συγκινεί. Να Μένει.",
      home_about_card2_title: "Η Τέχνη του Κεριού",
      home_about_card2_sub: "Χειροποίητο στην Ελλάδα",
      home_about_card3_title: "Δημιουργία",
      home_about_card3_sub: "Μαρία Γεροστάθη",
      home_about_portrait_alt: "Μαρία Γεροστάθη",
      home_manifesto_eyebrow: "Nostalgia Art · Liquid Eternal by Maria Gerostathi",
      home_manifesto_body: "Η Nostalgia Candles γεννήθηκε από τη μνήμη, το φως και την ανάγκη να μετατραπεί το συναίσθημα σε αντικείμενο τέχνης.",
      home_manifesto_quote: "Νοσταλγείς όσα δεν πρόλαβες να πεις.",
      home_manifesto_cta: "Ανακαλύψτε την συλλογή",
      home_moment_eyebrow: "Προϊόντα",
      home_moment_quote: "Νοσταλγείς όσα δεν πρόλαβες να πεις.",
      home_moment_sig: "— Μαρία Γεροστάθη",
      home_moment_cta: "Η ιστορία μας",
      cart_aria: "Καλάθι αγορών",
      cart_heading: "Το καλάθι σου",
      cart_empty_title: "Το καλάθι σου είναι άδειο",
      cart_empty_text: "Πρόσθεσε προϊόντα από τη συλλογή για να ξεκινήσεις.",
      cart_added_title: "Το προϊόν προστέθηκε στο καλάθι σου",
      cart_view: "Δες το καλάθι σου",
      cart_continue: "Συνέχεια αγορών",
      cart_remove: "Αφαίρεση",
      cart_qty_label: "Ποσότητα",
      cart_summary_title: "Σύνοψη",
      cart_subtotal_label: "Υποσύνολο",
      cart_shipping_label: "Μεταφορικά",
      cart_shipping_free: "Δωρεάν μεταφορικά",
      cart_total_label: "Σύνολο",
      cart_summary_note: "Η παραγγελία επιβεβαιώνεται τηλεφωνικά ή μέσω email.",
      cart_checkout: "Ολοκλήρωση παραγγελίας",
      product_view: "Δες προϊόν",
      product_add_cart: "Προσθήκη στο καλάθι",
      product_buy_now: "Αγόρασέ το τώρα",
      product_qty_label: "Ποσότητα",
      product_not_found: "Το προϊόν δεν βρέθηκε",
      checkout_heading: "Ολοκλήρωση παραγγελίας",
      checkout_summary_title: "Η παραγγελία σου",
      checkout_name_label: "Ονοματεπώνυμο",
      checkout_firstname_label: "Όνομα",
      checkout_lastname_label: "Επώνυμο",
      checkout_email_label: "Email",
      checkout_phone_label: "Τηλέφωνο",
      checkout_mobile_label: "Κινητό",
      checkout_address_label: "Διεύθυνση αποστολής",
      checkout_street_label: "Οδός",
      checkout_street_number_label: "Αριθμός οδού",
      checkout_city_label: "Πόλη",
      checkout_postal_label: "Τ.Κ.",
      checkout_prefecture_label: "Νομός",
      checkout_prefecture_placeholder: "Επιλογή νομού",
      checkout_country_label: "Χώρα",
      checkout_country_value: "Ελλάδα (GR)",
      checkout_floor_label: "Όροφος",
      checkout_floor_placeholder: "Επιλογή ορόφου",
      checkout_floor_basement: "Υπόγειο",
      checkout_floor_ground: "Ισόγειο",
      checkout_floor_1: "1ος όροφος",
      checkout_floor_2: "2ος όροφος",
      checkout_floor_3: "3ος όροφος",
      checkout_floor_4: "4ος όροφος",
      checkout_floor_5: "5ος όροφος",
      checkout_floor_6: "6ος όροφος",
      checkout_floor_7: "7ος όροφος",
      checkout_floor_8: "8ος όροφος",
      checkout_floor_9: "9ος όροφος",
      checkout_floor_10: "10ος όροφος",
      checkout_floor_11: "11ος όροφος",
      checkout_floor_12: "12ος όροφος",
      checkout_floor_13: "13ος όροφος",
      checkout_floor_14: "14ος όροφος",
      checkout_floor_15: "15ος όροφος",
      checkout_floor_15plus: "15ος όροφος +",
      checkout_location_type_label: "Τύπος τοποθεσίας",
      checkout_location_type_placeholder: "Επιλογή τύπου",
      checkout_location_home: "Σπίτι",
      checkout_location_work: "Εργασία",
      checkout_location_other: "Άλλο",
      checkout_notes_label: "Σημειώσεις παράδοσης (προαιρετικά)",
      checkout_back: "← Επιστροφή",
      checkout_shipping_title: "Πού θέλεις να αποσταλεί η παραγγελία;",
      checkout_doc_title: "Χρειάζεσαι απόδειξη ή τιμολόγιο;",
      checkout_doc_receipt: "Απόδειξη",
      checkout_doc_invoice: "Τιμολόγιο",
      checkout_company_label: "Επωνυμία επιχείρησης",
      checkout_afm_label: "Α.Φ.Μ.",
      checkout_doy_label: "Δ.Ο.Υ.",
      checkout_activity_label: "Επάγγελμα",
      checkout_invoice_required: "Συμπλήρωσε τα στοιχεία τιμολογίου για να συνεχίσεις.",
      checkout_payment_title: "Επίλεξε τον τρόπο πληρωμής",
      checkout_pay_stripe: "Κάρτα (Stripe)",
      checkout_pay_stripe_desc: "Ασφαλής online πληρωμή με πιστωτική ή χρεωστική κάρτα.",
      checkout_pay_cod: "Αντικαταβολή",
      checkout_pay_cod_desc: "Πληρωμή στον courier κατά την παράδοση.",
      checkout_pay_cod_fee: "+3,50 €",
      checkout_cod_fee_label: "Αντικαταβολή",
      checkout_stripe_note: "Η πληρωμή με κάρτα θα ολοκληρωθεί μέσω Stripe. Θα επικοινωνήσουμε μαζί σου για επιβεβαίωση της παραγγελίας.",
      checkout_to_payment: "Στοιχεία πληρωμής",
      checkout_pay_btn: "Πληρωμή {total}",
      checkout_step_back: "← Επιστροφή στα στοιχεία",
      checkout_deliver_to: "Αποστολή σε",
      checkout_vat_note: "Στις τιμές συμπεριλαμβάνεται Φ.Π.Α.",
      checkout_submit: "Υποβολή παραγγελίας",
      checkout_order_note: "Θα επικοινωνήσουμε μαζί σου για επιβεβαίωση και τιμολόγηση.",
      checkout_success: "Θα επικοινωνήσουμε μαζί σου σύντομα για επιβεβαίωση.",
      checkout_success_eyebrow: "Επιτυχής παραγγελία",
      checkout_success_title: "Η παραγγελία σου καταχωρήθηκε",
      checkout_success_products: "Τα προϊόντα σου",
      checkout_success_payment_stripe: "Πληρωμή με κάρτα",
      checkout_success_payment_cod: "Αντικαταβολή",
      checkout_success_email_note: "Θα ανοίξει το email σας για αποστολή της παραγγελίας.",
      checkout_email_subject: "Παραγγελία Nostalgia Collection",
      meta_title_cart: "Nostalgia Collection · Καλάθι",
      meta_title_product: "Nostalgia Collection · Προϊόν",
      meta_title_checkout: "Nostalgia Collection · Ολοκλήρωση",
      eshop_coming_soon: "Σύντομα έρχεται και e-shop για αγορές μέσα από το site.",
      contact_order_message: "Για οποιαδήποτε απορία ή παραγγελία, επικοινωνήστε μαζί μας στο +30 693 941 1774.",
      toast_close_aria: "Κλείσιμο μηνύματος",
      home_collections_heading: "Τα προϊόντα μας",
      home_collection_btn: "Συλλογή",
      home_collection_feature_title: "Σφραγισμένες Μνήμες",
      home_collection_feature_sub: "Συλλεκτικά Κεριά · Τεχνουργήματα",
      home_collection_feature_cta: "Δείτε τη Συλλογή",
      collection_heading: "Η συλλογή",
      collection_aria: "Κατηγορίες",
      collection_cat: "Κατηγορία",
      collection_cat1: "Art Class Murano Candle",
      collection_cat2: "Driftwood Beeswax Flame",
      collection_cat3: "Liquid Eternal",
      collection_cat4: "Unique Art Objects",
      collection_select: "Επιλογή",
      collection_brand_strip: "Nostalgia Candles",
      collection_placeholder_img: "Εικόνα",
      collection_back: "Πίσω στις κατηγορίες",
      collection_catalog_lead: "Χειροποίητα κεριά τέχνης — μια εμπειρία φωτός και μνήμης.",
      collection_items_count: "{n} προϊόντα",
      collection_cat1_prod1_title: "",
      collection_cat1_prod1_desc: "",
      collection_cat1_prod2_title: "",
      collection_cat1_prod2_desc: "",
      collection_cat1_prod3_title: "",
      collection_cat1_prod3_desc: "",
      collection_cat1_prod4_title: "",
      collection_cat1_prod4_desc: "",
      collection_cat1_prod5_title: "",
      collection_cat1_prod5_desc: "",
      collection_cat1_prod6_title: "",
      collection_cat1_prod6_desc: "",
      collection_cat2_prod1_title: "",
      collection_cat2_prod1_desc: "",
      collection_cat2_prod2_title: "",
      collection_cat2_prod2_desc: "",
      collection_cat2_prod3_title: "",
      collection_cat2_prod3_desc: "",
      collection_cat2_prod4_title: "",
      collection_cat2_prod4_desc: "",
      collection_cat2_prod5_title: "",
      collection_cat2_prod5_desc: "",
      collection_cat2_prod6_title: "",
      collection_cat2_prod6_desc: "",
      collection_cat3_prod1_title: "",
      collection_cat3_prod1_desc: "",
      collection_cat3_prod2_title: "",
      collection_cat3_prod2_desc: "",
      collection_cat3_prod3_title: "",
      collection_cat3_prod3_desc: "",
      collection_cat3_prod4_title: "",
      collection_cat3_prod4_desc: "",
      collection_cat3_prod5_title: "",
      collection_cat3_prod5_desc: "",
      collection_cat3_prod6_title: "",
      collection_cat3_prod6_desc: "",
      collection_cat4_prod1_title: "",
      collection_cat4_prod1_desc: "",
      collection_cat4_prod2_title: "",
      collection_cat4_prod2_desc: "",
      collection_cat4_prod3_title: "",
      collection_cat4_prod3_desc: "",
      collection_cat4_prod4_title: "",
      collection_cat4_prod4_desc: "",
      collection_cat4_prod5_title: "",
      collection_cat4_prod5_desc: "",
      collection_cat4_prod6_title: "",
      collection_cat4_prod6_desc: "",
      collection_stories_heading: "Οι ιστορίες των προϊόντων μας",
      collection_cat1_story_title: "Murano Art Glass Collection",
      collection_cat1_story_p1: "Η συλλογή Murano Art Glass — Limited Edition είναι ένας φόρος τιμής στην αιώνια τέχνη του φυσητού γυαλιού. Κάθε κερί φιλοξενείται σε ένα μοναδικό γυάλινο δοχείο, εμπνευσμένο από τις ρευστές γραμμές, τα πλούσια χρώματα και τις οργανικές ατέλειες που χαρακτηρίζουν τα αυθεντικά έργα τέχνης από γυαλί.",
      collection_cat1_story_p2: "Το φως της φλόγας διαχέεται μέσα από το γυαλί δημιουργώντας μαγευτικές αντανακλάσεις, μετατρέποντας κάθε χώρο σε μια εμπειρία ζεστασιάς και κομψότητας. Κατασκευασμένα στη Θεσσαλονίκη με προσοχή στη λεπτομέρεια και γεμισμένα με ποιοτικό κερί, τα κεριά της συλλογής συνδυάζουν τη διακοσμητική αξία ενός έργου τέχνης με την ατμόσφαιρα ενός πολυτελούς αρώματος.",
      collection_cat1_story_p3: "Κάθε κομμάτι είναι ξεχωριστό, όπως ακριβώς και η ιστορία που αφηγείται το φως του.",
      collection_cat1_story_motto: "Nostalgia Murano Art Glass — όταν η τέχνη του γυαλιού συναντά την τέχνη της ατμόσφαιρας.",
      collection_cat2_story_title: "Η Μνήμη του Ποταμού Χαράζει Φως",
      collection_cat2_story_p1: "Εκεί όπου η θρυλική Νέδα ενώνεται με την αλμύρα του Ιονίου, ο χρόνος αφήνει τα αποτυπώματά του πάνω στο ξύλο. Μορφές αρχέγονες αναδύονται από το driftwood, σαν να τις σμίλεψαν νεράιδες, ξωτικά, πνεύματα του κρύου νερού και ξεχασμένοι μαρμαρωμένοι βασιλιάδες.",
      collection_cat2_story_p2: "Εγώ απλώς τις ανακαλύπτω, τις τιμώ και τις φωτίζω.",
      collection_cat2_story_p3: "Κάθε ξύλο είναι μοναδικό. Κάθε φλόγα ξυπνά μια ιστορία που περίμενε χρόνια να ειπωθεί, να αναγεννηθεί και να αποκτήσει ξανά νοσταλγική, πύρινη ζωή.",
      collection_cat2_story_p4: "Ένας συλλεκτικός συνδυασμός από φυσικά ξύλα που ταξίδεψαν από τις εκβολές της θρυλικής Νέδας, απολιθωμένα κοχύλια από τα ιερά νερά του Ιονίου και της Ελαίας, και ακατέργαστο μελισσοκέρι.",
      collection_cat2_story_p5: "Δεν δημιουργώ απλώς κεριά. Ανασύρω μνήμες που η φύση φύλαξε για αιώνες και τους χαρίζω ξανά φως.",
      collection_cat3_story_title: "LIQUID UNSPOKEN WORD",
      collection_cat3_story_p1: "Υπάρχουν λέξεις που δεν ειπώθηκαν ποτέ.",
      collection_cat3_story_p2: "Σκέψεις που έμειναν κρυμμένες, εξομολογήσεις που καθυστέρησαν, αλήθειες που η καρδιά φύλαξε σιωπηλά μέσα της.",
      collection_cat3_story_p3: "Η σειρά Nostalgia Liquid Unspoken Word γεννήθηκε ακριβώς τούτες τις στιγμές.",
      collection_cat3_story_p4: "Δεν είναι απλώς μια συλλογή — δίνει Ψυχή στο άυλο.",
      collection_cat3_story_p5: "Είναι μια βιωματική εμπειρία συναισθήματος, μνήμης, τέχνης και προσμονής.",
      collection_cat3_story_p6: "Κάθε πρωτοποριακή δημιουργία της Μαρίας Γεροστάθη κατασκευάζεται κατόπιν ειδικής παραγγελίας και κρύβει στο εσωτερικό της ένα προσωπικό μυστικό.",
      collection_cat3_story_p7: "Μέσα στο διάφανο υδάτινο στρώμα φυλάσσεται ένα μικρό γυάλινο φιαλίδιο — μια σφραγισμένη κάψουλα συναισθήματος.",
      collection_cat3_story_list_intro: "Μηνύματα που δεν είχαν το θρόισμα του ήχου:",
      collection_cat3_story_li1: "Ένα «σ' αγαπώ» που δεν ειπώθηκε ποτέ",
      collection_cat3_story_li2: "Μια συγγνώμη που άργησε χρόνια",
      collection_cat3_story_li3: "Μια εξομολόγηση καρδιάς",
      collection_cat3_story_li4: "Μια υπόσχεση για το μέλλον",
      collection_cat3_story_li5: "Μια πρόταση γάμου",
      collection_cat3_story_li6: "Μια αποκάλυψη από έναν «άγνωστο αποστολέα» που δεν τόλμησε να μιλήσει τότε…",
      collection_cat3_story_p8: "Η πύρινη ιεροτελεστία ξεκινά — καίει αργά, σχεδόν τελετουργικά.",
      collection_cat3_story_p9: "Καθώς το liquid candle λιώνει και τα στρώματα μεταμορφώνονται, μεγαλώνει και η νοσταλγική προσμονή.",
      collection_cat3_story_p10: "Το μήνυμα δεν αποκαλύπτεται αμέσως. Απελευθερώνεται μόνο όταν το κερί ολοκληρώσει τον κύκλο του.",
      collection_cat3_story_p11: "Γιατί κάποια λόγια δεν έρχονται όταν τα ζητάμε — έρχονται όταν είμαστε έτοιμοι να τα ακούσουμε.",
      collection_cat3_story_p12: "Η σειρά της δημιουργού δεν είναι ένα διακοσμητικό αντικείμενο ή ένα συνηθισμένο δώρο.",
      collection_cat3_story_p13: "Γεννά μια τελετή καρδιάς, μια εμπειρία αναμονής, ένα μονοπάτι για να δοθεί φωνή σε όσα έμειναν ανείπωτα.",
      collection_cat3_story_p14: "Κάθε σφραγισμένο αντικείμενο μεταφέρει μαζί του αναμνήσεις, τρυφερότητα και το πεπρωμένο μας.",
      collection_cat3_story_motto1: "Ό,τι δεν ειπώθηκε… βρίσκει τον δρόμο του",
      collection_cat3_story_motto_amp: "&",
      collection_cat3_story_motto2: "ΝΟΣΤΑΛΓΕΙΣ ΟΣΑ ΔΕΝ ΠΡΟΛΑΒΕΣ ΝΑ ΠΕΙΣ",
      collection_cat4_story_title: "Ανάμεσα στο Χθες και το Σήμερα",
      collection_cat4_story_p1: "Σπάνια αντικείμενα τέχνης, προερχόμενα από αρχοντικά σπίτια και οικογένειες με βαθιές ρίζες στην ελληνική παράδοση — δημιουργίες εμπνευσμένες από τις εποχές του Art Deco, του Baroque και του Rococo — συλλέγονται και αναβιώνουν τη διαχρονική αξία του χθες μέσα στο σήμερα.",
      collection_cat4_story_p2: "Μέσα από τη σύγχρονη ψυχή της Nostalgia The Collection, αποκτούν ξανά υπόσταση και φως. Ντύνονται με αρώματα εμπνευσμένα από άλλες εποχές και τυλίγονται με αναμνήσεις, μεταμορφώνοντας κάθε δημιουργία σε μια πολύτιμη νοσταλγική λάμψη που γεφυρώνει το χάσμα του παρελθόντος με το παρόν.",
      about_heading: "Σχετικά με το Nostalgia",
      about_lead: "Χειροποίητες λεπτομέρειες, φυσικά υλικά, διαχρονική αισθητική.",
      about_hidden: "Περιεχόμενα",
      about_story_aria: "Η ιστορία μας",
      about_p1:
        "Το N I δεν γεννήθηκε σαν ιδέα για brand. Γεννήθηκε σαν ανάγκη να κρατήσω κάτι ζωντανό, όταν όλα άλλαξαν. Η νοσταλγία, για μένα, δεν είναι απλώς «θυμάμαι». Είναι εκείνη η λεπτή στιγμή που κάτι μέσα σου επιστρέφει: ένα δωμάτιο, ένα βλέμμα, μια φωνή, ένα χέρι πάνω στον ώμο… και κυρίως μια μυρωδιά.",
      about_p2:
        "Γιατί οι μυρωδιές δεν ζητούν άδεια. Μπαίνουν κατευθείαν στην καρδιά και σε πάνε πίσω εκεί που ήσουν παιδί, εκεί που ήσουν ασφαλής, εκεί που αγαπούσες χωρίς να το σκέφτεσαι.",
      about_p3: "Έτσι άρχισα να φτιάχνω. Όχι για να πουλήσω. Για να μπορώ να αναπνέω.",
      about_p4:
        "Ο πατέρας μου, ο Ιωάννης, ήταν ο μοναδικός άντρας που αγάπησα έτσι: απλά, βαθιά, χωρίς όρους. Κι όμως υπάρχει κάτι που με κυνηγά σαν σκιά: ότι δεν ξέρω αν πρόλαβα να του πω καθαρά ένα «σ' αγαπώ». Ότι μέσα στην καθημερινότητα, πίστεψα  όπως πιστεύουμε όλοι  ότι ο χρόνος θα περιμένει. Και ύστερα ήρθε εκείνο το βράδυ. Πρωτοχρονιά.",
      about_p5:
        "Μια στιγμή που κόπηκε ο χρόνος στα δύο. Και ό,τι ήταν «μετά» έγινε ξαφνικά ποτέ. Εκεί, μέσα σε αυτό το πάγωμα, κατάλαβα κάτι που δεν είχα καταλάβει πριν: ο χρόνος είναι το πιο ακριβό πράγμα που μας δίνεται και το πιο εύκολο πράγμα να το σπαταλήσουμε.",
      about_p6:
        "Η Nostalgia NI είναι η δική μου απάντηση σε αυτό. Η δική μου προσπάθεια να τιμήσω τον χρόνο, όχι να τον κυνηγήσω. Κάθε κερί που δημιουργώ είναι σαν μικρό τελετουργικό επιστροφής: ανάβεις τη φλόγα και κάτι μέσα σου μαλακώνει. Το άρωμα ανοίγει μια πόρτα. Και για λίγα λεπτά, δεν τρέχεις. Θυμάσαι.",
      about_p7:
        "Δεν θέλω οι άνθρωποι να αγοράζουν απλώς ένα κερί. Θέλω να κρατάνε ένα αντικείμενο που τους κάνει συντροφιά. Που τους θυμίζει να πουν τώρα αυτά που αναβάλλουν. Να αγκαλιάσουν λίγο περισσότερο. Να μην αφήσουν τον χρόνο να τους προσπεράσει χωρίς να τον ζήσουν. Ο πόνος μου έγινε τέχνη πρώτα για να επιβιώσω εγώ. Και μετά, ίσως, για να γίνει για τους άλλους ένα καταφύγιο: ένα φως που δεν εξηγεί, αλλά απλώς μένει.",
      about_p8:
        "Το N I είναι τα αρχικά του Ιωάννη, ναι. Αλλά είναι και κάτι άλλο: είναι η υπόσχεση ότι καμία αγάπη δεν χάνεται όταν βρίσκει τρόπο να γίνει φως.",
      about_tab_story: "Η Ιστορία NI",
      about_tab_soul: "The Soul of Nostalgia",
      about_soul_title: "The Soul of Nostalgia",
      about_soul_aria: "Η ψυχή της Nostalgia",
      about_soul_p1:
        "Πριν η Nostalgia Candle γίνει όνομα, πριν υπάρξουν συλλογές, σχέδια και όνειρα για το μέλλον, υπήρξαν νύχτες σιωπής, αναμνήσεων και αναζήτησης.",
      about_soul_p2:
        "Σε εκείνη την περίοδο της ζωής μου γνώρισα τη φίλη μου, Κατερίνα Σινώδη. Ήρθε στη ζωή μου σε μια στιγμή που προσπαθούσα να σταθώ ξανά στα πόδια μου.",
      about_soul_p3:
        "Δεν με στήριξε μόνο με πράξεις, αλλά κυρίως με την καρδιά της. Ήταν από τους πρώτους ανθρώπους που πίστεψαν σε μένα στην τέχνη μου, πριν ακόμη εγώ η ίδια μπορέσω να δω πού θα με οδηγούσε αυτό το ταξίδι.",
      about_soul_p4:
        "Ήταν εκείνη που μου έφερε το πρώτο κιλό κερί σόγιας, δανεισμένο από ένα μικρό κατάστημα της γειτονιάς της. Ίσως να φαινόταν κάτι μικρό, όμως για μένα ήταν η αρχή των πάντων. Μαζί με παλιά κεριά που είχα κρατήσει, άρχισα να πειραματίζομαι, να λιώνω, να δοκιμάζω και να μαθαίνω.",
      about_soul_p5: "Όμως το πιο σημαντικό δώρο της δεν ήταν το κερί. Ήταν η συνεχής της πίστη σε μένα.",
      about_soul_p6: "Μου έδινε συμβουλές, με ενθάρρυνε να συνεχίσω και μου έλεγε ξανά και ξανά:",
      about_soul_quote:
        "«Πρέπει να φτιάξεις την εταιρεία σου. Πρέπει να δημιουργήσεις το website σου. Μην τα παρατήσεις.»",
      about_soul_p7:
        "Υπήρχαν βράδια που καθόμουν μόνη μπροστά στη σόμπα πετρελαίου του σπιτιού μου. Το κερί έλιωνε αργά πάνω στη ζεστασιά της και οι ώρες περνούσαν χωρίς να το καταλαβαίνω. Έξω ξημέρωνε κι εγώ συνέχιζα να παρακολουθώ τις φλόγες και τις σκιές τους.",
      about_soul_p8: "Κάποια πρωινά ερχόταν να με δει, η Κατερίνα με ρωτούσε:",
      about_soul_dialogue_q: "«Μαρία μου Νοσταλγία μου», χαριτολογώντας: «Δεν κοιμήθηκες;»",
      about_soul_dialogue_a: "«Όχι. Έλιωνα κεριά.»",
      about_soul_p9:
        "Αλλά η αλήθεια ήταν πως δεν έλιωνα μόνο κερί. Έλιωνα τη θλίψη μου, τις σκέψεις μου και όλα όσα κουβαλούσα μέσα μου από την απρόσμενη απώλεια του πατέρα μου.",
      about_soul_p10:
        "Εκείνες τις ώρες μιλούσα μαζί του με τον δικό μου τρόπο. Του έγραφα γράμματα. Του έλεγα όσα δεν πρόλαβα να του πω. Θυμόμουν τις στιγμές μας και νοσταλγούσα όσα ζήσαμε μαζί. Οι φλόγες που δημιουργούσα δεν ήταν απλώς φλόγες. Ήταν ένας φόρος τιμής στη μνήμη του, ένας τρόπος να κρατώ ζωντανή την παρουσία του μέσα στην καρδιά μου.",
      about_soul_p11: "Μέσα από αυτές τις ατέλειωτες νύχτες γεννήθηκε το όνομα Nostalgia ΝΙ.",
      about_soul_p12:
        "Ένα όνομα που κουβαλά την αγάπη, την απώλεια, τη μνήμη και την ελπίδα. Ένα όνομα που γεννήθηκε από τη νοσταλγία για έναν πατέρα που έφυγε νωρίς, αλλά και από την παρουσία ανθρώπων που στάθηκαν δίπλα μου όταν τους χρειαζόμουν περισσότερο.",
      about_soul_p13:
        "Η Κατερίνα υπήρξε ένα από αυτά τα πρόσωπα. Μια ήρεμη δύναμη, μια φίλη που μου θύμιζε να συνεχίζω όταν εγώ αμφέβαλλα. Και γι' αυτό, ένα κομμάτι της ψυχής της Nostalgia θα είναι πάντα συνδεδεμένο με εκείνα τα βράδια, εκείνες τις συζητήσεις και εκείνη την πίστη που μου χάρισε όταν την είχα περισσότερο ανάγκη.",
      about_soul_p14:
        "Η Nostalgia γεννήθηκε από τη μνήμη, μεγάλωσε μέσα από την αγάπη και συνεχίζει να φωτίζει τον δρόμο της χάρη στους ανθρώπους που πίστεψαν σε αυτήν από την πρώτη Μεγαλοπρεπέστατη Ιερή φλόγα.",
      about_tab_vision: "Our Vision",
      about_vision_title: "Το Όραμά μας",
      about_vision_aria: "Το όραμα της Nostalgia",
      about_vision_p1:
        "Στη Nostalgia, πιστεύουμε ότι η πολυτέλεια δεν βρίσκεται στην υπερβολή, αλλά στις αυθεντικές εμπειρίες, στις αναμνήσεις και στον χρόνο που αφιερώνουμε στον εαυτό μας και στους ανθρώπους που αγαπάμε.",
      about_vision_p2:
        "Στόχος μου είναι η δημιουργία ενός επισκέψιμου κηροποιείου στην περιοχή του Κιλκίς, ενός προορισμού που θα συνδυάζει την τέχνη της κηροποιίας με την ελληνική φύση, την παράδοση και τη φιλοξενία. Ένας χώρος όπου οι επισκέπτες θα μπορούν να γνωρίσουν από κοντά τη διαδικασία δημιουργίας των κεριών, να συμμετέχουν σε εργαστήρια, να περιηγηθούν σε κήπους με αρωματικά βότανα και φυτά και να επιλέγουν οι ίδιοι φυσικά στοιχεία που θα αποτελούν μέρος της εμπειρίας τους.",
      about_vision_p3:
        "Οραματίζομαι έναν τόπο όπου το άρωμα της λεβάντας, της πασχαλιάς και των βοτάνων θα συναντά το φως της φλόγας. Έναν χώρο όπου ο επισκέπτης θα μπορεί να δροσιστεί από το νερό του παραδοσιακού πηγαδιού, να απολαύσει τον καφέ του με θέα το επιβλητικό βυζαντινό κάστρο του Παλαιό Γυναικόκαστρο και να βιώσει στιγμές που θα τον μεταφέρουν πίσω στις πιο όμορφες αναμνήσεις της παιδικής του ηλικίας.",
      about_vision_p4:
        "Παράλληλα, στη Θεσσαλονίκη αναπτύσσω το Nostalgia Candle Spa, ένα πρωτοποριακό concept φιλοξενίας που θα αποτελείται από τρία premium διαμερίσματα κοντά στο κέντρο της πόλης. Ο χώρος θα συνδυάζει την ατμόσφαιρα του κεριού, την αρωματοθεραπεία, τη χαλάρωση και την ευεξία, προσφέροντας μια ολοκληρωμένη εμπειρία φιλοξενίας με jacuzzi και προσεκτικά σχεδιασμένες λεπτομέρειες που θα ενεργοποιούν τις αισθήσεις και θα δημιουργούν αίσθημα γαλήνης και θαλπωρής.",
      about_vision_p5:
        "Η Nostalgia Candle by Maria Gerostathi επενδύει σε δύο αξίες που θεωρώ ανεκτίμητες στη σύγχρονη εποχή: την ψυχή και τον χρόνο. Γιατί ο χρόνος είναι το πολυτιμότερο αγαθό που διαθέτουμε και οι αναμνήσεις είναι το αποτύπωμα που αφήνει πίσω του.",
      about_vision_p6:
        "Το όραμά μου δεν περιορίζεται στη δημιουργία χειροποίητων κεριών. Είναι η δημιουργία εμπειριών, συναισθημάτων και χώρων που αγγίζουν τη συνείδηση των ανθρώπων, προσφέροντας μια αίσθηση οικειότητας, ηρεμίας και ουσιαστικής σύνδεσης με όσα έχουν πραγματική αξία.",
      about_vision_sign_name: "Μαρία Γεροστάθη",
      about_vision_sign_role: "Founder & Creative Director",
      about_vision_sign_brand: "Nostalgia Candle by Maria Gerostathi",
      nav_mega_aria: "Συλλογές κεριών",
      nav_mega_title: "Σφραγισμένες Μνήμες",
      nav_mega_desc:
        "Τέσσερις συλλογές χειροποίητων κεριών — τέχνη, φως και ανάμνηση.",
      nav_mega_cta: "Δείτε τη συλλογή",
      nav_about_mega_aria: "Ιστορίες Nostalgia",
      nav_about_mega_title: "Σχετικά με τη Nostalgia",
      nav_about_mega_desc:
        "Η ιστορία NI και η ψυχή πίσω από κάθε φλόγα — μνήμη, τέχνη και αγάπη.",
      nav_about_mega_cta: "Διαβάστε περισσότερα",
      contact_heading: "Επικοινωνία",
      contact_lead: "Είμαστε εδώ για κάθε απορία ή παραγγελία.",
      contact_card_title: "Στοιχεία επικοινωνίας",
      contact_phone_label: "Τηλ:",
      contact_email_label: "Email:",
      contact_note: "Μπορείτε να επικοινωνήσετε τηλεφωνικά ή μέσω email και θα σας απαντήσουμε το συντομότερο δυνατό.",
      contact_photo_alt: "Χειροποίητα αρωματικά κεριά Nostalgia — λεπτομέρεια από χέρι που κρατά αναμμένα κεριά.",
      footer_tagline: "Κάθε προϊόν παρασκευάζεται με προσοχή και φυσικά υλικά",
      footer_address: "Θεσσαλονίκη · Τ.Κ. 54351",
      footer_phone_label: "Τηλ:",
      footer_instagram_aria: "Ακολουθήστε μας στο Instagram",
      footer_copyright: "© 2026 Nostalgia. Με επιφύλαξη παντός δικαιώματος.",
      footer_hosting: "Hosting by",
      footer_privacy: "Προστασία Δεδομένων",
      footer_legal_aria: "Νομικές πληροφορίες",
      privacy_title: "Προστασία Δεδομένων",
      meta_title_privacy: "Nostalgia Collection · Προστασία Δεδομένων",
      cookie_banner_title: "Τα cookies στον ιστότοπό μας",
      cookie_banner_text: "Η Nostalgia Collection χρησιμοποιεί cookies για να εξασφαλίζει τη σωστή λειτουργία του ιστότοπου και να βελτιώνει την εμπειρία περιήγησής σας.",
      cookie_learn_more: "Μάθετε περισσότερα",
      cookie_manage: "Ρυθμίσεις cookies",
      cookie_accept: "Αποδοχή",
      cookie_settings_title: "Διαχείριση cookies",
      cookie_settings_lead: "Επιλέξτε ποιες κατηγορίες cookies επιθυμείτε να ενεργοποιήσετε. Τα απολύτως απαραίτητα cookies παραμένουν πάντα ενεργά, καθώς είναι αναγκαία για τη λειτουργία του ιστότοπου.",
      cookie_essential_title: "Απολύτως απαραίτητα",
      cookie_always_on: "Πάντα ενεργά",
      cookie_essential_desc: "Απαιτούνται για τη βασική λειτουργία του ιστότοπου: καλάθι αγορών, προτιμήσεις γλώσσας και εμφάνισης, καθώς και αποθήκευση των επιλογών σας σχετικά με τα cookies.",
      cookie_analytics_title: "Cookies ανάλυσης",
      cookie_analytics_desc: "Μας επιτρέπουν να κατανοούμε, με ανώνυμο τρόπο, πώς χρησιμοποιείται ο ιστότοπος, ώστε να βελτιώνουμε συνεχώς την εμπειρία σας. Η ενεργοποίησή τους είναι προαιρετική.",
      cookie_refuse: "Απόρριψη μη απαραίτητων",
      cookie_save: "Αποθήκευση επιλογών",
      cookie_accept_all: "Αποδοχή όλων",
      account_my_account: "Ο λογαριασμός μου",
      account_aria: "Σύνδεση / Λογαριασμός",
      account_login_title: "Σύνδεση",
      account_register_title: "Δημιουργία λογαριασμού",
      account_password_label: "Κωδικός",
      account_password_confirm_label: "Επιβεβαίωση κωδικού",
      account_sign_in: "Σύνδεση",
      account_create_btn: "Δημιουργία",
      account_create_prompt: "Δημιουργία λογαριασμού",
      account_have_account: "Έχετε ήδη λογαριασμό;",
      account_forgot: "Ξεχάσατε τον κωδικό;",
      account_forgot_help: "Επικοινωνήστε μαζί μας στο mgerostathi@gmail.com ή στο +30 693 941 1774 για επαναφορά κωδικού.",
      account_login_error: "Λάθος email ή κωδικός.",
      account_exists_error: "Υπάρχει ήδη λογαριασμός με αυτό το email.",
      account_password_mismatch: "Οι κωδικοί δεν ταιριάζουν.",
      account_welcome: "Καλώς ήρθες",
      account_logout: "Αποσύνδεση",
      newsletter_title: "Newsletter",
      newsletter_lead: "Εγγράψου στο newsletter μας και μάθε πρώτος τα νέα της Nostalgia Collection.",
      newsletter_email_ph: "Το email σου",
      newsletter_firstname_ph: "Όνομα",
      newsletter_lastname_ph: "Επώνυμο",
      newsletter_submit: "Εγγραφή",
      newsletter_success: "Ευχαριστούμε για την εγγραφή σου!",
    },
    en: {
      meta_title_home: "Nostalgia Collection · Home",
      meta_title_about: "Nostalgia Collection · About",
      meta_title_collection: "Nostalgia Collection · Collection",
      meta_title_contact: "Nostalgia Collection · Contact",
      nav_home: "Home",
      nav_collection: "Collection",
      nav_about: "About",
      nav_contact: "Contact",
      nav_menu: "Menu",
      side_nav_all_collections: "All collections",
      side_nav_see_all: "See all",
      side_nav_about_all: "About Nostalgia",
      side_nav_discover: "Discover",
      side_nav_visual_home_title: "Nostalgia Collection",
      side_nav_visual_home_desc: "Candles of memory — handmade light and art.",
      side_nav_visual_cat_desc: "A collection of handmade candles with a unique character.",
      side_nav_visual_contact_title: "Contact",
      side_nav_visual_contact_desc: "We are here for every question or order.",
      nav_aria: "Main navigation",
      logo_aria: "Nostalgia Collection · Home",
      lang_aria: "Change language",
      lang_go_en: "English",
      lang_go_el: "Ελληνικά",
      theme_go_light: "Light",
      theme_go_dark: "Dark",
      theme_aria_to_light: "Switch to light theme",
      theme_aria_to_dark: "Switch to dark theme",
      hero_aria: "Introduction",
      hero_title: "Candles of memory. Poetry that lights up.",
      hero_lead:
        "A collection of handmade scented candles inspired by stories, natural materials, and the art of remembrance.",
      hero_cta: "Discover the collection",
      hero_whisper: "You long for what you never got to say.",
      home_discover_aria: "About and collection",
      home_about_heading: "About",
      home_about_btn: "Learn more",
      home_about_section_title: "About Nostalgia",
      home_about_card1_title: "Our Philosophy",
      home_about_card1_sub: "Crafted to Evoke. Endure.",
      home_about_card2_title: "The Art of Candle Making",
      home_about_card2_sub: "Handcrafted in Greece",
      home_about_card3_title: "Created by",
      home_about_card3_sub: "Maria Gerostathi",
      home_about_portrait_alt: "Maria Gerostathi",
      home_manifesto_eyebrow: "Nostalgia Art · Liquid Eternal by Maria Gerostathi",
      home_manifesto_body: "Nostalgia Candles was born from memory, from light, and from the need to transform emotion into an object of art.",
      home_manifesto_quote: "You long for what you never got to say.",
      home_manifesto_cta: "Discover the collection",
      home_moment_eyebrow: "Products",
      home_moment_quote: "You long for what you never got to say.",
      home_moment_sig: "— Maria Gerostathi",
      home_moment_cta: "Our story",
      cart_aria: "Shopping cart",
      cart_heading: "Your cart",
      cart_empty_title: "Your cart is empty",
      cart_empty_text: "Add products from the collection to get started.",
      cart_added_title: "The product was added to your cart",
      cart_view: "View your cart",
      cart_continue: "Continue shopping",
      cart_remove: "Remove",
      cart_qty_label: "Quantity",
      cart_summary_title: "Summary",
      cart_subtotal_label: "Subtotal",
      cart_shipping_label: "Shipping",
      cart_shipping_free: "Free shipping",
      cart_total_label: "Total",
      cart_summary_note: "Your order is confirmed by phone or email.",
      cart_checkout: "Complete order",
      product_view: "View product",
      product_add_cart: "Add to cart",
      product_buy_now: "Buy it now",
      product_qty_label: "Quantity",
      product_not_found: "Product not found",
      checkout_heading: "Checkout",
      checkout_summary_title: "Your order",
      checkout_name_label: "Full name",
      checkout_firstname_label: "First name",
      checkout_lastname_label: "Last name",
      checkout_email_label: "Email",
      checkout_phone_label: "Phone",
      checkout_mobile_label: "Mobile",
      checkout_address_label: "Shipping address",
      checkout_street_label: "Street",
      checkout_street_number_label: "Street number",
      checkout_city_label: "City",
      checkout_postal_label: "Postal code",
      checkout_prefecture_label: "Prefecture",
      checkout_prefecture_placeholder: "Select prefecture",
      checkout_country_label: "Country",
      checkout_country_value: "Greece (GR)",
      checkout_floor_label: "Floor",
      checkout_floor_placeholder: "Select floor",
      checkout_floor_basement: "Basement",
      checkout_floor_ground: "Ground floor",
      checkout_floor_1: "1st floor",
      checkout_floor_2: "2nd floor",
      checkout_floor_3: "3rd floor",
      checkout_floor_4: "4th floor",
      checkout_floor_5: "5th floor",
      checkout_floor_6: "6th floor",
      checkout_floor_7: "7th floor",
      checkout_floor_8: "8th floor",
      checkout_floor_9: "9th floor",
      checkout_floor_10: "10th floor",
      checkout_floor_11: "11th floor",
      checkout_floor_12: "12th floor",
      checkout_floor_13: "13th floor",
      checkout_floor_14: "14th floor",
      checkout_floor_15: "15th floor",
      checkout_floor_15plus: "15th floor +",
      checkout_location_type_label: "Location type",
      checkout_location_type_placeholder: "Select type",
      checkout_location_home: "Home",
      checkout_location_work: "Work",
      checkout_location_other: "Other",
      checkout_notes_label: "Delivery notes (optional)",
      checkout_back: "← Back",
      checkout_shipping_title: "Where should we ship your order?",
      checkout_doc_title: "Do you need a receipt or invoice?",
      checkout_doc_receipt: "Receipt",
      checkout_doc_invoice: "Invoice",
      checkout_company_label: "Company name",
      checkout_afm_label: "Tax ID (AFM)",
      checkout_doy_label: "Tax office (DOY)",
      checkout_activity_label: "Business activity",
      checkout_invoice_required: "Please fill in the invoice details to continue.",
      checkout_payment_title: "Choose a payment method",
      checkout_pay_stripe: "Card (Stripe)",
      checkout_pay_stripe_desc: "Secure online payment with credit or debit card.",
      checkout_pay_cod: "Cash on delivery",
      checkout_pay_cod_desc: "Pay the courier upon delivery.",
      checkout_pay_cod_fee: "+€3.50",
      checkout_cod_fee_label: "Cash on delivery fee",
      checkout_stripe_note: "Card payment will be completed via Stripe. We will contact you to confirm your order.",
      checkout_to_payment: "Payment details",
      checkout_pay_btn: "Pay {total}",
      checkout_step_back: "← Back to details",
      checkout_deliver_to: "Deliver to",
      checkout_vat_note: "Prices include VAT.",
      checkout_submit: "Submit order",
      checkout_order_note: "We will contact you to confirm your order and pricing.",
      checkout_success: "We will contact you shortly to confirm your order.",
      checkout_success_eyebrow: "Order placed",
      checkout_success_title: "Your order has been placed",
      checkout_success_products: "Your products",
      checkout_success_payment_stripe: "Card payment",
      checkout_success_payment_cod: "Cash on delivery",
      checkout_success_email_note: "Your email app will open to send the order details.",
      checkout_email_subject: "Nostalgia Collection order",
      meta_title_cart: "Nostalgia Collection · Cart",
      meta_title_product: "Nostalgia Collection · Product",
      meta_title_checkout: "Nostalgia Collection · Checkout",
      eshop_coming_soon: "An e-shop is coming soon, so you can shop directly through the site.",
      contact_order_message: "For any question or order, contact us at +30 693 941 1774.",
      toast_close_aria: "Close message",
      home_collections_heading: "Our products",
      home_collection_btn: "Collection",
      home_collection_feature_title: "Sealed Memories",
      home_collection_feature_sub: "Collector Candle Artefacts",
      home_collection_feature_cta: "View the Collection",
      collection_heading: "The collection",
      collection_aria: "Categories",
      collection_cat: "Category",
      collection_cat1: "Art Class Murano Candle",
      collection_cat2: "Driftwood Beeswax Flame",
      collection_cat3: "Liquid Eternal",
      collection_cat4: "Unique Art Objects",
      collection_select: "Select",
      collection_brand_strip: "Nostalgia Candles",
      collection_placeholder_img: "Image",
      collection_back: "Back to categories",
      collection_catalog_lead: "Handcrafted art candles — an experience of light and memory.",
      collection_items_count: "{n} items",
      collection_cat1_prod1_title: "",
      collection_cat1_prod1_desc: "",
      collection_cat1_prod2_title: "",
      collection_cat1_prod2_desc: "",
      collection_cat1_prod3_title: "",
      collection_cat1_prod3_desc: "",
      collection_cat1_prod4_title: "",
      collection_cat1_prod4_desc: "",
      collection_cat1_prod5_title: "",
      collection_cat1_prod5_desc: "",
      collection_cat1_prod6_title: "",
      collection_cat1_prod6_desc: "",
      collection_cat2_prod1_title: "",
      collection_cat2_prod1_desc: "",
      collection_cat2_prod2_title: "",
      collection_cat2_prod2_desc: "",
      collection_cat2_prod3_title: "",
      collection_cat2_prod3_desc: "",
      collection_cat2_prod4_title: "",
      collection_cat2_prod4_desc: "",
      collection_cat2_prod5_title: "",
      collection_cat2_prod5_desc: "",
      collection_cat2_prod6_title: "",
      collection_cat2_prod6_desc: "",
      collection_cat3_prod1_title: "",
      collection_cat3_prod1_desc: "",
      collection_cat3_prod2_title: "",
      collection_cat3_prod2_desc: "",
      collection_cat3_prod3_title: "",
      collection_cat3_prod3_desc: "",
      collection_cat3_prod4_title: "",
      collection_cat3_prod4_desc: "",
      collection_cat3_prod5_title: "",
      collection_cat3_prod5_desc: "",
      collection_cat3_prod6_title: "",
      collection_cat3_prod6_desc: "",
      collection_cat4_prod1_title: "",
      collection_cat4_prod1_desc: "",
      collection_cat4_prod2_title: "",
      collection_cat4_prod2_desc: "",
      collection_cat4_prod3_title: "",
      collection_cat4_prod3_desc: "",
      collection_cat4_prod4_title: "",
      collection_cat4_prod4_desc: "",
      collection_cat4_prod5_title: "",
      collection_cat4_prod5_desc: "",
      collection_cat4_prod6_title: "",
      collection_cat4_prod6_desc: "",
      collection_stories_heading: "The stories of our products",
      collection_cat1_story_title: "Murano Art Glass Collection",
      collection_cat1_story_p1: "The Murano Art Glass — Limited Edition series is a tribute to the eternal art of blown glass. Each candle is housed in a unique glass vessel inspired by the fluid lines, rich colours and organic imperfections that define authentic glass artworks.",
      collection_cat1_story_p2: "The flame's light diffuses through the glass, casting mesmerising reflections that turn every space into an experience of warmth and elegance. Crafted in Thessaloniki with meticulous attention to detail and filled with premium wax, the candles of this collection unite the decorative value of an artwork with the atmosphere of a luxurious fragrance.",
      collection_cat1_story_p3: "Each piece is one of a kind — just like the story its light tells.",
      collection_cat1_story_motto: "Nostalgia Murano Art Glass — where the art of glass meets the art of atmosphere.",
      collection_cat2_story_title: "The River's Memory Carves Light",
      collection_cat2_story_p1: "Where the legendary Neda meets the salt of the Ionian, time leaves its imprints upon the wood. Primal forms emerge from the driftwood, as though sculpted by nymphs, sprites, spirits of cold water and forgotten marble kings.",
      collection_cat2_story_p2: "I simply discover them, honour them, and bring them light.",
      collection_cat2_story_p3: "Each piece of wood is unique. Each flame awakens a story that waited years to be told, to be reborn, to claim once again a nostalgic, fiery life.",
      collection_cat2_story_p4: "A collector's blend of natural woods that travelled from the mouths of the legendary Neda, fossilised shells from the sacred waters of the Ionian and Elaia, and raw beeswax.",
      collection_cat2_story_p5: "I do not simply make candles. I draw out memories that nature has kept for centuries and give them light once more.",
      collection_cat3_story_title: "LIQUID UNSPOKEN WORD",
      collection_cat3_story_p1: "There are words that were never spoken.",
      collection_cat3_story_p2: "Thoughts that stayed hidden, confessions that came too late, truths the heart kept silent within itself.",
      collection_cat3_story_p3: "The Nostalgia Liquid Unspoken Word series was born precisely in such moments.",
      collection_cat3_story_p4: "It is not merely a collection — it gives Soul to the intangible.",
      collection_cat3_story_p5: "It is a lived experience of feeling, memory, art and anticipation.",
      collection_cat3_story_p6: "Each pioneering creation by Maria Gerostathi is made to special order, hiding a personal secret within.",
      collection_cat3_story_p7: "Inside the translucent water layer rests a small glass vial — a sealed capsule of feeling.",
      collection_cat3_story_list_intro: "Messages that never carried the rustle of sound:",
      collection_cat3_story_li1: "An “I love you” that was never said",
      collection_cat3_story_li2: "An apology delayed by years",
      collection_cat3_story_li3: "A confession of the heart",
      collection_cat3_story_li4: "A promise for the future",
      collection_cat3_story_li5: "A marriage proposal",
      collection_cat3_story_li6: "A revelation from an “unknown sender” who never dared to speak then…",
      collection_cat3_story_p8: "The fiery ritual begins — burning slowly, almost ceremonially.",
      collection_cat3_story_p9: "As the liquid candle melts and the layers transform, the nostalgic anticipation grows.",
      collection_cat3_story_p10: "The message is not revealed at once. It is released only when the candle completes its cycle.",
      collection_cat3_story_p11: "Because some words do not come when we ask for them — they come when we are ready to hear them.",
      collection_cat3_story_p12: "The artist's series is not a decorative object or an ordinary gift.",
      collection_cat3_story_p13: "It births a ceremony of the heart, an experience of waiting, a path for what was left unsaid to find its voice.",
      collection_cat3_story_p14: "Every sealed object carries with it memories, tenderness, and our destiny.",
      collection_cat3_story_motto1: "What was not spoken… finds its way",
      collection_cat3_story_motto_amp: "&",
      collection_cat3_story_motto2: "YOU LONG FOR ALL THAT YOU NEVER MANAGED TO SAY",
      collection_cat4_story_title: "Timeless Artifacts Reborn in Light, Scent & Memory",
      collection_cat4_story_p1: "Rare objects of art — sourced from grand homes and families with deep roots in Greek tradition, creations inspired by the eras of Art Deco, Baroque and Rococo — are gathered to revive the timeless value of yesterday within today.",
      collection_cat4_story_p2: "Through the contemporary soul of Nostalgia The Collection, they regain form and light. They are dressed in scents inspired by other eras and wrapped in memories, transforming each creation into a precious nostalgic glow that bridges the gulf between past and present.",
      about_heading: "About Nostalgia",
      about_lead: "Handmade detail, natural materials, timeless aesthetics.",
      about_hidden: "Contents",
      about_story_aria: "Our story",
      about_p1:
        "NI was not born as a brand idea. It was born from the need to keep something alive when everything changed. For me, nostalgia is not simply “I remember.” It is that delicate moment when something inside you returns: a room, a glance, a voice, a hand on your shoulder… and above all, a scent.",
      about_p2:
        "Because scents do not ask permission. They go straight to the heart and take you back to where you were a child, where you felt safe, where you loved without thinking.",
      about_p3: "That is how I began to make things. Not to sell. So that I could breathe.",
      about_p4:
        'My father, Giannis, was the only man I ever loved like that: simply, deeply, without conditions. And yet something follows me like a shadow: not knowing whether I managed to tell him clearly “I love you.” That in everyday life I believed as we all do that time would wait. And then came that night. New Year’s Eve.',
      about_p5:
        "A moment when time split in two. And everything that was “after” suddenly became never. There, in that freeze, I understood something I had not understood before: time is the most precious thing we are given, and the easiest thing to waste.",
      about_p6:
        "Nostalgia NI is my answer to that. My attempt to honour time, not chase it. Every candle I make is like a small ritual of return: you light the flame and something inside you softens. The scent opens a door. And for a few minutes, you do not run. You remember.",
      about_p7:
        "I do not want people to simply buy a candle. I want them to hold an object that keeps them company. That reminds them to say now what they postpone. To hug a little more. Not to let time pass them by without living it. My pain became art first so that I could survive. And then, perhaps, so it could become for others a shelter: a light that does not explain, but simply stays.",
      about_p8:
        "NI are Giannis’s initials, yes. But they are also something else: the promise that no love is lost when it finds a way to become light.",
      about_tab_story: "The NI Story",
      about_tab_soul: "The Soul of Nostalgia",
      about_soul_title: "The Soul of Nostalgia",
      about_soul_aria: "The soul of Nostalgia",
      about_soul_p1:
        "Before Nostalgia Candle became a name, before collections, designs and dreams for the future, there were nights of silence, memory and searching.",
      about_soul_p2:
        "In that period of my life I met my friend, Katerina Sinodi. She came into my life at a moment when I was trying to stand on my feet again.",
      about_soul_p3:
        "She supported me not only through actions, but above all with her heart. She was among the first people to believe in my art, before I myself could see where this journey would lead.",
      about_soul_p4:
        "She was the one who brought me the first kilo of soy wax, borrowed from a small shop in her neighbourhood. It may have seemed a small thing, yet for me it was the beginning of everything. Together with old candles I had kept, I began to experiment, to melt, to try and to learn.",
      about_soul_p5: "Yet her most important gift was not the wax. It was her unwavering faith in me.",
      about_soul_p6: "She gave me advice, encouraged me to continue, and told me again and again:",
      about_soul_quote:
        "“You must build your company. You must create your website. Do not give up.”",
      about_soul_p7:
        "There were evenings when I sat alone before the oil stove in my home. The wax melted slowly in its warmth and the hours passed without my noticing. Outside, dawn would break and I would go on watching the flames and their shadows.",
      about_soul_p8: "Some mornings she would come to see me, and Katerina would ask:",
      about_soul_dialogue_q: "“My Maria, my Nostalgia,” teasing: “Did you not sleep?”",
      about_soul_dialogue_a: "“No. I was melting wax.”",
      about_soul_p9:
        "But the truth was that I was melting more than wax. I was melting my sorrow, my thoughts and all I carried within me from the unexpected loss of my father.",
      about_soul_p10:
        "In those hours I spoke with him in my own way. I wrote him letters. I told him what I had not managed to say. I remembered our moments together and longed for all we had lived. The flames I created were not merely flames. They were a tribute to his memory, a way to keep his presence alive within my heart.",
      about_soul_p11: "From those endless nights the name Nostalgia NI was born.",
      about_soul_p12:
        "A name that carries love, loss, memory and hope. A name born from nostalgia for a father who left too soon, and from the presence of people who stood beside me when I needed them most.",
      about_soul_p13:
        "Katerina was one of those faces. A quiet strength, a friend who reminded me to continue when I doubted. And so, a part of the soul of Nostalgia will always be connected to those nights, those conversations and the faith she gave me when I needed it most.",
      about_soul_p14:
        "Nostalgia was born from memory, grew through love, and continues to light its path thanks to those who believed in it from the very first, most magnificent Sacred Flame.",
      about_tab_vision: "Our Vision",
      about_vision_title: "Our Vision",
      about_vision_aria: "The vision of Nostalgia",
      about_vision_p1:
        "At Nostalgia, we believe that luxury is not found in excess, but in authentic experiences, in memories, and in the time we devote to ourselves and to the people we love.",
      about_vision_p2:
        "My goal is to create a visitable candle workshop in the Kilkis region — a destination that will combine the art of candle making with Greek nature, tradition and hospitality. A place where visitors can witness the creation process up close, take part in workshops, stroll through gardens of aromatic herbs and plants, and choose the natural elements that will become part of their own experience.",
      about_vision_p3:
        "I envision a place where the scent of lavender, lilac and herbs meets the light of the flame. A space where the guest can refresh themselves at a traditional well, enjoy coffee with a view of the imposing Byzantine castle of Palaio Gynaikokastro, and live moments that carry them back to the most beautiful memories of childhood.",
      about_vision_p4:
        "At the same time, in Thessaloniki, I am developing Nostalgia Candle Spa — a pioneering hospitality concept consisting of three premium apartments near the city centre. The space will combine the atmosphere of candlelight, aromatherapy, relaxation and wellness, offering a complete hospitality experience with jacuzzi and carefully designed details that awaken the senses and create a feeling of calm and warmth.",
      about_vision_p5:
        "Nostalgia Candle by Maria Gerostathi invests in two values I consider priceless in the modern age: the soul and time. Because time is the most precious gift we have, and memories are the imprint it leaves behind.",
      about_vision_p6:
        "My vision is not limited to making handmade candles. It is the creation of experiences, emotions and spaces that touch people's consciousness, offering a sense of intimacy, serenity and meaningful connection with what truly matters.",
      about_vision_sign_name: "Maria Gerostathi",
      about_vision_sign_role: "Founder & Creative Director",
      about_vision_sign_brand: "Nostalgia Candle by Maria Gerostathi",
      nav_mega_aria: "Candle collections",
      nav_mega_title: "Sealed Memories",
      nav_mega_desc:
        "Four collections of handmade candles — art, light and remembrance.",
      nav_mega_cta: "View the collection",
      nav_about_mega_aria: "Nostalgia stories",
      nav_about_mega_title: "About Nostalgia",
      nav_about_mega_desc:
        "The NI story and the soul behind every flame — memory, art and love.",
      nav_about_mega_cta: "Read more",
      contact_heading: "Contact",
      contact_lead: "We are here for any question or order.",
      contact_card_title: "Contact details",
      contact_phone_label: "Tel:",
      contact_email_label: "Email:",
      contact_note: "You can call us or send us an email and we will reply as soon as possible.",
      contact_photo_alt: "Handmade Nostalgia scented candles — detail of a hand holding lit candles.",
      footer_tagline: "Every product is made with care and natural materials",
      footer_address: "Thessaloniki · 54351, Greece",
      footer_phone_label: "Tel:",
      footer_instagram_aria: "Follow us on Instagram",
      footer_copyright: "© 2026 Nostalgia. All rights reserved.",
      footer_hosting: "Hosting by",
      footer_privacy: "Data Protection Policy",
      footer_legal_aria: "Legal information",
      privacy_title: "Data Protection Policy",
      meta_title_privacy: "Nostalgia Collection · Data Protection",
      cookie_banner_title: "Cookies on our website",
      cookie_banner_text: "Nostalgia Collection uses cookies to ensure the website functions correctly and to enhance your browsing experience.",
      cookie_learn_more: "Learn more",
      cookie_manage: "Cookie settings",
      cookie_accept: "Accept",
      cookie_settings_title: "Manage cookies",
      cookie_settings_lead: "Choose which categories of cookies you wish to enable. Strictly necessary cookies remain always active, as they are required for the website to function.",
      cookie_essential_title: "Strictly necessary",
      cookie_always_on: "Always active",
      cookie_essential_desc: "Required for core website functionality: shopping cart, language and display preferences, and storing your cookie choices.",
      cookie_analytics_title: "Analytics cookies",
      cookie_analytics_desc: "Allow us to understand anonymously how the website is used, so we can continually improve your experience. Enabling them is optional.",
      cookie_refuse: "Reject non-essential",
      cookie_save: "Save preferences",
      cookie_accept_all: "Accept all",
      account_my_account: "My account",
      account_aria: "Log in / Account",
      account_login_title: "Log in",
      account_register_title: "Create account",
      account_password_label: "Password",
      account_password_confirm_label: "Confirm password",
      account_sign_in: "Sign in",
      account_create_btn: "Create account",
      account_create_prompt: "Create an account",
      account_have_account: "Already have an account?",
      account_forgot: "Forgot your password?",
      account_forgot_help: "Contact us at mgerostathi@gmail.com or +30 693 941 1774 to reset your password.",
      account_login_error: "Incorrect email or password.",
      account_exists_error: "An account with this email already exists.",
      account_password_mismatch: "Passwords do not match.",
      account_welcome: "Welcome",
      account_logout: "Log out",
      newsletter_title: "Follow us",
      newsletter_lead: "Subscribe to our newsletter and don't miss the latest from Nostalgia Collection.",
      newsletter_email_ph: "Your email address",
      newsletter_firstname_ph: "Your first name",
      newsletter_lastname_ph: "Your last name",
      newsletter_submit: "Subscribe",
      newsletter_success: "Thank you for subscribing!",
    },
  };

  function getStoredLang() {
    try {
      return localStorage.getItem(STORAGE_LANG);
    } catch (e) {
      return null;
    }
  }

  function getLang() {
    var l = document.documentElement.lang || "el";
    return l === "en" ? "en" : "el";
  }

  function t(key) {
    var lang = getLang();
    var pack = STRINGS[lang] || STRINGS.el;
    return pack[key] != null ? pack[key] : key;
  }

  function applyLang(lang, opts) {
    opts = opts || {};
    if (lang !== "el" && lang !== "en") {
      lang = "el";
    }
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_LANG, lang);
    } catch (e) {}

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) return;
      var val = STRINGS[lang][key];
      if (val == null) return;
      el.textContent = val;
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (!key || !STRINGS[lang][key]) return;
      el.setAttribute("aria-label", STRINGS[lang][key]);
    });

    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var altKey = el.getAttribute("data-i18n-alt");
      if (!altKey || !STRINGS[lang][altKey]) return;
      el.setAttribute("alt", STRINGS[lang][altKey]);
    });

    var page = document.body && document.body.getAttribute("data-page");
    var metaKey = "meta_title_home";
    if (page === "about") metaKey = "meta_title_about";
    else if (page === "collection") metaKey = "meta_title_collection";
    else if (page === "contact") metaKey = "meta_title_contact";
    else if (page === "cart") metaKey = "meta_title_cart";
    else if (page === "product") metaKey = "meta_title_product";
    else if (page === "checkout") metaKey = "meta_title_checkout";
    else if (page === "privacy") metaKey = "meta_title_privacy";
    document.title = STRINGS[lang][metaKey];

    var langBtn = document.getElementById("lang-toggle");
    if (langBtn) {
      langBtn.textContent = lang === "el" ? STRINGS.el.lang_go_en : STRINGS.en.lang_go_el;
      langBtn.setAttribute("aria-label", STRINGS[lang].lang_aria);
    }

    if (typeof window.NostalgiaApplyThemeLabels === "function") {
      window.NostalgiaApplyThemeLabels();
    }

    if (typeof window.NostalgiaOnLangApplied === "function") {
      window.NostalgiaOnLangApplied(lang);
    }

    if (opts.restartStory) {
      resetAboutStoryAnimation();
    }
  }

  function triggerAboutParagraphs(story) {
    story.classList.add("is-visible");
    var storyPanel = document.querySelector('[data-about-panel="story"]');
    var split = storyPanel && storyPanel.querySelector(".about-split");
    if (split) {
      split.classList.add("is-visible");
    }
    var paragraphs = story.querySelectorAll(".about-story__p");
    paragraphs.forEach(function (p, i) {
      window.setTimeout(function () {
        p.classList.add("is-visible");
      }, 220 + i * 170);
    });
  }

  function aboutStoryInView(story) {
    var r = story.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * 0.92 && r.bottom > vh * 0.08;
  }

  function resetAboutStoryAnimation() {
    var storyPanel = document.querySelector('[data-about-panel="story"]');
    if (!storyPanel || storyPanel.hidden) return;
    var story = storyPanel.querySelector(".about-story");
    if (!story) return;
    story.classList.remove("is-visible");
    var split = storyPanel.querySelector(".about-split");
    if (split) {
      split.classList.remove("is-visible");
    }
    story.querySelectorAll(".about-story__p").forEach(function (p) {
      p.classList.remove("is-visible");
    });
    window.requestAnimationFrame(function () {
      if (aboutStoryInView(story)) {
        triggerAboutParagraphs(story);
      } else if (typeof window.NostalgiaObserveAboutStory === "function") {
        window.NostalgiaObserveAboutStory();
      }
    });
  }

  window.resetAboutStoryAnimation = resetAboutStoryAnimation;

  function initLangToggle() {
    var btn = document.getElementById("lang-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = getLang() === "el" ? "en" : "el";
      applyLang(next, { restartStory: true });
    });
  }

  function initAboutStoryObserver() {
    var storyPanel = document.querySelector('[data-about-panel="story"]');
    if (!storyPanel) return;
    var story = storyPanel.querySelector(".about-story");
    if (!story) return;

    if (typeof IntersectionObserver === "undefined") {
      triggerAboutParagraphs(story);
      return;
    }

    window.NostalgiaObserveAboutStory = function () {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            obs.disconnect();
            triggerAboutParagraphs(story);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      obs.observe(story);
    };

    window.NostalgiaObserveAboutStory();
  }

  function init() {
    var stored = getStoredLang();
    applyLang(stored === "en" || stored === "el" ? stored : "el", {
      restartStory: false,
    });
    initLangToggle();
    initAboutStoryObserver();
  }

  window.NostalgiaI18n = {
    strings: STRINGS,
    t: t,
    applyLang: applyLang,
    getLang: getLang,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
