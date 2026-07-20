import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { COLOR_FAMILIES } from "../lib/catalog";
import type { AdminProduct, AdminVariant } from "../types/product";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface PendingImage {
  name: string;
  data: string;
}

function mediaUrl(value: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  return "/" + value.replace(/^\/+/, "");
}

function valueOf(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function errorMessage(error: unknown, status: number): string {
  const messages: Record<string, string> = {
    missing_color: "Συμπλήρωσε το χρώμα.",
    variant_color_exists: "Αυτό το προϊόν έχει ήδη παραλλαγή με το ίδιο χρώμα.",
    missing_sku: "Συμπλήρωσε το SKU.",
    variant_sku_exists: "Αυτό το SKU χρησιμοποιείται ήδη σε άλλη παραλλαγή.",
    missing_price: "Συμπλήρωσε την τιμή της παραλλαγής.",
    invalid_price: "Η τιμή δεν είναι έγκυρη.",
    invalid_sale_price: "Η τιμή έκπτωσης πρέπει να είναι μικρότερη από την κανονική τιμή.",
    invalid_sale_days: "Η διάρκεια έκπτωσης δεν είναι έγκυρη.",
    missing_stock: "Συμπλήρωσε το απόθεμα της παραλλαγής.",
    invalid_stock: "Το απόθεμα πρέπει να είναι ακέραιος αριθμός από 0 έως 9999.",
    invalid_color_hex: "Το χρώμα swatch δεν είναι έγκυρο.",
    invalid_image: "Οι εικόνες πρέπει να είναι PNG, JPG, WEBP ή GIF, έως 10 MB η καθεμία.",
    not_found: "Η παραλλαγή δεν βρέθηκε. Ανανέωσε τη σελίδα.",
  };
  return messages[String(error || "")] || `Η ενέργεια απέτυχε (${status}).`;
}

function familyFor(variant: AdminVariant): string {
  const color = (variant.color || "").trim().toLocaleLowerCase("el");
  const hex = (variant.colorHex || "").trim().toLowerCase();
  return COLOR_FAMILIES.find((family) =>
    family.label.toLocaleLowerCase("el") === color || family.hex.toLowerCase() === hex
  )?.id || "";
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
  const out: PendingImage[] = [];
  for (const file of selected) {
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      throw new Error("invalid_image");
    }
    out.push({ name: file.name, data: await readFileAsDataUrl(file) });
  }
  return out;
}

function ColorFields({
  familyId,
  color,
  colorEn,
  colorHex,
  onFamily,
  onColor,
  onColorEn,
  onColorHex,
}: {
  familyId: string;
  color: string;
  colorEn: string;
  colorHex: string;
  onFamily: (id: string) => void;
  onColor: (value: string) => void;
  onColorEn: (value: string) => void;
  onColorHex: (value: string) => void;
}) {
  return (
    <>
      <label className="field"><span>Έτοιμο χρώμα</span>
        <select value={familyId} onChange={(event) => onFamily(event.target.value)}>
          <option value="">Προσαρμοσμένο</option>
          {COLOR_FAMILIES.map((family) => (
            <option key={family.id} value={family.id}>{family.label}</option>
          ))}
        </select>
      </label>
      <label className="field"><span>Χρώμα (EL)</span>
        <input value={color} onChange={(event) => onColor(event.target.value)} maxLength={80} required />
      </label>
      <label className="field"><span>Χρώμα (EN)</span>
        <input value={colorEn} onChange={(event) => onColorEn(event.target.value)} maxLength={80} />
      </label>
      <label className="field"><span>Swatch</span>
        <span className="variant-color-input">
          <input type="color" value={colorHex || "#c9a24a"} onChange={(event) => onColorHex(event.target.value)} aria-label="Χρώμα swatch" />
          <input value={colorHex} onChange={(event) => onColorHex(event.target.value)} pattern="^#[0-9A-Fa-f]{6}$" placeholder="#c9a24a" maxLength={7} />
        </span>
      </label>
    </>
  );
}

