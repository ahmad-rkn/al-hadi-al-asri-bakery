/* =========================================================================
   AL HADI AL ASRI BAKERY — SITE CONFIGURATION
   =========================================================================
   This is the ONLY file you should need to edit to run your own bakery.

   1. Fill in the BAKERY INFO section below with real details.
   2. Edit the PRODUCTS list to match your real menu, prices and photos.
   3. Save the file and refresh the website — that's it, no other files
      need to change.
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. BAKERY INFO
   Replace every "REPLACE_ME" with your real information.
   ------------------------------------------------------------------------- */
const BAKERY_INFO = {
  // WhatsApp number the order button will message.
  // Use the FULL international format, digits only, no "+", no spaces,
  // no dashes. Example for Lebanon: "9611234567"
  BAKERY_WHATSAPP_NUMBER: "96178715548",

  // Phone number. Kept here as your single source of truth in case you
  // need it elsewhere (e.g. printed materials) — it is intentionally NOT
  // shown as its own Contact card on the site; TikTok is shown instead.
  BAKERY_PHONE: "961715548",

  // Full street address shown on the Contact section.
  BAKERY_ADDRESS: "طريق سلعا, Chehabiyeh",

  // Instagram handle WITHOUT the @, e.g. "alhadialasri"
  BAKERY_INSTAGRAM: "al_hady_bakery",

  // TikTok handle WITHOUT the @, e.g. "alhadialasri"
  BAKERY_TIKTOK: "al_hady_al_asri_bakery",

  // A Google Maps link to your exact location.
  // Easiest way: open Google Maps, find your bakery, press "Share",
  // then "Copy link", and paste it here.
  GOOGLE_MAPS_URL: "https://maps.app.goo.gl/FZFHdh2ymjj8imo1A",

  // Opening hours, shown exactly as typed. You can use line breaks with "\n".
  OPENING_HOURS: "7AM-9PM",
};

// Logo images for the Contact section and footer social icons.
// Drop the image files into the "images" folder and point each path at
// the file — nothing else in the code needs to change. Until a real file
// exists at a path, that icon automatically falls back to a plain emoji
// so the layout never breaks.
const SOCIAL_LOGOS = {
  INSTAGRAM: "images/instagram-logo.png",
  TIKTOK: "images/tiktok-logo.png",
  WHATSAPP: "images/whatsapp-logo.png",
};

// Flat fee added automatically to the order total when a customer chooses
// Delivery at checkout. Set to 0 to disable the fee entirely. Pickup
// orders are never charged this fee.
const DELIVERY_FEE = 1.0;

/* -------------------------------------------------------------------------
   2. PRODUCTS
   Every product needs:
     id          - short unique code, no spaces (used internally)
     name        - shown to the customer
     category    - one of: "croissants", "donuts", "crepes", "pancakes", "buns"
     price       - a number, e.g. 3.50  (shown as $3.50)
     description - one short sentence
     image       - path to a photo, e.g. "images/kinder-donut.jpg"
                   Leave this as an empty string "" to use the automatic
                   placeholder icon instead — perfect until you have real
                   photos, and safe to leave that way indefinitely.
     icon        - an emoji used for the placeholder tile when there is
                   no image, and as a small category marker
     available   - true = customers can order it, false = shown as Sold Out
                   and cannot be added to the cart.

   NOTE ON THE ADMIN PANEL / SUPABASE (optional):
   This list is the built-in, offline fallback menu — the site works fine
   with just this file, exactly as before. If you've set up the Supabase
   admin panel (see /admin and SUPABASE_SETUP.md), js/supabase-data.js
   will replace this array with the live data from your database right
   after the page loads, including prices and Sold Out status. If Supabase
   isn't configured, or the request fails (e.g. offline), the site simply
   keeps using this list — nothing breaks either way.

   To add a new product by hand, copy one block below, change the id, and
   fill in the new details. Nothing else in the website needs to change.
   ------------------------------------------------------------------------- */
