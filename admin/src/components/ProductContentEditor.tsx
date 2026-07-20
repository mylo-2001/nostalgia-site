import { useEffect, useState } from "react";
import { api } from "../api/client";
import { CATEGORIES, COLOR_FAMILIES } from "../lib/catalog";
import type { AdminProduct } from "../types/product";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Language = "el" | "en";

interface NestedDetails {
  top?: unknown;
  heart?: unknown;
  base?: unknown;
  notes?: unknown;
  duration?: unknown;
  capacity?: unknown;
  [key: string]: unknown;
}

export interface ProductContentDraft {
  colorFamily: string;
  description: string;
  descriptionEn: string;
  badges: string;
  badgesEn: string;
  features: string;
  featuresEn: string;
  longDescription: string;
  longDescriptionEn: string;
  specs: string;
  specsEn: string;
  care: string;
  careEn: string;
  shipping: string;
  shippingEn: string;
  includes: string;
  includesEn: string;
  scentTop: string;
  scentTopEn: string;
  scentHeart: string;
  scentHeartEn: string;
  scentBase: string;
  scentBaseEn: string;
  diffuserNotes: string;
  diffuserNotesEn: string;
  diffuserDuration: string;
  diffuserDurationEn: string;
  diffuserCapacity: string;
  diffuserCapacityEn: string;
}

