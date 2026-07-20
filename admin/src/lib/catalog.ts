/* Static catalog reference data mirrored from the server (server/catalog.js)
   and the color-family palette (js/products.js COLOR_FAMILIES). Keep in sync. */

export const CATEGORIES: Record<string, string> = {
  cat1: "Art Class Murano Candle",
  cat2: "Driftwood Beeswax Flame",
  cat3: "Liquid Eternal",
  cat4: "Vintage Unique Objects",
  cat5: "NI Terra",
  cat6: "Perfume",
  cat7: "Diffusers",
  cat8: "Gift Sets",
  cat9: "Nostalgia Exclusive Mirror Candles",
};

export interface ColorFamily {
  id: string;
  label: string;
  labelEn: string;
  hex: string;
}

export const COLOR_FAMILIES: ColorFamily[] = [
  { id: "white", label: "Λευκό", labelEn: "White", hex: "#f4f1ea" },
  { id: "cream", label: "Εκρού", labelEn: "Cream", hex: "#efe6d3" },
  { id: "beige", label: "Μπεζ", labelEn: "Beige", hex: "#d9c7a8" },
  { id: "taupe", label: "Ταμπά", labelEn: "Taupe", hex: "#b79b82" },
  { id: "brown", label: "Καφέ", labelEn: "Brown", hex: "#6b4a2f" },
  { id: "copper", label: "Χάλκινο", labelEn: "Copper", hex: "#a55a33" },
  { id: "bronze", label: "Μπρούτζινο", labelEn: "Bronze", hex: "#7d6033" },
  { id: "gold", label: "Χρυσό", labelEn: "Gold", hex: "#c9a24a" },
  { id: "rosegold", label: "Ροζ Χρυσό", labelEn: "Rose Gold", hex: "#d9a6a0" },
  { id: "silver", label: "Ασημί", labelEn: "Silver", hex: "#c3c6c9" },
  { id: "yellow", label: "Κίτρινο", labelEn: "Yellow", hex: "#e3c65b" },
  { id: "orange", label: "Πορτοκαλί", labelEn: "Orange", hex: "#d98a4a" },
  { id: "coral", label: "Κοραλί", labelEn: "Coral", hex: "#e5735a" },
  { id: "red", label: "Κόκκινο", labelEn: "Red", hex: "#b0342c" },
  { id: "bordeaux", label: "Μπορντό", labelEn: "Bordeaux", hex: "#6e2233" },
  { id: "pink", label: "Ροζ", labelEn: "Pink", hex: "#e2a7bd" },
  { id: "fuchsia", label: "Φούξια", labelEn: "Fuchsia", hex: "#d43d7d" },
  { id: "purple", label: "Μωβ", labelEn: "Purple", hex: "#6b4a7a" },
  { id: "lilac", label: "Λιλά", labelEn: "Lilac", hex: "#b98fd0" },
  { id: "navy", label: "Navy Μπλε", labelEn: "Navy Blue", hex: "#1f3a5f" },
  { id: "blue", label: "Μπλε", labelEn: "Blue", hex: "#3a5a8c" },
  { id: "lightblue", label: "Γαλάζιο", labelEn: "Light Blue", hex: "#a9cbe0" },
  { id: "turquoise", label: "Τιρκουάζ", labelEn: "Turquoise", hex: "#3fc1c9" },
  { id: "petrol", label: "Πετρόλ", labelEn: "Petrol", hex: "#1a6b74" },
  { id: "green", label: "Πράσινο", labelEn: "Green", hex: "#4a7a4e" },
  { id: "black", label: "Μαύρο", labelEn: "Black", hex: "#2b2b2b" },
  { id: "multi", label: "Πολύχρωμο", labelEn: "Multicolor", hex: "#8d6c9f" },
  { id: "transparent", label: "Διάφανο", labelEn: "Transparent", hex: "#d8e1e6" },
];
