/* =========================================================================
   SUPABASE DATA LOADER (optional — admin panel backend)
   =========================================================================
   You should not need to edit this file.

   What this does, in order:
   1. If Supabase isn't configured (js/supabase-config.js is empty), or the
      Supabase library failed to load, or the network request fails for any
      reason — this quietly does nothing, and the site keeps using the
      built-in menu from js/config.js. The site NEVER breaks because of
      this file.
   2. Otherwise, it fetches the live products + the current active special
      offer from your Supabase database, reshapes them into the exact same
      object shape js/config.js already uses, and replaces the global
      PRODUCTS array with them.
   3. It then calls window.__bakeryRerender() (exposed by js/app.js) to
      redraw the menu, the special offer poster, and the cart with the
      fresh data — including each product's Available / Sold Out status.

   This runs once when the page loads. The admin panel (admin/admin.js) is
   a completely separate page — this file never writes to the database,
   only reads from it.
   ========================================================================= */
(function () {
  "use strict";

  const SUPABASE_URL = window.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";

  function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  /* -----------------------------------------------------------------------
     Pure mapping helpers (no DOM, no network) — kept separate from
     loadFromSupabase() so they can be unit-tested directly.
     ----------------------------------------------------------------------- */
  function mapProductRow(row) {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      description: row.description || "",
      image: row.image || "",
      icon: row.icon || "🥐",
      available: row.available !== false,
    };
  }

  function mapOfferRow(row) {
    return {
      // Fixed id on purpose: the existing poster/cart/checkout code looks
      // up the special offer by this exact id (see renderSpecialOffer() in
      // js/app.js). Keeping it fixed means none of that code has to know
      // Supabase exists, no matter what the row's real database id is.
      id: "special-offer",
      name: row.title || "Special Offer",
      category: "offer",
      price: Number(row.price),
      description: row.description || "",
      image: row.image || "",
      icon: row.icon || "🎉",
      available: true,
    };
  }

  // Replaces the global PRODUCTS (declared with `let` in js/config.js) with
  // freshly mapped rows from the database. Exported for tests.
  function buildProductList(dbProducts, dbOffer) {
    const mapped = (dbProducts || []).map(mapProductRow);
    if (dbOffer) mapped.unshift(mapOfferRow(dbOffer));
    return mapped;
  }

  /* -----------------------------------------------------------------------
     Load + merge
     ----------------------------------------------------------------------- */
  async function loadFromSupabase() {
    if (!isConfigured()) return; // Supabase not set up — nothing to do

    if (typeof supabase === "undefined" || !supabase.createClient) {
      console.warn("[supabase-data] Supabase library didn't load — using the built-in menu from js/config.js.");
      return;
    }

    try {
      const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const [productsRes, offersRes] = await Promise.all([
        client.from("products").select("*").order("sort_order", { ascending: true }),
        client
          .from("special_offers")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (offersRes.error) throw offersRes.error;

      if (!productsRes.data || !productsRes.data.length) {
        console.warn("[supabase-data] Supabase returned no products — keeping the built-in menu.");
        return;
      }

      PRODUCTS = buildProductList(productsRes.data, offersRes.data && offersRes.data[0]);

      if (typeof window.__bakeryRerender === "function") {
        window.__bakeryRerender();
      }
    } catch (err) {
      console.warn(
        "[supabase-data] Couldn't load the live menu from Supabase — showing the built-in menu instead.",
        err
      );
    }
  }

  // Exposed for the admin panel (not required — it manages its own Supabase
  // client) and for automated tests of the mapping logic.
  window.BakerySupabase = { mapProductRow, mapOfferRow, buildProductList, isConfigured };

  loadFromSupabase();
})();