interface PendingImage {
  name: string;
  data: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function lines(value: unknown, separator = "\n"): string {
  if (!Array.isArray(value)) return text(value);
  return value.map((item) => text(item)).filter(Boolean).join(separator);
}

function specs(value: unknown): string {
  if (!Array.isArray(value)) return text(value);
  return value.map((item) => {
    const spec = record(item);
    return spec.label && spec.value ? `${text(spec.label)}: ${text(spec.value)}` : "";
  }).filter(Boolean).join("\n");
}

export function emptyProductContent(): ProductContentDraft {
  return {
    colorFamily: "",
    description: "", descriptionEn: "",
    badges: "", badgesEn: "",
    features: "", featuresEn: "",
    longDescription: "", longDescriptionEn: "",
    specs: "", specsEn: "",
    care: "", careEn: "",
    shipping: "", shippingEn: "",
    includes: "", includesEn: "",
    scentTop: "", scentTopEn: "",
    scentHeart: "", scentHeartEn: "",
    scentBase: "", scentBaseEn: "",
    diffuserNotes: "", diffuserNotesEn: "",
    diffuserDuration: "", diffuserDurationEn: "",
    diffuserCapacity: "", diffuserCapacityEn: "",
  };
}

export function createProductContentDraft(
  rawDetails: Record<string, unknown> | null | undefined,
  productDescription = "",
  productDescriptionEn = "",
): ProductContentDraft {
  const details = record(rawDetails);
  const scent = record(details.scentNotes) as NestedDetails;
  const scentEn = record(details.scentNotesEn) as NestedDetails;
  const diffuser = record(details.diffuser) as NestedDetails;
  const diffuserEn = record(details.diffuserEn) as NestedDetails;
  return {
    colorFamily: text(details.colorFamily),
    description: productDescription || text(details.description),
    descriptionEn: productDescriptionEn || text(details.descriptionEn),
    badges: lines(details.badges, ", "), badgesEn: lines(details.badgesEn, ", "),
    features: lines(details.features), featuresEn: lines(details.featuresEn),
    longDescription: text(details.longDescription), longDescriptionEn: text(details.longDescriptionEn),
    specs: specs(details.specs), specsEn: specs(details.specsEn),
    care: lines(details.care, "\n\n"), careEn: lines(details.careEn, "\n\n"),
    shipping: lines(details.shipping), shippingEn: lines(details.shippingEn),
    includes: lines(details.includes), includesEn: lines(details.includesEn),
    scentTop: text(scent.top), scentTopEn: text(scentEn.top),
    scentHeart: text(scent.heart), scentHeartEn: text(scentEn.heart),
    scentBase: text(scent.base), scentBaseEn: text(scentEn.base),
    diffuserNotes: text(diffuser.notes), diffuserNotesEn: text(diffuserEn.notes),
    diffuserDuration: text(diffuser.duration), diffuserDurationEn: text(diffuserEn.duration),
    diffuserCapacity: text(diffuser.capacity), diffuserCapacityEn: text(diffuserEn.capacity),
  };
}

export function productDetailsPayload(
  draft: ProductContentDraft,
  rawDetails?: Record<string, unknown> | null,
): Record<string, unknown> {
  const original = record(rawDetails);
  return {
    ...original,
    colorFamily: draft.colorFamily,
    description: draft.description,
    descriptionEn: draft.descriptionEn,
    badges: draft.badges,
    badgesEn: draft.badgesEn,
    features: draft.features,
    featuresEn: draft.featuresEn,
    longDescription: draft.longDescription,
    longDescriptionEn: draft.longDescriptionEn,
    specs: draft.specs,
    specsEn: draft.specsEn,
    care: draft.care,
    careEn: draft.careEn,
    shipping: draft.shipping,
    shippingEn: draft.shippingEn,
    includes: draft.includes,
    includesEn: draft.includesEn,
    scentNotes: {
      ...record(original.scentNotes),
      top: draft.scentTop,
      heart: draft.scentHeart,
      base: draft.scentBase,
    },
    scentNotesEn: {
      ...record(original.scentNotesEn),
      top: draft.scentTopEn,
      heart: draft.scentHeartEn,
      base: draft.scentBaseEn,
    },
    diffuser: {
      ...record(original.diffuser),
      notes: draft.diffuserNotes,
      duration: draft.diffuserDuration,
      capacity: draft.diffuserCapacity,
    },
    diffuserEn: {
      ...record(original.diffuserEn),
      notes: draft.diffuserNotesEn,
      duration: draft.diffuserDurationEn,
      capacity: draft.diffuserCapacityEn,
    },
  };
}

function languageKey(base: string, language: Language): keyof ProductContentDraft {
  return (language === "en" ? `${base}En` : base) as keyof ProductContentDraft;
}

export function ProductContentFields({
  value,
  onChange,
}: {
  value: ProductContentDraft;
  onChange: (next: ProductContentDraft) => void;
}) {
  const [language, setLanguage] = useState<Language>("el");

  function set(key: keyof ProductContentDraft, next: string) {
    onChange({ ...value, [key]: next });
  }

  function localized(base: string): string {
    return value[languageKey(base, language)];
  }

  function setLocalized(base: string, next: string) {
    set(languageKey(base, language), next);
  }

  return (
    <div className="content-fields">
      <label className="field content-color"><span>Χρώμα φίλτρου προϊόντος</span>
        <select value={value.colorFamily} onChange={(event) => set("colorFamily", event.target.value)}>
          <option value="">Χωρίς φίλτρο χρώματος</option>
          {COLOR_FAMILIES.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}
        </select>
      </label>

      <div className="content-language" role="tablist" aria-label="Γλώσσα περιεχομένου προϊόντος">
        <button type="button" role="tab" aria-selected={language === "el"} className={language === "el" ? "is-active" : ""} onClick={() => setLanguage("el")}>Ελληνικά</button>
        <button type="button" role="tab" aria-selected={language === "en"} className={language === "en" ? "is-active" : ""} onClick={() => setLanguage("en")}>English</button>
      </div>

      <fieldset className="content-section">
        <legend>Βασικό περιεχόμενο</legend>
        <div className="content-grid">
          <label className="field"><span>Badges, χωρισμένα με κόμμα</span>
            <input value={localized("badges")} onChange={(event) => setLocalized("badges", event.target.value)} placeholder={language === "el" ? "Χειροποίητο, Περιορισμένη έκδοση" : "Handmade, Limited edition"} />
          </label>
          <label className="field content-wide"><span>Σύντομη περιγραφή</span>
            <textarea rows={3} maxLength={2000} value={localized("description")} onChange={(event) => setLocalized("description", event.target.value)} />
          </label>
          <label className="field content-wide"><span>Χαρακτηριστικά, ένα ανά γραμμή</span>
            <textarea rows={4} value={localized("features")} onChange={(event) => setLocalized("features", event.target.value)} />
          </label>
          <label className="field content-wide"><span>Πλήρης περιγραφή</span>
            <textarea rows={5} value={localized("longDescription")} onChange={(event) => setLocalized("longDescription", event.target.value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="content-section">
        <legend>Λεπτομέρειες προϊόντος</legend>
        <div className="content-grid">
          <label className="field content-wide"><span>Προδιαγραφές, μία ανά γραμμή ως Ετικέτα: Τιμή</span>
            <textarea rows={4} value={localized("specs")} onChange={(event) => setLocalized("specs", event.target.value)} placeholder={language === "el" ? "Υλικό βάσης: Φυσικό ξύλο" : "Base material: Natural wood"} />
          </label>
          <label className="field content-wide"><span>Φροντίδα και οδηγίες</span>
            <textarea rows={4} value={localized("care")} onChange={(event) => setLocalized("care", event.target.value)} />
          </label>
          <label className="field"><span>Αποστολή και επιστροφές, ένα ανά γραμμή</span>
            <textarea rows={4} value={localized("shipping")} onChange={(event) => setLocalized("shipping", event.target.value)} />
          </label>
          <label className="field"><span>Περιεχόμενα συσκευασίας, ένα ανά γραμμή</span>
            <textarea rows={4} value={localized("includes")} onChange={(event) => setLocalized("includes", event.target.value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="content-section">
        <legend>Αρωματικές νότες</legend>
        <div className="content-grid content-grid--three">
          <label className="field"><span>Νότες κορυφής</span><input value={localized("scentTop")} onChange={(event) => setLocalized("scentTop", event.target.value)} /></label>
          <label className="field"><span>Νότες καρδιάς</span><input value={localized("scentHeart")} onChange={(event) => setLocalized("scentHeart", event.target.value)} /></label>
          <label className="field"><span>Νότες βάσης</span><input value={localized("scentBase")} onChange={(event) => setLocalized("scentBase", event.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset className="content-section">
        <legend>Στοιχεία diffuser</legend>
        <div className="content-grid content-grid--three">
          <label className="field"><span>Νότες</span><input value={localized("diffuserNotes")} onChange={(event) => setLocalized("diffuserNotes", event.target.value)} /></label>
          <label className="field"><span>Διάρκεια</span><input value={localized("diffuserDuration")} onChange={(event) => setLocalized("diffuserDuration", event.target.value)} placeholder={language === "el" ? "Έως 3 μήνες" : "Up to 3 months"} /></label>
          <label className="field"><span>Χωρητικότητα</span><input value={localized("diffuserCapacity")} onChange={(event) => setLocalized("diffuserCapacity", event.target.value)} placeholder="200 ml" /></label>
        </div>
      </fieldset>
    </div>
  );
}

function mediaUrl(value: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  return "/" + value.replace(/^\/+/, "");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

async function readImages(files: FileList | null): Promise<PendingImage[]> {
  const selected = Array.from(files || []);
  if (selected.length > MAX_IMAGES) throw new Error("too_many_images");
  const output: PendingImage[] = [];
  for (const file of selected) {
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) throw new Error("invalid_image");
    output.push({ name: file.name, data: await readFileAsDataUrl(file) });
  }
  return output;
}

export function ProductContentEditor({ product, onSaved }: { product: AdminProduct; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => createProductContentDraft(product.details, product.description, product.descriptionEn));
  const [title, setTitle] = useState(product.title);
  const [titleEn, setTitleEn] = useState(product.titleEn || "");
  const [catId, setCatId] = useState(product.catId);
  const [pendingImages, setPendingImages] = useState<PendingImage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDraft(createProductContentDraft(product.details, product.description, product.descriptionEn));
    setTitle(product.title);
    setTitleEn(product.titleEn || "");
    setCatId(product.catId);
    setPendingImages(null);
  }, [product]);

  async function chooseImages(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setPendingImages(await readImages(event.target.files));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error && error.message === "too_many_images"
        ? `Μπορείς να επιλέξεις έως ${MAX_IMAGES} εικόνες.`
        : "Κάθε εικόνα πρέπει να είναι αρχείο εικόνας έως 10 MB.");
    } finally {
      event.target.value = "";
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const body: Record<string, unknown> = {
      details: productDetailsPayload(draft, product.details),
    };
    if (product.custom) {
      body.title = title.trim();
      body.titleEn = titleEn.trim();
      body.catId = catId;
      body.description = draft.description;
      body.descriptionEn = draft.descriptionEn;
      if (pendingImages !== null) {
        body.replaceImages = true;
        body.imagesData = pendingImages.map((image) => image.data);
      }
    }
    const result = await api.patch(`/api/admin/products/${encodeURIComponent(product.id)}`, body);
    setBusy(false);
    if (!result.ok) {
      setMessage(`Η αποθήκευση απέτυχε (${result.error || result.status}).`);
      return;
    }
    setMessage("Το περιεχόμενο αποθηκεύτηκε.");
    setPendingImages(null);
    onSaved();
  }

  const currentImages = product.images?.length ? product.images : product.image ? [product.image] : [];
  const displayedImages = pendingImages === null
    ? currentImages.map((url) => ({ name: "Αποθηκευμένη εικόνα", data: mediaUrl(url) }))
    : pendingImages;

  return (
    <form className="content-panel" onSubmit={save}>
      <div className="content-panel__heading">
        <div><h3>Περιεχόμενο προϊόντος</h3><p className="muted">Badges, χαρακτηριστικά, φίλτρο χρώματος και δίγλωσσες λεπτομέρειες.</p></div>
        <button className="btn btn--small btn--primary" type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση περιεχομένου"}</button>
      </div>

      {product.custom ? (
        <fieldset className="content-section">
          <legend>Βασικά στοιχεία custom προϊόντος</legend>
          <div className="content-grid">
            <label className="field"><span>Κατηγορία</span><select value={catId} onChange={(event) => setCatId(event.target.value)}>{Object.entries(CATEGORIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label className="field"><span>Τίτλος (EL)</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required /></label>
            <label className="field"><span>Τίτλος (EN)</span><input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} maxLength={160} /></label>
          </div>
          <div className="content-images">
            <label className="field"><span>Αντικατάσταση φωτογραφιών (έως {MAX_IMAGES})</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={chooseImages} /></label>
            {displayedImages.length ? <div className="npthumbs">{displayedImages.map((image, index) => <div className="npthumb" key={`${image.name}-${index}`}><img src={image.data} alt={`${image.name} ${index + 1}`} />{pendingImages !== null ? <button type="button" aria-label={`Αφαίρεση εικόνας ${index + 1}`} onClick={() => setPendingImages(pendingImages.filter((_, itemIndex) => itemIndex !== index))}>×</button> : null}</div>)}</div> : <span className="muted">Δεν υπάρχουν φωτογραφίες.</span>}
            <div className="content-image-actions">
              {pendingImages !== null ? <button className="btn btn--small btn--ghost" type="button" onClick={() => setPendingImages(null)}>Ακύρωση αλλαγής φωτογραφιών</button> : null}
              {displayedImages.length ? <button className="btn btn--small" type="button" onClick={() => setPendingImages([])}>Αφαίρεση όλων</button> : null}
            </div>
          </div>
        </fieldset>
      ) : null}

      <ProductContentFields value={draft} onChange={setDraft} />
      <div className="content-panel__footer">
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση περιεχομένου"}</button>
        {message ? <span className={message.includes("απέτυχε") ? "error" : "muted"} role="status">{message}</span> : null}
      </div>
    </form>
  );
}
