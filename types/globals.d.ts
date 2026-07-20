// Ambient declarations so type-checking the legacy browser JS stays low-noise.
// The storefront hangs its modules off window.Nostalgia* — allow any property on
// window/globalThis instead of erroring on each one. Tighten per-module later.

interface Window {
  [key: string]: any;
}

// A few globals the legacy scripts reference directly (not via window.*).
declare var grecaptcha: any;
declare var google: any;
declare var Stripe: any;