function ImagePicker({
  current,
  pending,
  onPending,
}: {
  current: string[];
  pending: PendingImage[] | null;
  onPending: (images: PendingImage[] | null) => void;
}) {
  const displayed = pending === null
    ? current.map((url) => ({ name: "Αποθηκευμένη εικόνα", data: mediaUrl(url) }))
    : pending;

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      onPending(await readImages(event.target.files));
    } catch (error) {
      window.alert(error instanceof Error && error.message === "too_many_images"
        ? `Μπορείς να επιλέξεις έως ${MAX_IMAGES} εικόνες.`
        : "Κάθε εικόνα πρέπει να είναι αρχείο εικόνας έως 10 MB.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="variant-images">
      <label className="field"><span>Φωτογραφίες χρώματος (έως {MAX_IMAGES})</span>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={choose} />
      </label>
      {displayed.length ? (
        <div className="npthumbs">
          {displayed.map((image, index) => (
            <div className="npthumb" key={`${image.name}-${index}`}>
              <img src={image.data} alt={`${image.name} ${index + 1}`} />
              {pending !== null ? (
                <button type="button" aria-label={`Αφαίρεση εικόνας ${index + 1}`} onClick={() => onPending(pending.filter((_, i) => i !== index))}>×</button>
              ) : null}
            </div>
          ))}
        </div>
      ) : <span className="muted">Δεν έχουν οριστεί ξεχωριστές φωτογραφίες.</span>}
      {current.length || (pending && pending.length) ? (
        <div className="variant-images__actions">
          {current.length && pending !== null ? <button type="button" className="btn btn--small btn--ghost" onClick={() => onPending(null)}>Ακύρωση αλλαγής</button> : null}
          {(current.length || (pending && pending.length)) ? <button type="button" className="btn btn--small" onClick={() => onPending([])}>Αφαίρεση όλων</button> : null}
        </div>
      ) : null}
      {current.length && pending !== null ? <span className="muted">Οι νέες φωτογραφίες θα αντικαταστήσουν τις αποθηκευμένες.</span> : null}
    </div>
  );
}

