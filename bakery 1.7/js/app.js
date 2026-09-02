/* =========================================================================
   AL HADI AL ASRI BAKERY — APP LOGIC
   You should not need to edit this file. All editable content lives in
   js/config.js.
   ========================================================================= */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     State
     ----------------------------------------------------------------------- */
  const state = {
    cart: [],              // [{ id, qty }]
    activeProduct: null,   // product being viewed in the modal
    modalQty: 1,
    orderType: "Pickup",
    location: null,        // { lat, lng, mapsUrl } — set only via GPS, never persisted
  };

  const money = (n) => `$${n.toFixed(2)}`;

  // Display-only phone formatter: "96178715548" -> "+961 78 715 548".
  // Purely cosmetic — the raw digits (BAKERY_INFO.BAKERY_WHATSAPP_NUMBER)
  // are still what's used to build the actual wa.me link, unaffected.
  function formatPhoneDisplay(raw) {
    const digits = (raw || "").replace(/\D/g, "");
    if (!digits) return raw || "";
    const cc = digits.slice(0, 3);
    const rest = digits.slice(3);
    if (!rest) return `+${cc}`;
    const chunks = [rest.slice(0, 2)];
    for (let i = 2; i < rest.length; i += 3) {
      chunks.push(rest.slice(i, i + 3));
    }
    return `+${cc} ${chunks.join(" ")}`;
  }
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* -----------------------------------------------------------------------
     Product tile / thumb rendering (handles placeholder vs real image)
     ----------------------------------------------------------------------- */
  function productMediaHTML(product, { large = false } = {}) {
    if (product.image) {
      return `<img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.parentElement.innerHTML = '<span class=\\'placeholder-icon\\' aria-hidden=\\'true\\'>${product.icon}</span>';" />`;
    }
    return `<span class="placeholder-icon" aria-hidden="true">${product.icon}</span>`;
  }

  /* -----------------------------------------------------------------------
     Social logo rendering (Contact section + footer)
     One reusable piece of markup for all three social icons (WhatsApp,
     Instagram, TikTok): renders the configured image if a file exists at
     that path, and quietly falls back to a plain emoji — so the layout
     never breaks before the real logo files are added.
     ----------------------------------------------------------------------- */
  function socialLogoHTML(logoPath, fallbackEmoji, altText) {
    if (logoPath) {
      return `<img class="social-logo" src="${logoPath}" alt="${altText}" loading="lazy" onerror="this.parentElement.textContent = '${fallbackEmoji}';" />`;
    }
    return fallbackEmoji;
  }

  /* -----------------------------------------------------------------------
     Render: Special Offer poster
     Reads the "special-offer" product straight from PRODUCTS (config.js)
     — same data, same cart, same checkout, same WhatsApp flow as every
     other item. "Order Now" simply opens the normal product modal so
     quantity selection and Add to Order work exactly as they do
     everywhere else on the site.
     ----------------------------------------------------------------------- */
  function renderSpecialOffer() {
    const container = $("#specialOfferPoster");
    if (!container) return;

    const offer = byId("special-offer");
    if (!offer) {
      container.closest(".section").style.display = "none";
      return;
    }

    container.innerHTML = `
      <div class="offer-poster" data-id="${offer.id}">
        <div class="offer-poster-visual">
          ${productMediaHTML(offer)}
          <span class="offer-badge">🎉 Limited-time</span>
        </div>
        <div class="offer-poster-content">
          <span class="offer-eyebrow">Special Offer</span>
          <h3 class="offer-title">${offer.description}</h3>
          <div class="offer-price-row">
            <span class="offer-price-label">Only</span>
            <span class="offer-price-value">$${Math.round(offer.price)}</span>
          </div>
          <button class="btn btn-primary offer-cta" id="offerOrderBtn">Order Now</button>
        </div>
      </div>
    `;

    $("#offerOrderBtn").addEventListener("click", () => openProductModal(offer.id));
    observeCards();
  }

  function productCardHTML(product) {
    const cat = CATEGORIES.find((c) => c.id === product.category);
    const soldOut = product.available === false;
    return `
      <article class="product-card${soldOut ? " is-sold-out" : ""}" data-id="${product.id}" tabindex="0" role="button" aria-label="View ${product.name}${soldOut ? " (Sold Out)" : ""}">
        <div class="product-thumb">
          ${productMediaHTML(product)}
          <span class="product-tag">${cat ? cat.icon : ""} ${cat ? cat.label : ""}</span>
          ${soldOut ? '<span class="sold-out-badge">Sold Out</span>' : ""}
        </div>
        <div class="product-body">
          <h4 class="product-name">${product.name}</h4>
          <p class="product-desc">${product.description || ""}</p>
          <div class="product-footer">
            <span class="product-price">${money(product.price)}</span>
            ${
              soldOut
                ? `<span class="product-sold-out-label">Sold Out</span>`
                : `<button class="product-add" data-quick-add="${product.id}" aria-label="Quick add ${product.name}">+</button>`
            }
          </div>
        </div>
      </article>
    `;
  }

  function attachProductCardEvents(root) {
    $all(".product-card", root).forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-quick-add]")) return;
        openProductModal(id);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProductModal(id);
        }
      });
    });
    $all("[data-quick-add]", root).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const product = byId(btn.dataset.quickAdd);
        if (!product || product.available === false) return; // sold out — never add
        addToCart(btn.dataset.quickAdd, 1);
        pulseButton(btn);
        showToast(`Added ${product.name} to your order`);
      });
    });
  }

  function pulseButton(btn) {
    btn.style.transform = "scale(1.25)";
    setTimeout(() => (btn.style.transform = ""), 160);
  }

  /* -----------------------------------------------------------------------
     Render: Menu tabs + category sections
     ----------------------------------------------------------------------- */
  function renderMenu() {
    const tabsEl = $("#menuTabs");
    tabsEl.innerHTML = CATEGORIES.map(
      (c, i) => `
      <button class="menu-tab${i === 0 ? " is-active" : ""}" data-cat="${c.id}" role="tab" aria-selected="${i === 0}">
        <span aria-hidden="true">${c.icon}</span> ${c.label}
      </button>`
    ).join("");

    tabsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".menu-tab");
      if (!btn) return;
      $all(".menu-tab", tabsEl).forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      const target = document.getElementById(`cat-${btn.dataset.cat}`);
      if (target) {
        const y = target.getBoundingClientRect().top + window.scrollY - (document.querySelector(".site-header").offsetHeight + 16);
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });

    const sectionsEl = $("#menuSections");
    sectionsEl.innerHTML = CATEGORIES.map((c) => {
      const items = PRODUCTS.filter((p) => p.category === c.id);
      if (!items.length) return "";
      return `
        <div class="menu-category" id="cat-${c.id}">
          <div class="menu-category-head">
            <h3>${c.icon} ${c.label}</h3>
            <span class="count">${items.length} item${items.length > 1 ? "s" : ""}</span>
          </div>
          <div class="product-grid">
            ${items.map((p) => productCardHTML(p)).join("")}
          </div>
        </div>
      `;
    }).join("");
    attachProductCardEvents(sectionsEl);

    observeCards();
  }

  /* -----------------------------------------------------------------------
     Scroll-in animation for product/why cards
     ----------------------------------------------------------------------- */
  function observeCards() {
    const cards = $all(".product-card, .why-card, .offer-poster");
    if (!("IntersectionObserver" in window)) {
      cards.forEach((c) => c.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    cards.forEach((c) => io.observe(c));
  }

  /* -----------------------------------------------------------------------
     Product modal
     ----------------------------------------------------------------------- */
  function openProductModal(id) {
    const product = byId(id);
    if (!product) return;
    state.activeProduct = product;
    state.modalQty = 1;

    const cat = CATEGORIES.find((c) => c.id === product.category);
    const soldOut = product.available === false;

    $("#modalHero").innerHTML = productMediaHTML(product);
    $("#modalHero").classList.toggle("is-sold-out", soldOut);
    $("#modalCat").textContent = cat ? `${cat.icon} ${cat.label}` : "";
    $("#modalTitle").textContent = product.name;
    $("#modalDesc").textContent = product.description || "";
    $("#modalPrice").textContent = money(product.price);
    $("#modalQtyValue").textContent = state.modalQty;

    $("#modalQtyMinus").disabled = soldOut;
    $("#modalQtyPlus").disabled = soldOut;
    const addBtn = $("#modalAddBtn");
    addBtn.disabled = soldOut;
    addBtn.classList.toggle("is-sold-out", soldOut);
    addBtn.textContent = soldOut ? "Sold Out" : "Add to Order";

    $("#productOverlay").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeProductModal() {
    $("#productOverlay").classList.remove("is-open");
    document.body.style.overflow = "";
    state.activeProduct = null;
  }

  function initProductModal() {
    $("#modalCloseBtn").addEventListener("click", closeProductModal);
    $("#productOverlay").addEventListener("click", (e) => {
      if (e.target.id === "productOverlay") closeProductModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeProductModal();
        closeCart();
      }
    });

    $("#modalQtyMinus").addEventListener("click", () => {
      state.modalQty = Math.max(1, state.modalQty - 1);
      $("#modalQtyValue").textContent = state.modalQty;
    });
    $("#modalQtyPlus").addEventListener("click", () => {
      state.modalQty = Math.min(50, state.modalQty + 1);
      $("#modalQtyValue").textContent = state.modalQty;
    });

    $("#modalAddBtn").addEventListener("click", () => {
      if (!state.activeProduct || state.activeProduct.available === false) return;
      addToCart(state.activeProduct.id, state.modalQty);
      showToast(`Added ${state.modalQty} × ${state.activeProduct.name} to your order`);
      closeProductModal();
      openCart();
    });
  }

  /* -----------------------------------------------------------------------
     Cart logic
     ----------------------------------------------------------------------- */
  function addToCart(id, qty) {
    const product = byId(id);
    if (!product || product.available === false) return; // sold out — never add, no matter the caller

    qty = Number(qty);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    qty = Math.min(50, Math.round(qty));

    const existing = state.cart.find((item) => item.id === id);
    if (existing) {
      existing.qty = Math.min(50, existing.qty + qty);
    } else {
      state.cart.push({ id, qty });
    }
    renderCart();
  }

  function setQty(id, qty) {
    const item = state.cart.find((i) => i.id === id);
    if (!item) return;
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    item.qty = Math.min(50, qty);
    renderCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((i) => i.id !== id);
    renderCart();
  }

  function cartLines() {
    return state.cart
      .map((item) => {
        const product = byId(item.id);
        if (!product) return null; // handles "product removed" gracefully
        return { product, qty: item.qty, lineTotal: product.price * item.qty };
      })
      .filter(Boolean);
  }

  function cartTotals() {
    const lines = cartLines();
    const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const deliveryFee = state.orderType === "Delivery" ? DELIVERY_FEE : 0;
    const total = subtotal + deliveryFee;
    return { itemCount, subtotal, deliveryFee, total, lines };
  }

  function renderCart() {
    const { lines, itemCount, subtotal, deliveryFee, total } = cartTotals();

    // Header + floating buttons
    $("#headerCartCount").textContent = itemCount;
    const fcBtn = $("#floatingCartBtn");
    $("#floatingCartLabel").textContent = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
    $("#floatingCartTotal").textContent = money(total);
    fcBtn.classList.toggle("is-visible", itemCount > 0 && !$("#cartDrawer").classList.contains("is-open"));

    // Cart drawer list
    const listEl = $("#cartItemsList");
    if (!lines.length) {
      listEl.innerHTML = `
        <div class="cart-empty">
          <div class="icon" aria-hidden="true">🥐</div>
          <p>Your order is empty.<br />Add something delicious from the menu.</p>
        </div>`;
      $("#cartSummary").style.display = "none";
    } else {
      $("#cartSummary").style.display = "block";
      listEl.innerHTML = lines
        .map(
          (l) => `
        <div class="cart-item" data-id="${l.product.id}">
          <div class="cart-item-thumb">${productMediaHTML(l.product)}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${l.product.name}</div>
            <div class="cart-item-price">${money(l.product.price)} each</div>
            <div class="cart-item-controls">
              <div class="cart-item-qty">
                <button data-action="dec" aria-label="Decrease quantity of ${l.product.name}">−</button>
                <span>${l.qty}</span>
                <button data-action="inc" aria-label="Increase quantity of ${l.product.name}">+</button>
              </div>
              <button class="cart-item-remove" data-action="remove">Remove</button>
            </div>
          </div>
        </div>`
        )
        .join("");
    }

    // Step 1 summary (grand total, reflecting whichever order type is
    // currently selected so it never disagrees with step 2 / WhatsApp)
    $("#cartItemCount").textContent = itemCount;
    $("#cartTotalValue").textContent = money(total);

    // Step 2 (checkout) summary: full breakdown
    $("#checkoutItemCount").textContent = itemCount;
    $("#checkoutSubtotalValue").textContent = money(subtotal);
    $("#checkoutDeliveryValue").textContent = money(deliveryFee);
    $("#checkoutTotalValue").textContent = money(total);
    // Delivery fee row only appears at all for Delivery orders — Pickup
    // shows no fee row whatsoever (not even "$0.00").
    $("#checkoutDeliveryRow").style.display = state.orderType === "Delivery" ? "flex" : "none";
  }

  function initCartEvents() {
    $("#cartItemsList").addEventListener("click", (e) => {
      const row = e.target.closest(".cart-item");
      if (!row) return;
      const id = row.dataset.id;
      const item = state.cart.find((i) => i.id === id);
      if (!item) return;

      if (e.target.dataset.action === "inc") setQty(id, item.qty + 1);
      if (e.target.dataset.action === "dec") setQty(id, item.qty - 1);
      if (e.target.dataset.action === "remove") removeFromCart(id);
    });
  }

  /* -----------------------------------------------------------------------
     Cart drawer open/close + step switching
     ----------------------------------------------------------------------- */
  function openCart() {
    showCartStep();
    $("#cartDrawer").classList.add("is-open");
    $("#cartScrim").classList.add("is-open");
    $("#floatingCartBtn").classList.remove("is-visible");
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    $("#cartDrawer").classList.remove("is-open");
    $("#cartScrim").classList.remove("is-open");
    document.body.style.overflow = "";
    renderCart(); // restores floating button visibility if needed
  }

  function showCartStep() {
    $("#cartStep").style.display = "flex";
    $("#checkoutStep").style.display = "none";
  }
  function showCheckoutStep() {
    if (cartTotals().itemCount === 0) {
      showToast("Your order is empty. Add something first.");
      return;
    }
    $("#cartStep").style.display = "none";
    $("#checkoutStep").style.display = "flex";
  }

  function initCartDrawer() {
    $("#cartOpenBtn").addEventListener("click", openCart);
    $("#floatingCartBtn").addEventListener("click", openCart);
    $("#cartCloseBtn").addEventListener("click", closeCart);
    $("#checkoutCloseBtn").addEventListener("click", closeCart);
    $("#cartScrim").addEventListener("click", closeCart);
    $("#goToCheckoutBtn").addEventListener("click", showCheckoutStep);
    $("#backToCartBtn").addEventListener("click", showCartStep);
    $("#orderNowBtn").addEventListener("click", (e) => {
      // "Order Now" scrolls to the menu; if the cart already has items,
      // open the cart instead so returning customers go straight to checkout.
      if (cartTotals().itemCount > 0) {
        e.preventDefault();
        openCart();
      }
    });
  }

  /* -----------------------------------------------------------------------
     Order type toggle (pickup / delivery)
     ----------------------------------------------------------------------- */
  function initOrderType() {
    $all(".order-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".order-type-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.orderType = btn.dataset.type;
        $("#addressGroup").style.display = state.orderType === "Delivery" ? "block" : "none";
        clearFieldError($("#customerAddress"), $("#errAddress"));
        renderCart(); // recompute delivery fee + total immediately, no refresh needed
      });
    });
  }

  /* -----------------------------------------------------------------------
     Delivery location — GPS ("Send My Current Location") with a manual
     address fallback. Only one method is ever active at a time; choosing
     one clears the other so the WhatsApp message is never ambiguous.
     Coordinates are requested on tap only, used once to build a Google
     Maps link, and never stored anywhere beyond this in-memory session.
     ----------------------------------------------------------------------- */
  function setLocationStatus(type, html) {
    const el = $("#locationStatus");
    el.className = "location-status is-visible" + (type ? ` is-${type}` : "");
    el.innerHTML = html;
  }
  function clearLocationStatus() {
    const el = $("#locationStatus");
    el.className = "location-status";
    el.innerHTML = "";
  }

  function initDeliveryLocation() {
    const shareBtn = $("#shareLocationBtn");
    const manualToggleBtn = $("#manualAddressToggleBtn");
    const manualGroup = $("#manualAddressGroup");
    const addressInput = $("#customerAddress");
    const GEOLOCATION_ERROR_MSG =
      "We couldn't get your location. Please try again or enter your address manually.";

    shareBtn.addEventListener("click", () => {
      if (!("geolocation" in navigator)) {
        setLocationStatus("error", GEOLOCATION_ERROR_MSG);
        return;
      }

      const originalLabel = shareBtn.innerHTML;
      shareBtn.disabled = true;
      shareBtn.innerHTML = "Getting your location…";
      setLocationStatus("loading", "Requesting your location…");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          state.location = { lat, lng, mapsUrl };

          // A GPS location and a manually typed address are mutually
          // exclusive — a successful GPS fix clears any manual entry so
          // only one delivery method is ever sent with the order.
          addressInput.value = "";
          manualGroup.style.display = "none";
          clearFieldError(addressInput, $("#errAddress"));

          setLocationStatus(
            "success",
            `<strong>✓ Location selected</strong><a href="${mapsUrl}" target="_blank" rel="noopener">📍 View location on Google Maps</a>`
          );

          shareBtn.disabled = false;
          shareBtn.innerHTML = originalLabel;
        },
        () => {
          // Permission denied, position unavailable, or timed out — all
          // treated the same way, with the manual option always open.
          state.location = null;
          shareBtn.disabled = false;
          shareBtn.innerHTML = originalLabel;
          setLocationStatus("error", GEOLOCATION_ERROR_MSG);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    manualToggleBtn.addEventListener("click", () => {
      // Switching to manual entry clears any GPS location so only one
      // delivery method is ever active.
      state.location = null;
      clearLocationStatus();
      manualGroup.style.display = "block";
      addressInput.focus();
    });

    addressInput.addEventListener("input", () => {
      clearFieldError(addressInput, $("#errAddress"));
    });
  }

  /* -----------------------------------------------------------------------
     Form validation helpers
     ----------------------------------------------------------------------- */
  function setFieldError(input, errorEl, message) {
    input.classList.add("has-error");
    errorEl.textContent = message;
    errorEl.classList.add("is-visible");
  }
  function clearFieldError(input, errorEl) {
    input.classList.remove("has-error");
    errorEl.classList.remove("is-visible");
  }

  /* -----------------------------------------------------------------------
     WhatsApp order submission
     ----------------------------------------------------------------------- */
  function buildWhatsAppMessage({ name, phone, orderType, address, location, notes, lines, subtotal, deliveryFee, total }) {
    const itemLines = lines
      .map((l) => {
        let line = `• ${l.qty} × ${l.product.name}`;
        // Offer-type products (like the Special Offer) spell out what's
        // included right under the line, same as they do in the modal.
        if (l.product.category === "offer" && l.product.description) {
          line += `\n   ${l.product.description}`;
        }
        return line;
      })
      .join("\n");

    let msg = `Hello Al Hadi Al Asri Bakery! 👋\n\n`;
    msg += `I'd like to place an order:\n\n`;
    msg += `${itemLines}\n\n`;
    msg += `Subtotal: ${money(subtotal)}\n`;
    // Pickup orders never show a delivery fee line — not even $0.00.
    if (orderType === "Delivery") {
      msg += `Delivery: ${money(deliveryFee)}\n`;
    }
    msg += `Total: ${money(total)}\n\n`;
    msg += `Order type: ${orderType}\n`;
    msg += `Name: ${name}\n`;
    if (phone) msg += `Phone: ${phone}\n`;

    if (orderType === "Delivery") {
      if (location) {
        msg += `\n📍 Delivery Location:\n${location.mapsUrl}\n`;
      } else if (address) {
        msg += `Address: ${address}\n`;
      }
    }

    if (notes) msg += `Notes: ${notes}`;

    return msg.trim();
  }

  function initCheckoutForm() {
    const errGeneral = $("#errGeneral");

    $("#customerName").addEventListener("input", (e) =>
      clearFieldError(e.target, $("#errName"))
    );
    $("#customerAddress").addEventListener("input", (e) =>
      clearFieldError(e.target, $("#errAddress"))
    );

    $("#checkoutForm").addEventListener("submit", (e) => {
      e.preventDefault();
      errGeneral.textContent = "";

      const { lines, subtotal, deliveryFee, total, itemCount } = cartTotals();
      const nameInput = $("#customerName");
      const phoneInput = $("#customerPhone");
      const addressInput = $("#customerAddress");
      const notesInput = $("#customerNotes");

      let hasError = false;

      // 1. Empty cart guard
      if (itemCount === 0 || !lines.length) {
        errGeneral.textContent = "Your order is empty. Please add at least one item.";
        showCartStep();
        return;
      }

      // 2. Missing name
      const name = nameInput.value.trim();
      if (!name) {
        setFieldError(nameInput, $("#errName"), "Please enter your name.");
        hasError = true;
      } else {
        clearFieldError(nameInput, $("#errName"));
      }

      // 3. Delivery requires EITHER a shared GPS location OR a manual
      //    address — never both required, never neither.
      const address = addressInput.value.trim();
      const hasGpsLocation = !!(state.orderType === "Delivery" && state.location);
      if (state.orderType === "Delivery" && !hasGpsLocation && !address) {
        setFieldError(
          addressInput,
          $("#errAddress"),
          "Please share your location or enter a delivery address."
        );
        hasError = true;
      } else {
        clearFieldError(addressInput, $("#errAddress"));
      }

      // 4. Invalid quantities (defensive — quantities are always kept >= 1
      //    internally, but re-check before sending)
      const invalidQty = lines.some((l) => !Number.isFinite(l.qty) || l.qty < 1);
      if (invalidQty) {
        errGeneral.textContent = "One of your items has an invalid quantity. Please review your order.";
        hasError = true;
      }

      // 5. WhatsApp number not configured
      const waNumber = (BAKERY_INFO.BAKERY_WHATSAPP_NUMBER || "").replace(/\D/g, "");
      if (!waNumber || BAKERY_INFO.BAKERY_WHATSAPP_NUMBER === "REPLACE_ME") {
        errGeneral.textContent =
          "Online ordering isn't fully set up yet — the bakery's WhatsApp number is missing. Please contact the bakery directly.";
        hasError = true;
      }

      if (hasError) return;

      const message = buildWhatsAppMessage({
        name,
        phone: phoneInput.value.trim(),
        orderType: state.orderType,
        address,
        location: hasGpsLocation ? state.location : null,
        notes: notesInput.value.trim(),
        lines,
        subtotal,
        deliveryFee,
        total,
      });

      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener");

      showToast("Opening WhatsApp with your order…");
    });
  }

  /* -----------------------------------------------------------------------
     Contact section + footer (built from BAKERY_INFO)
     ----------------------------------------------------------------------- */
  function renderContact() {
    const waConfigured =
      BAKERY_INFO.BAKERY_WHATSAPP_NUMBER &&
      BAKERY_INFO.BAKERY_WHATSAPP_NUMBER !== "REPLACE_ME";
    const waDigits = waConfigured ? BAKERY_INFO.BAKERY_WHATSAPP_NUMBER.replace(/\D/g, "") : "";

    const items = [
      {
        primary: true,
        icon: "💬",
        logo: SOCIAL_LOGOS.WHATSAPP,
        label: "WhatsApp",
        value: waConfigured ? formatPhoneDisplay(BAKERY_INFO.BAKERY_WHATSAPP_NUMBER) : "Coming soon",
        href: waConfigured ? `https://wa.me/${waDigits}` : null,
      },
      {
        icon: "📷",
        logo: SOCIAL_LOGOS.INSTAGRAM,
        label: "Instagram",
        value: isSet(BAKERY_INFO.BAKERY_INSTAGRAM) ? `@${BAKERY_INFO.BAKERY_INSTAGRAM}` : "Coming soon",
        href: isSet(BAKERY_INFO.BAKERY_INSTAGRAM)
          ? `https://instagram.com/${BAKERY_INFO.BAKERY_INSTAGRAM}`
          : null,
      },
      {
        icon: "🎵",
        logo: SOCIAL_LOGOS.TIKTOK,
        label: "TikTok",
        value: isSet(BAKERY_INFO.BAKERY_TIKTOK) ? `@${BAKERY_INFO.BAKERY_TIKTOK}` : "Coming soon",
        href: isSet(BAKERY_INFO.BAKERY_TIKTOK)
          ? `https://www.tiktok.com/@${BAKERY_INFO.BAKERY_TIKTOK}`
          : null,
      },
      {
        icon: "📍",
        label: "Address",
        value: safe(BAKERY_INFO.BAKERY_ADDRESS),
        href: null,
      },
      {
        icon: "🕒",
        label: "Opening hours",
        value: safe(BAKERY_INFO.OPENING_HOURS),
        href: null,
      },
    ];

    $("#contactList").innerHTML = items
      .map((item) => {
        const iconMarkup = item.logo
          ? socialLogoHTML(item.logo, item.icon, item.label)
          : item.icon;
        const inner = `
          <span class="contact-icon" aria-hidden="true">${iconMarkup}</span>
          <span>
            <span class="contact-label">${item.label}</span>
            <span class="contact-value">${item.value}</span>
          </span>`;
        return item.href
          ? `<a class="contact-item${item.primary ? " is-primary" : ""}" href="${item.href}" target="_blank" rel="noopener">${inner}</a>`
          : `<div class="contact-item${item.primary ? " is-primary" : ""}">${inner}</div>`;
      })
      .join("");

    // Map card
    $("#mapAddressText").textContent = isSet(BAKERY_INFO.BAKERY_ADDRESS)
      ? BAKERY_INFO.BAKERY_ADDRESS
      : "Add your address in js/config.js to show it here.";
    const mapBtn = $("#mapLinkBtn");
    if (isSet(BAKERY_INFO.GOOGLE_MAPS_URL)) {
      mapBtn.href = BAKERY_INFO.GOOGLE_MAPS_URL;
    } else {
      mapBtn.removeAttribute("target");
      mapBtn.href = "#contact";
      mapBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showToast("Add GOOGLE_MAPS_URL in js/config.js to enable this button.");
      });
    }

    // Footer social
    $("#footerSocial").innerHTML = `
      ${
        isSet(BAKERY_INFO.BAKERY_INSTAGRAM)
          ? `<a href="https://instagram.com/${BAKERY_INFO.BAKERY_INSTAGRAM}" target="_blank" rel="noopener" aria-label="Instagram">${socialLogoHTML(SOCIAL_LOGOS.INSTAGRAM, "📷", "Instagram")}</a>`
          : ""
      }
      ${
        isSet(BAKERY_INFO.BAKERY_TIKTOK)
          ? `<a href="https://www.tiktok.com/@${BAKERY_INFO.BAKERY_TIKTOK}" target="_blank" rel="noopener" aria-label="TikTok">${socialLogoHTML(SOCIAL_LOGOS.TIKTOK, "🎵", "TikTok")}</a>`
          : ""
      }
      ${
        waConfigured
          ? `<a href="https://wa.me/${waDigits}" target="_blank" rel="noopener" aria-label="WhatsApp">${socialLogoHTML(SOCIAL_LOGOS.WHATSAPP, "💬", "WhatsApp")}</a>`
          : ""
      }
    `;

    $("#year").textContent = new Date().getFullYear();
  }

  function isSet(val) {
    return typeof val === "string" && val.trim() && val !== "REPLACE_ME";
  }
  function safe(val) {
    return isSet(val) ? val : "Coming soon";
  }

  /* -----------------------------------------------------------------------
     Toast
     ----------------------------------------------------------------------- */
  let toastTimer = null;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  /* -----------------------------------------------------------------------
     Mobile nav
     ----------------------------------------------------------------------- */
  function initMobileNav() {
    const nav = $("#mobileNav");
    const openBtn = $("#navToggle");
    const closeBtn = $("#mobileNavClose");

    const open = () => {
      nav.classList.add("is-open");
      openBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      nav.classList.remove("is-open");
      openBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    $all(".mobile-nav-link").forEach((link) => link.addEventListener("click", close));
  }

  /* -----------------------------------------------------------------------
     Init
     ----------------------------------------------------------------------- */
  function init() {
    renderSpecialOffer();
    renderMenu();
    renderContact();
    renderCart();

    initProductModal();
    initCartEvents();
    initCartDrawer();
    initOrderType();
    initDeliveryLocation();
    initCheckoutForm();
    initMobileNav();

    // Keep floating cart button in sync with scroll/visibility of header cart
    window.addEventListener("resize", renderCart);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* -----------------------------------------------------------------------
     Public hook for js/supabase-data.js (optional admin-panel backend).
     PRODUCTS is declared with `let` in js/config.js specifically so this
     works: supabase-data.js reassigns PRODUCTS to the live data from the
     database, then calls this to redraw the menu/offer/cart with it. If
     Supabase isn't configured, this is simply never called and the site
     behaves exactly as it did before — nothing in this file depends on it.
     ----------------------------------------------------------------------- */
  window.__bakeryRerender = function () {
    renderSpecialOffer();
    renderMenu();
    renderCart();
  };
})();
