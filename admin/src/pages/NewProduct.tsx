import { useState } from "react";
import { api } from "../api/client";
import {
  emptyProductContent,
  ProductContentFields,
  productDetailsPayload,
} from "../components/ProductContentEditor";
import { CATEGORIES } from "../lib/catalog";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function NewProduct() {
  const [catId, setCatId] = useState("cat1");
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDays, setSaleDays] = useState("");
  const [stock, setStock] = useState("");
  const [content, setContent] = useState(emptyProductContent);
  const [images, setImages] = useState<{ name: string; data: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [publish, setPublish] = useState(true);
  const [sendMarketingEmail, setSendMarketingEmail] = useState(true);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > MAX_IMAGES) {
      setMsg(`Μπορείς να ανεβάσεις έως ${MAX_IMAGES} εικόνες.`);
      e.target.value = "";
      return;
    }
    const out: { name: string; data: string }[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/") || f.size > MAX_IMAGE_BYTES) {
        setMsg("Κάθε εικόνα πρέπει να είναι αρχείο εικόνας έως 10 MB.");
        e.target.value = "";
        return;
      }
      out.push({ name: f.name, data: await readFileAsDataURL(f) });
    }
    setImages((prev) => [...prev, ...out]);
    setMsg("");
    e.target.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const res = await api.post("/api/admin/products", {
      catId, title, titleEn, price,
      salePrice: salePrice || "",
      saleDays: saleDays || "",
      stock: stock || "",
      description: content.description,
      descriptionEn: content.descriptionEn,
      imagesData: images.map((i) => i.data),
      details: productDetailsPayload(content),
      publish,
      sendMarketingEmail: publish && sendMarketingEmail,
      audienceType: "newsletter",
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Το προϊόν δημιουργήθηκε (#" + ((res.product as { id?: string })?.id ?? "") + ").");
      setTitle(""); setTitleEn(""); setPrice(""); setSalePrice(""); setSaleDays("");
      setStock(""); setContent(emptyProductContent()); setImages([]);
    } else {
      setMsg("Σφάλμα: " + (res.error || res.status));
    }
  }

  return (
    <div>
      <h2 className="main__title">Νέο προϊόν</h2>
      <form onSubmit={submit} className="npform">
        <div className="npgrid">
          <label className="field"><span>Κατηγορία</span>
            <select value={catId} onChange={(e) => setCatId(e.target.value)}>
              {Object.entries(CATEGORIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="field"><span>Τίτλος (EL)</span><input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label className="field"><span>Τίτλος (EN)</span><input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} /></label>
          <label className="field"><span>Τιμή (€)</span><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></label>
          <label className="field"><span>Τιμή έκπτωσης (€)</span><input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="χωρίς" /></label>
          <label className="field"><span>Διάρκεια έκπτωσης (μέρες)</span><input type="number" min="1" value={saleDays} onChange={(e) => setSaleDays(e.target.value)} placeholder="χωρίς λήξη" /></label>
          <label className="field"><span>Απόθεμα</span><input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="απεριόριστο" /></label>
        </div>

        <ProductContentFields value={content} onChange={setContent} />

        <label className="field"><span>Εικόνες (έως {MAX_IMAGES})</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={onFiles} />
        </label>
        {images.length > 0 && (
          <div className="npthumbs">
            {images.map((im, i) => (
              <div className="npthumb" key={i}>
                <img src={im.data} alt={im.name} />
                <button type="button" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} style={{ width: "auto" }} /><span>Κατάσταση: Δημοσιευμένο</span></label>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><input type="checkbox" checked={sendMarketingEmail} onChange={(e) => setSendMarketingEmail(e.target.checked)} style={{ width: "auto" }} /><span>Ενημέρωση συνδρομητών με email</span></label>
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Δημιουργία…" : "Δημιουργία προϊόντος"}</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