function VariantEditor({ variant, onChanged }: { variant: AdminVariant; onChanged: () => void }) {
  const [familyId, setFamilyId] = useState(() => familyFor(variant));
  const [color, setColor] = useState(variant.color || "");
  const [colorEn, setColorEn] = useState(variant.colorEn || "");
  const [colorHex, setColorHex] = useState(variant.colorHex || "#c9a24a");
  const [sku, setSku] = useState(variant.sku || "");
  const [price, setPrice] = useState(valueOf(variant.price));
  const [salePrice, setSalePrice] = useState(valueOf(variant.salePrice));
  const [saleDays, setSaleDays] = useState("");
  const [stock, setStock] = useState(valueOf(variant.stock));
  const [available, setAvailable] = useState(variant.available !== false);
  const [pendingImages, setPendingImages] = useState<PendingImage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFamilyId(familyFor(variant));
    setColor(variant.color || "");
    setColorEn(variant.colorEn || "");
    setColorHex(variant.colorHex || "#c9a24a");
    setSku(variant.sku || "");
    setPrice(valueOf(variant.price));
    setSalePrice(valueOf(variant.salePrice));
    setStock(valueOf(variant.stock));
    setAvailable(variant.available !== false);
    setPendingImages(null);
  }, [variant]);

  function chooseFamily(id: string) {
    setFamilyId(id);
    const family = COLOR_FAMILIES.find((item) => item.id === id);
    if (!family) return;
    setColor(family.label);
    setColorEn(family.labelEn);
    setColorHex(family.hex);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const body: Record<string, unknown> = {
      color: color.trim(),
      colorEn: colorEn.trim(),
      colorHex,
      sku: sku.trim(),
      price,
      salePrice,
      stock,
      available,
    };
    if (saleDays !== "") body.saleDays = saleDays;
    if (pendingImages !== null) {
      body.replaceImages = true;
      body.imagesData = pendingImages.map((image) => image.data);
    }
    const result = await api.patch(`/api/admin/variants/${encodeURIComponent(variant.id)}`, body);
    setBusy(false);
    if (!result.ok) {
      setMessage(errorMessage(result.error, result.status));
      return;
    }
    setMessage("Η παραλλαγή αποθηκεύτηκε.");
    setSaleDays("");
    setPendingImages(null);
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Οριστική διαγραφή της παραλλαγής «${variant.color || variant.id}»;`)) return;
    setBusy(true);
    setMessage("");
    const result = await api.del(`/api/admin/variants/${encodeURIComponent(variant.id)}`);
    setBusy(false);
    if (!result.ok) {
      setMessage(errorMessage(result.error, result.status));
      return;
    }
    onChanged();
  }

  return (
    <form className="variant-card" onSubmit={save}>
      <div className="variant-card__heading">
        <span className="variant-swatch" style={{ backgroundColor: colorHex || "#d9d4ca" }} aria-hidden="true" />
        <div><strong>{color || "Χωρίς χρώμα"}</strong><span className="muted">{variant.id}</span></div>
        <span className={`obadge ${available ? "" : "obadge--red"}`}>{available ? "Ενεργή" : "Ανενεργή"}</span>
      </div>
      <div className="variant-grid">
        <ColorFields familyId={familyId} color={color} colorEn={colorEn} colorHex={colorHex}
          onFamily={chooseFamily} onColor={setColor} onColorEn={setColorEn} onColorHex={setColorHex} />
        <label className="field"><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} maxLength={80} required /></label>
        <label className="field"><span>Τιμή (€)</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
        <label className="field"><span>Τιμή έκπτωσης (€)</span><input type="number" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder="Χωρίς έκπτωση" /></label>
        <label className="field"><span>Νέα διάρκεια έκπτωσης</span><input type="number" min="1" max="3650" value={saleDays} onChange={(event) => setSaleDays(event.target.value)} placeholder={variant.saleUntil ? `Λήγει ${new Date(variant.saleUntil).toLocaleDateString("el-GR")}` : "Χωρίς λήξη"} /></label>
        <label className="field"><span>Απόθεμα</span><input type="number" min="0" max="9999" step="1" value={stock} onChange={(event) => setStock(event.target.value)} required /></label>
      </div>
      <ImagePicker current={variant.images || []} pending={pendingImages} onPending={setPendingImages} />
      <div className="variant-card__footer">
        <label className="variant-check"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Διαθέσιμη στο κατάστημα</label>
        <div className="variant-card__buttons">
          <button className="btn btn--small btn--primary" type="submit" disabled={busy}>{busy ? "Αποθήκευση…" : "Αποθήκευση"}</button>
          <button className="btn btn--small" type="button" disabled={busy} onClick={remove}>Διαγραφή</button>
        </div>
      </div>
      {message ? <p className="variant-message" role="status">{message}</p> : null}
    </form>
  );
}

function NewVariant({ product, onCreated }: { product: AdminProduct; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [familyId, setFamilyId] = useState("");
  const [color, setColor] = useState("");
  const [colorEn, setColorEn] = useState("");
  const [colorHex, setColorHex] = useState("#c9a24a");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDays, setSaleDays] = useState("");
  const [stock, setStock] = useState("");
  const [available, setAvailable] = useState(true);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function chooseFamily(id: string) {
    setFamilyId(id);
    const family = COLOR_FAMILIES.find((item) => item.id === id);
    if (!family) return;
    setColor(family.label);
    setColorEn(family.labelEn);
    setColorHex(family.hex);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = await api.post(`/api/admin/products/${encodeURIComponent(product.id)}/variants`, {
      color: color.trim(),
      colorEn: colorEn.trim(),
      colorHex,
      sku: sku.trim(),
      price,
      salePrice,
      saleDays,
      stock,
      available,
      imagesData: images.map((image) => image.data),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(errorMessage(result.error, result.status));
      return;
    }
    setFamilyId("");
    setColor("");
    setColorEn("");
    setColorHex("#c9a24a");
    setSku("");
    setPrice("");
    setSalePrice("");
    setSaleDays("");
    setStock("");
    setAvailable(true);
    setImages([]);
    setMessage("Η νέα παραλλαγή προστέθηκε.");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return <button className="btn btn--small btn--primary" type="button" onClick={() => setOpen(true)}>Προσθήκη παραλλαγής</button>;
  }

  return (
    <form className="variant-card variant-card--new" onSubmit={submit}>
      <div className="variant-card__heading"><strong>Νέα χρωματική παραλλαγή</strong></div>
      <div className="variant-grid">
        <ColorFields familyId={familyId} color={color} colorEn={colorEn} colorHex={colorHex}
          onFamily={chooseFamily} onColor={setColor} onColorEn={setColorEn} onColorHex={setColorHex} />
        <label className="field"><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} maxLength={80} required /></label>
        <label className="field"><span>Τιμή (€)</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
        <label className="field"><span>Τιμή έκπτωσης (€)</span><input type="number" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder="Χωρίς έκπτωση" /></label>
        <label className="field"><span>Διάρκεια έκπτωσης</span><input type="number" min="1" max="3650" value={saleDays} onChange={(event) => setSaleDays(event.target.value)} placeholder="Χωρίς λήξη" /></label>
        <label className="field"><span>Απόθεμα</span><input type="number" min="0" max="9999" step="1" value={stock} onChange={(event) => setStock(event.target.value)} required /></label>
      </div>
      <ImagePicker current={[]} pending={images} onPending={(next) => setImages(next || [])} />
      <div className="variant-card__footer">
        <label className="variant-check"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Διαθέσιμη στο κατάστημα</label>
        <div className="variant-card__buttons">
          <button className="btn btn--small btn--primary" type="submit" disabled={busy}>{busy ? "Προσθήκη…" : "Προσθήκη"}</button>
          <button className="btn btn--small btn--ghost" type="button" disabled={busy} onClick={() => { setOpen(false); setMessage(""); }}>Ακύρωση</button>
        </div>
      </div>
      {message ? <p className="variant-message" role="alert">{message}</p> : null}
    </form>
  );
}

export function ProductVariants({ product, onChanged }: { product: AdminProduct; onChanged: () => void }) {
  const variants = useMemo(() => product.variants || [], [product.variants]);
  return (
    <section className="variant-panel" aria-label={`Παραλλαγές προϊόντος ${product.title}`}>
      <div className="variant-panel__top">
        <div>
          <h3>Χρώματα προϊόντος</h3>
          <p className="muted">Κάθε χρώμα έχει δικό του SKU, τιμή, απόθεμα και φωτογραφίες.</p>
        </div>
        <NewVariant product={product} onCreated={onChanged} />
      </div>
      {variants.length ? (
        <div className="variant-list">
          {variants.map((variant) => <VariantEditor key={variant.id} variant={variant} onChanged={onChanged} />)}
        </div>
      ) : <p className="empty variant-empty">Δεν υπάρχουν παραλλαγές ακόμη.</p>}
    </section>
  );
}
