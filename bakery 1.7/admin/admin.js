/* =========================================================================
   AL HADI AL ASRI BAKERY — ADMIN PANEL
   =========================================================================
   Plain JS, no build step, same pattern as the public site's js/app.js.
   Talks directly to Supabase (auth + database + storage) using the same
   public anon key + CDN client the storefront uses — write access is
   enforced entirely by Row Level Security in supabase/schema.sql, not by
   anything in this file. Never put a service-role key here.
   ========================================================================= */

(function () {
  "use strict";

  const SUPABASE_URL = window.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";

  const CATEGORIES = [
    { id: "croissants", label: "Croissants" },
    { id: "donuts", label: "Donuts" },
    { id: "crepes", label: "Crepes" },
    { id: "pancakes", label: "Pancakes" },
    { id: "buns", label: "Buns" },
  ];

  const IMAGE_BUCKET = "product-images";
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) => `$${Number(n).toFixed(2)}`;

  let client = null;
  const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== "undefined" && supabase.createClient);
  if (isConfigured) {
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const state = {
    products: [],
    offers: [],
    deleteTarget: null, // { type: 'product'|'offer', id }
    productImageUrl: "", // currently-selected image URL for the open product form
    offerImageUrl: "",
    productsFilter: { search: "", category: "" },
  };

  /* -----------------------------------------------------------------------
     Small pure validators — exported for testing, no DOM/network involved.
     ----------------------------------------------------------------------- */
  function validateImageFile(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Please upload a PNG, JPG or WEBP image.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Image must be smaller than 5MB.");
    }
    return true;
  }

  function validateProductForm({ name, category, price }) {
    if (!name || !name.trim()) return { field: "pfName", message: "Please enter a product name." };
    if (!CATEGORIES.some((c) => c.id === category)) return { field: "pfCategory", message: "Please choose a category." };
    if (!Number.isFinite(price) || price < 0) return { field: "pfPrice", message: "Please enter a valid price (0 or more)." };
    return null;
  }

  function validateOfferForm({ description, price }) {
    if (!description || !description.trim()) return { field: "ofDescription", message: "Please enter the offer text." };
    if (!Number.isFinite(price) || price < 0) return { field: "ofPrice", message: "Please enter a valid price (0 or more)." };
    return null;
  }

  // Puts a red border on the invalid field, scrolls it into view, and
  // focuses it — so the error is obvious even on a long, scrolled form.
  function flagInvalidField(fieldId) {
    const field = $("#" + fieldId);
    if (!field) return;
    field.classList.add("has-error");
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus();
  }

  function clearInvalidField(fieldId) {
    const field = $("#" + fieldId);
    if (field) field.classList.remove("has-error");
  }

  /* -----------------------------------------------------------------------
     Toast (same pattern as the public site)
     ----------------------------------------------------------------------- */
  let toastTimer = null;
  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  /* -----------------------------------------------------------------------
     Auth
     ----------------------------------------------------------------------- */
  async function login(email, password) {
    if (!client) throw new Error("Supabase isn't configured for this site yet.");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
  }

  function showLoginScreen(user) {
    $("#loginScreen").style.display = "flex";
    $("#adminApp").style.display = "none";
    if (!isConfigured) {
      $("#notConfiguredNote").style.display = "block";
      $("#loginSubmitBtn").disabled = true;
    }
  }

  function showDashboard(user) {
    $("#loginScreen").style.display = "none";
    $("#adminApp").style.display = "flex";
    $("#currentUserEmail").textContent = user && user.email ? user.email : "";
    loadAllData();
  }

  function initAuth() {
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#loginEmail").value.trim();
      const password = $("#loginPassword").value;
      const errEl = $("#loginError");
      errEl.textContent = "";

      if (!email || !password) {
        errEl.textContent = "Please enter both email and password.";
        return;
      }

      const btn = $("#loginSubmitBtn");
      btn.disabled = true;
      btn.textContent = "Logging in…";
      try {
        await login(email, password);
        // onAuthStateChange (below) takes it from here and shows the dashboard.
      } catch (err) {
        errEl.textContent = err.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : (err.message || "Login failed. Please try again.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Log In";
      }
    });

    $("#logoutBtn").addEventListener("click", async () => {
      await logout();
    });

    if (!client) {
      showLoginScreen(null);
      return;
    }

    client.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        showDashboard(session.user);
      } else {
        showLoginScreen(null);
      }
    });

    // Initial check (in case a session already exists, e.g. page refresh).
    client.auth.getSession().then(({ data }) => {
      if (data && data.session && data.session.user) {
        showDashboard(data.session.user);
      } else {
        showLoginScreen(null);
      }
    });
  }

  /* -----------------------------------------------------------------------
     Navigation between dashboard / products / offers views
     ----------------------------------------------------------------------- */
  function initNav() {
    $all(".admin-nav-link[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".admin-nav-link[data-view]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        $all(".admin-view").forEach((v) => v.classList.remove("is-active"));
        $(`#view-${btn.dataset.view}`).classList.add("is-active");
        $("#adminSidebar").classList.remove("is-open");
      });
    });

    $("#adminMobileNavToggle").addEventListener("click", () => {
      $("#adminSidebar").classList.toggle("is-open");
    });
  }

  /* -----------------------------------------------------------------------
     Data loading
     ----------------------------------------------------------------------- */
  async function loadAllData() {
    await Promise.all([loadProducts(), loadOffers()]);
    renderDashboardStats();
  }

  async function loadProducts() {
    $("#productsLoading").style.display = "block";
    $("#productsError").textContent = "";
    try {
      const { data, error } = await client.from("products").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      state.products = data || [];
      renderProductsList();
    } catch (err) {
      $("#productsError").textContent = "Couldn't load products: " + (err.message || "unknown error");
    } finally {
      $("#productsLoading").style.display = "none";
    }
  }

  async function loadOffers() {
    $("#offersLoading").style.display = "block";
    $("#offersError").textContent = "";
    try {
      const { data, error } = await client.from("special_offers").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      state.offers = data || [];
      renderOffersList();
    } catch (err) {
      $("#offersError").textContent = "Couldn't load special offers: " + (err.message || "unknown error");
    } finally {
      $("#offersLoading").style.display = "none";
    }
  }

  function renderDashboardStats() {
    const total = state.products.length;
    const soldOut = state.products.filter((p) => p.available === false).length;
    const activeOffers = state.offers.filter((o) => o.is_active).length;
    $("#dashboardStats").innerHTML = `
      <div class="admin-stat-card"><div class="admin-stat-num">${total}</div><div class="admin-stat-label">Total products</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${total - soldOut}</div><div class="admin-stat-label">Available</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${soldOut}</div><div class="admin-stat-label">Sold out</div></div>
      <div class="admin-stat-card"><div class="admin-stat-num">${activeOffers}</div><div class="admin-stat-label">Active offers</div></div>
    `;
  }

  /* -----------------------------------------------------------------------
     Products list
     ----------------------------------------------------------------------- */
  function productThumbHTML(p) {
    if (p.image) {
      return `<img src="${p.image}" alt="${p.name}" onerror="this.parentElement.textContent='${p.icon || "🥐"}';" />`;
    }
    return p.icon || "🥐";
  }

  function getFilteredProducts() {
    const { search, category } = state.productsFilter;
    const q = search.trim().toLowerCase();
    return state.products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const matchesCategory = !category || p.category === category;
      return matchesSearch && matchesCategory;
    });
  }

  function renderProductsList() {
    const filtered = getFilteredProducts();

    $("#productsEmpty").style.display = state.products.length ? "none" : "block";
    $("#productsNoMatch").style.display = state.products.length && !filtered.length ? "block" : "none";

    $("#productsList").innerHTML = filtered
      .map((p) => {
        const soldOut = p.available === false;
        const catLabel = (CATEGORIES.find((c) => c.id === p.category) || {}).label || p.category;
        return `
        <div class="admin-product-row" data-id="${p.id}">
          <div class="admin-product-thumb">${productThumbHTML(p)}</div>
          <div class="admin-product-info">
            <div class="admin-product-name">${p.name}</div>
            <div class="admin-product-meta">${catLabel} · ${money(p.price)}</div>
          </div>
          <div class="admin-product-actions">
            <button class="admin-status-pill ${soldOut ? "is-sold-out" : "is-available"}" data-action="toggle-availability" data-id="${p.id}" data-available="${p.available !== false}">
              ${soldOut ? "🔴 Sold Out" : "🟢 Available"}
            </button>
            <button class="admin-icon-btn" data-action="edit-product" data-id="${p.id}" aria-label="Edit ${p.name}">✏️</button>
            <button class="admin-icon-btn is-danger" data-action="delete-product" data-id="${p.id}" aria-label="Delete ${p.name}">🗑️</button>
          </div>
        </div>`;
      })
      .join("");
  }

  async function toggleAvailability(id, currentlyAvailable) {
    const newValue = !currentlyAvailable;
    try {
      const { error } = await client.from("products").update({ available: newValue }).eq("id", id);
      if (error) throw error;
      const p = state.products.find((x) => x.id === id);
      if (p) p.available = newValue;
      renderProductsList();
      renderDashboardStats();
      showToast(newValue ? "Marked as Available" : "Marked as Sold Out");
    } catch (err) {
      showToast("Couldn't update availability: " + (err.message || "unknown error"));
    }
  }

  function initProductsFilterBar() {
    const select = $("#productsCategoryFilter");
    CATEGORIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      select.appendChild(opt);
    });

    $("#productsSearchInput").addEventListener("input", (e) => {
      state.productsFilter.search = e.target.value;
      renderProductsList();
    });
    select.addEventListener("change", (e) => {
      state.productsFilter.category = e.target.value;
      renderProductsList();
    });
  }

  function initProductsListEvents() {
    initProductsFilterBar();
    $("#productsList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "toggle-availability") {
        toggleAvailability(id, btn.dataset.available === "true");
      } else if (action === "edit-product") {
        openProductForm(state.products.find((p) => p.id === id));
      } else if (action === "delete-product") {
        openConfirmDelete("product", id, state.products.find((p) => p.id === id));
      }
    });
  }

  /* -----------------------------------------------------------------------
     Offers list
     ----------------------------------------------------------------------- */
  function renderOffersList() {
    $("#offersEmpty").style.display = state.offers.length ? "none" : "block";
    $("#offersList").innerHTML = state.offers
      .map((o) => {
        const active = !!o.is_active;
        return `
        <div class="admin-product-row" data-id="${o.id}">
          <div class="admin-product-thumb">${o.image ? `<img src="${o.image}" alt="${o.title}" onerror="this.parentElement.textContent='${o.icon || "🎉"}';" />` : (o.icon || "🎉")}</div>
          <div class="admin-product-info">
            <div class="admin-product-name">${o.title || "Special Offer"}</div>
            <div class="admin-product-meta">${o.description} · ${money(o.price)}</div>
          </div>
          <div class="admin-product-actions">
            <button class="admin-status-pill ${active ? "is-available" : "is-sold-out"}" data-action="toggle-active" data-id="${o.id}" data-active="${active}">
              ${active ? "🟢 Active" : "🔴 Inactive"}
            </button>
            <button class="admin-icon-btn" data-action="edit-offer" data-id="${o.id}" aria-label="Edit offer">✏️</button>
            <button class="admin-icon-btn is-danger" data-action="delete-offer" data-id="${o.id}" aria-label="Delete offer">🗑️</button>
          </div>
        </div>`;
      })
      .join("");
  }

  async function toggleOfferActive(id, currentlyActive) {
    const newValue = !currentlyActive;
    try {
      const { error } = await client.from("special_offers").update({ is_active: newValue }).eq("id", id);
      if (error) throw error;
      const o = state.offers.find((x) => x.id === id);
      if (o) o.is_active = newValue;
      renderOffersList();
      renderDashboardStats();
      showToast(newValue ? "Offer activated" : "Offer deactivated");
    } catch (err) {
      showToast("Couldn't update offer: " + (err.message || "unknown error"));
    }
  }

  function initOffersListEvents() {
    $("#offersList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "toggle-active") {
        toggleOfferActive(id, btn.dataset.active === "true");
      } else if (action === "edit-offer") {
        openOfferForm(state.offers.find((o) => o.id === id));
      } else if (action === "delete-offer") {
        openConfirmDelete("offer", id, state.offers.find((o) => o.id === id));
      }
    });
  }

  /* -----------------------------------------------------------------------
     Image upload (shared by both forms)
     ----------------------------------------------------------------------- */
  async function uploadImage(file) {
    validateImageFile(file);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = client.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function wireImagePicker({ fileInputId, pickBtnId, removeBtnId, previewId, errorId, onChange }) {
    const fileInput = $(fileInputId);
    const pickBtn = $(pickBtnId);
    const removeBtn = $(removeBtnId);
    const preview = $(previewId);
    const errEl = $(errorId);

    pickBtn.addEventListener("click", () => fileInput.click());
    removeBtn.addEventListener("click", () => {
      fileInput.value = "";
      preview.innerHTML = "No photo";
      errEl.textContent = "";
      onChange("");
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      errEl.textContent = "";
      try {
        validateImageFile(file);
        pickBtn.disabled = true;
        pickBtn.textContent = "Uploading…";
        const url = await uploadImage(file);
        preview.innerHTML = `<img src="${url}" alt="" />`;
        onChange(url);
      } catch (err) {
        errEl.textContent = err.message || "Upload failed. Please try again.";
        fileInput.value = "";
      } finally {
        pickBtn.disabled = false;
        pickBtn.textContent = "Upload photo";
      }
    });
  }

  /* -----------------------------------------------------------------------
     Product form (add / edit)
     ----------------------------------------------------------------------- */
  function populateCategorySelect() {
    $("#pfCategory").innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
  }

  function setAvailabilityToggle(btn, available) {
    btn.dataset.available = available ? "true" : "false";
    btn.textContent = available ? "🟢 Available" : "🔴 Sold Out";
  }

  function openProductForm(product) {
    $("#productFormError").textContent = "";
    $("#pfImageError").textContent = "";
    ["pfName", "pfCategory", "pfPrice"].forEach(clearInvalidField);
    const isEdit = !!product;
    $("#productFormTitle").textContent = isEdit ? "Edit Product" : "Add Product";
    $("#pfId").value = isEdit ? product.id : "";
    $("#pfName").value = isEdit ? product.name : "";
    $("#pfCategory").value = isEdit ? product.category : CATEGORIES[0].id;
    $("#pfPrice").value = isEdit ? product.price : "";
    $("#pfDescription").value = isEdit ? (product.description || "") : "";
    $("#pfIcon").value = isEdit ? (product.icon || "") : "";
    state.productImageUrl = isEdit ? (product.image || "") : "";
    $("#pfImagePreview").innerHTML = state.productImageUrl ? `<img src="${state.productImageUrl}" alt="" />` : "No photo";
    setAvailabilityToggle($("#pfAvailable"), isEdit ? product.available !== false : true);
    $("#productFormOverlay").classList.add("is-open");
  }

  function closeProductForm() {
    $("#productFormOverlay").classList.remove("is-open");
  }

  async function submitProductForm(e) {
    e.preventDefault();
    const errEl = $("#productFormError");
    errEl.textContent = "";

    const id = $("#pfId").value || null;
    const payload = {
      name: $("#pfName").value.trim(),
      category: $("#pfCategory").value,
      price: parseFloat($("#pfPrice").value),
      description: $("#pfDescription").value.trim(),
      icon: $("#pfIcon").value.trim() || "🥐",
      image: state.productImageUrl || "",
      available: $("#pfAvailable").dataset.available === "true",
    };

    const validationError = validateProductForm(payload);
    if (validationError) {
      errEl.textContent = validationError.message;
      flagInvalidField(validationError.field);
      return;
    }

    const btn = $("#productFormSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      if (id) {
        const { error } = await client.from("products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await client.from("products").insert(payload);
        if (error) throw error;
      }
      closeProductForm();
      showToast(id ? "Product updated" : "Product added");
      await loadProducts();
      renderDashboardStats();
    } catch (err) {
      errEl.textContent = "Couldn't save: " + (err.message || "unknown error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Product";
    }
  }

  function initProductForm() {
    populateCategorySelect();
    $("#addProductBtn").addEventListener("click", () => openProductForm(null));
    $("#productFormCloseBtn").addEventListener("click", closeProductForm);
    $("#productFormOverlay").addEventListener("click", (e) => {
      if (e.target.id === "productFormOverlay") closeProductForm();
    });
    $("#productForm").addEventListener("submit", submitProductForm);
    $("#pfName").addEventListener("input", () => clearInvalidField("pfName"));
    $("#pfCategory").addEventListener("change", () => clearInvalidField("pfCategory"));
    $("#pfPrice").addEventListener("input", () => clearInvalidField("pfPrice"));
    $("#pfAvailable").addEventListener("click", () => {
      const btn = $("#pfAvailable");
      setAvailabilityToggle(btn, btn.dataset.available !== "true");
    });
    wireImagePicker({
      fileInputId: "#pfImageFile",
      pickBtnId: "#pfImagePickBtn",
      removeBtnId: "#pfImageRemoveBtn",
      previewId: "#pfImagePreview",
      errorId: "#pfImageError",
      onChange: (url) => { state.productImageUrl = url; },
    });
  }

  /* -----------------------------------------------------------------------
     Offer form (add / edit)
     ----------------------------------------------------------------------- */
  function openOfferForm(offer) {
    $("#offerFormError").textContent = "";
    $("#ofImageError").textContent = "";
    ["ofDescription", "ofPrice"].forEach(clearInvalidField);
    const isEdit = !!offer;
    $("#offerFormTitle").textContent = isEdit ? "Edit Special Offer" : "Add Special Offer";
    $("#ofId").value = isEdit ? offer.id : "";
    $("#ofTitle").value = isEdit ? (offer.title || "") : "";
    $("#ofDescription").value = isEdit ? offer.description : "";
    $("#ofPrice").value = isEdit ? offer.price : "";
    $("#ofIcon").value = isEdit ? (offer.icon || "") : "";
    state.offerImageUrl = isEdit ? (offer.image || "") : "";
    $("#ofImagePreview").innerHTML = state.offerImageUrl ? `<img src="${state.offerImageUrl}" alt="" />` : "No photo";
    setAvailabilityToggle($("#ofActive"), isEdit ? !!offer.is_active : false);
    $("#ofActive").textContent = ($("#ofActive").dataset.available === "true") ? "🟢 Active" : "🔴 Inactive";
    $("#offerFormOverlay").classList.add("is-open");
  }

  function closeOfferForm() {
    $("#offerFormOverlay").classList.remove("is-open");
  }

  async function submitOfferForm(e) {
    e.preventDefault();
    const errEl = $("#offerFormError");
    errEl.textContent = "";

    const id = $("#ofId").value || null;
    const payload = {
      title: $("#ofTitle").value.trim() || "Special Offer",
      description: $("#ofDescription").value.trim(),
      price: parseFloat($("#ofPrice").value),
      icon: $("#ofIcon").value.trim() || "🎉",
      image: state.offerImageUrl || "",
      is_active: $("#ofActive").dataset.available === "true",
    };

    const validationError = validateOfferForm(payload);
    if (validationError) {
      errEl.textContent = validationError.message;
      flagInvalidField(validationError.field);
      return;
    }

    const btn = $("#offerFormSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      if (id) {
        const { error } = await client.from("special_offers").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await client.from("special_offers").insert(payload);
        if (error) throw error;
      }
      closeOfferForm();
      showToast(id ? "Offer updated" : "Offer added");
      await loadOffers();
      renderDashboardStats();
    } catch (err) {
      errEl.textContent = "Couldn't save: " + (err.message || "unknown error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Offer";
    }
  }

  function initOfferForm() {
    $("#addOfferBtn").addEventListener("click", () => openOfferForm(null));
    $("#offerFormCloseBtn").addEventListener("click", closeOfferForm);
    $("#offerFormOverlay").addEventListener("click", (e) => {
      if (e.target.id === "offerFormOverlay") closeOfferForm();
    });
    $("#offerForm").addEventListener("submit", submitOfferForm);
    $("#ofDescription").addEventListener("input", () => clearInvalidField("ofDescription"));
    $("#ofPrice").addEventListener("input", () => clearInvalidField("ofPrice"));
    $("#ofActive").addEventListener("click", () => {
      const btn = $("#ofActive");
      const next = btn.dataset.available !== "true";
      btn.dataset.available = next ? "true" : "false";
      btn.textContent = next ? "🟢 Active" : "🔴 Inactive";
    });
    wireImagePicker({
      fileInputId: "#ofImageFile",
      pickBtnId: "#ofImagePickBtn",
      removeBtnId: "#ofImageRemoveBtn",
      previewId: "#ofImagePreview",
      errorId: "#ofImageError",
      onChange: (url) => { state.offerImageUrl = url; },
    });
  }

  /* -----------------------------------------------------------------------
     Delete confirmation (shared by products + offers)
     ----------------------------------------------------------------------- */
  function openConfirmDelete(type, id, record) {
    state.deleteTarget = { type, id };
    $("#confirmTitle").textContent = type === "product" ? "Delete this product?" : "Delete this offer?";
    $("#confirmMessage").textContent = `"${record ? (record.name || record.title || record.description) : ""}" will be permanently removed. This can't be undone.`;
    $("#confirmOverlay").classList.add("is-open");
  }

  function closeConfirmDelete() {
    $("#confirmOverlay").classList.remove("is-open");
    state.deleteTarget = null;
  }

  async function performDelete() {
    if (!state.deleteTarget) return;
    const { type, id } = state.deleteTarget;
    const table = type === "product" ? "products" : "special_offers";
    try {
      const { error } = await client.from(table).delete().eq("id", id);
      if (error) throw error;
      closeConfirmDelete();
      showToast(type === "product" ? "Product deleted" : "Offer deleted");
      if (type === "product") await loadProducts();
      else await loadOffers();
      renderDashboardStats();
    } catch (err) {
      showToast("Couldn't delete: " + (err.message || "unknown error"));
    }
  }

  function initConfirmDelete() {
    $("#confirmCancelBtn").addEventListener("click", closeConfirmDelete);
    $("#confirmOverlay").addEventListener("click", (e) => {
      if (e.target.id === "confirmOverlay") closeConfirmDelete();
    });
    $("#confirmOkBtn").addEventListener("click", performDelete);
  }

  /* -----------------------------------------------------------------------
     Init
     ----------------------------------------------------------------------- */
  function init() {
    initAuth();
    initNav();
    initProductsListEvents();
    initOffersListEvents();
    initProductForm();
    initOfferForm();
    initConfirmDelete();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed for automated tests only — the admin panel itself never reads this.
  window.AdminApp = { validateImageFile, validateProductForm, validateOfferForm };
})();