let PRODUCTS = [
  // ---------------- Special Offer 🎉 ----------------
  // This is a normal product just like everything else below — it goes
  // through the same cart, checkout and WhatsApp flow. Its category
  // ("offer") is intentionally NOT listed in CATEGORIES further down, so
  // it never shows up as a regular menu tile; it's rendered as its own
  // poster on the homepage instead (see renderSpecialOffer() in app.js).
  //
  // To change the promo image later, just replace the file and update
  // this one "image" path below — nothing else needs to change.
  {
    id: "special-offer",
    name: "Special Offer",
    category: "offer",
    price: 10,
    description: "1 Lotus Crepe + 1 Kinder Crepe + 18 Pancakes",
    image: "", // e.g. "images/special-offer.jpg" — leave "" for the placeholder
    icon: "🎉",
    available: true,
  },

  // ---------------- Croissants 🥐 ----------------
  {
    id: "croissant-chocolate",
    name: "Chocolate Croissant",
    category: "croissants",
    price: 2.50,
    description: "Buttery, flaky croissant filled with rich dark chocolate.",
    image: "",
    icon: "🥐",
    available: true,
  },
  {
    id: "croissant-kinder",
    name: "Kinder Croissant",
    category: "croissants",
    price: 3.00,
    description: "Warm croissant stuffed with creamy Kinder chocolate.",
    image: "",
    icon: "🥐",
    available: true,
  },
  {
    id: "croissant-lotus",
    name: "Lotus Croissant",
    category: "croissants",
    price: 3.00,
    description: "Flaky croissant filled with caramelized Lotus spread.",
    image: "",
    icon: "🥐",
    available: true,
  },
  {
    id: "croissant-oreo",
    name: "Oreo Croissant",
    category: "croissants",
    price: 3.00,
    description: "Golden croissant packed with crushed Oreo cream.",
    image: "",
    icon: "🥐",
    available: true,
  },

  // ---------------- Donuts 🍩 ----------------
  {
    id: "donut-chocolate",
    name: "Chocolate Donut",
    category: "donuts",
    price: 2.00,
    description: "Soft donut glazed with smooth chocolate ganache.",
    image: "",
    icon: "🍩",
    available: true,
  },
  {
    id: "donut-kinder",
    name: "Kinder Donut",
    category: "donuts",
    price: 2.75,
    description: "Fluffy donut topped and filled with Kinder chocolate.",
    image: "",
    icon: "🍩",
    available: true,
  },
  {
    id: "donut-lotus",
    name: "Lotus Donut",
    category: "donuts",
    price: 2.75,
    description: "Pillowy donut layered with Lotus biscuit crumble.",
    image: "",
    icon: "🍩",
    available: true,
  },
  {
    id: "donut-oreo",
    name: "Oreo Donut",
    category: "donuts",
    price: 2.75,
    description: "Classic donut dressed with Oreo cream and crumbs.",
    image: "",
    icon: "🍩",
    available: true,
  },

  // ---------------- Crepes 🥞 ----------------
  {
    id: "crepe-kinder",
    name: "Kinder Crepe",
    category: "crepes",
    price: 4.50,
    description: "Thin, warm crepe rolled with melted Kinder chocolate.",
    image: "",
    icon: "🥞",
    available: true,
  },
  {
    id: "crepe-lotus",
    name: "Lotus Crepe",
    category: "crepes",
    price: 4.50,
    description: "Soft crepe drizzled with Lotus caramel sauce.",
    image: "",
    icon: "🥞",
    available: true,
  },
  {
    id: "crepe-oreo",
    name: "Oreo Crepe",
    category: "crepes",
    price: 4.50,
    description: "Folded crepe filled with cream and crushed Oreo.",
    image: "",
    icon: "🥞",
    available: true,
  },

  // ---------------- Pancakes 🥞 ----------------
  {
    id: "pancake-classic",
    name: "Classic Pancakes",
    category: "pancakes",
    price: 4.00,
    description: "A stack of fluffy pancakes with maple syrup.",
    image: "",
    icon: "🥞",
    available: true,
  },
  {
    id: "pancake-nutella",
    name: "Nutella Pancakes",
    category: "pancakes",
    price: 4.75,
    description: "Fluffy pancake stack layered with Nutella.",
    image: "",
    icon: "🥞",
    available: true,
  },

  // ---------------- Buns 🥖 ----------------
  {
    id: "bun-cinnamon",
    name: "Cinnamon Bun",
    category: "buns",
    price: 3.25,
    description: "Soft swirled bun with cinnamon sugar and glaze.",
    image: "",
    icon: "🥖",
    available: true,
  },
  {
    id: "bun-cheese",
    name: "Cheese Bun",
    category: "buns",
    price: 2.50,
    description: "Warm, soft bun baked with a savory cheese filling.",
    image: "",
    icon: "🥖",
    available: true,
  },
];

/* -------------------------------------------------------------------------
   3. CATEGORY LABELS
   Controls the order and display names of menu tabs/sections.
   ------------------------------------------------------------------------- */
const CATEGORIES = [
  { id: "croissants", label: "Croissants", icon: "🥐" },
  { id: "donuts", label: "Donuts", icon: "🍩" },
  { id: "crepes", label: "Crepes", icon: "🥞" },
  { id: "pancakes", label: "Pancakes", icon: "🥞" },
  { id: "buns", label: "Buns", icon: "🥖" },
];
