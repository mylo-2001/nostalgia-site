"use strict";

/**
 * Product image uploads via Cloudinary (CDN).
 * When CLOUDINARY_* env vars are set, new admin uploads go to Cloudinary
 * instead of images/product photo/uploads/ — only the URL is stored in PostgreSQL.
 */

const cloudinary = require("cloudinary").v2;

const FOLDER = "nostalgia/products";
let ready = false;

function configured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function ensureConfig() {
  if (!configured()) return false;
  if (!ready) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    ready = true;
  }
  return true;
}

function publicIdForProduct(id) {
  return FOLDER + "/" + String(id || "").replace(/[^\w-]/g, "");
}

function isCloudinaryUrl(url) {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(String(url || ""));
}

/* Cap delivery at 1200px wide. Without a width Cloudinary serves the original
   upload, so a 3000px studio photo was being sent to a 300px product card.
   c_limit only shrinks — a smaller upload is never upscaled — and the aspect
   ratio is preserved, so nothing is cropped. 1200 still covers the largest
   place a product photo is shown (the product page on a retina screen). */
function deliveryUrl(publicId) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 1200, crop: "limit" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
}

/**
 * Upload a data-URL image. Returns HTTPS URL for storage in DB.
 */
async function uploadProductImage(productId, dataUrl) {
  if (!ensureConfig()) return null;
  const publicId = publicIdForProduct(productId);
  const result = await cloudinary.uploader.upload(String(dataUrl), {
    folder: FOLDER,
    public_id: productId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
  });
  return deliveryUrl(result.public_id || publicId);
}

/** Remove asset from Cloudinary (ignore if missing). */
async function deleteProductImage(productId, imageUrl) {
  if (!ensureConfig()) return;
  if (!isCloudinaryUrl(imageUrl) && !productId) return;
  try {
    await cloudinary.uploader.destroy(publicIdForProduct(productId), {
      resource_type: "image",
      invalidate: true,
    });
  } catch (e) {
    console.warn("[cloudinary] delete failed for " + productId + ":", e.message);
  }
}

module.exports = {
  configured,
  isCloudinaryUrl,
  uploadProductImage,
  deleteProductImage,
};
