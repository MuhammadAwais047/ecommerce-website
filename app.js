/* ============================================================
   NovaShop — vanilla JS demo storefront
   Data: DummyJSON (https://dummyjson.com/products) — free, no key
   Cart persists in localStorage. Checkout is a demo (no network).
   ============================================================ */
"use strict";

const API_BASE = "https://dummyjson.com/products";
const CART_KEY = "novashop.cart.v1";
const SHIPPING_FLAT = 4.99;
const FREE_SHIPPING_OVER = 50;
const MAX_QTY = 99;

const $ = (id) => document.getElementById(id);

const els = {
  search: $("search-input"),
  cartBtn: $("cart-btn"),
  cartCount: $("cart-count"),
  categorySelect: $("category-select"),
  sortSelect: $("sort-select"),
  priceMin: $("price-min"),
  priceMax: $("price-max"),
  clearFilters: $("clear-filters"),
  resultCount: $("result-count"),
  errorBanner: $("error-banner"),
  grid: $("grid"),
  emptyState: $("empty-state"),
  quickview: $("quickview"),
  qvImg: $("qv-img"),
  qvCategory: $("qv-category"),
  qvTitle: $("qv-title"),
  qvRating: $("qv-rating"),
  qvDesc: $("qv-desc"),
  qvStock: $("qv-stock"),
  qvPrice: $("qv-price"),
  qvStepper: $("qv-stepper"),
  qvAdd: $("qv-add"),
  cartBackdrop: $("cart-backdrop"),
  cartDrawer: $("cart-drawer"),
  cartClose: $("cart-close"),
  browseBtn: $("browse-btn"),
  cartItems: $("cart-items"),
  cartEmpty: $("cart-empty"),
  cartFoot: $("cart-foot"),
  drawerCount: $("drawer-count"),
  totSubtotal: $("tot-subtotal"),
  totShipping: $("tot-shipping"),
  shipHint: $("ship-hint"),
  totTotal: $("tot-total"),
  checkoutBtn: $("checkout-btn"),
  checkout: $("checkout"),
  checkoutForm: $("checkout-form"),
  coSummary: $("co-summary"),
  coError: $("co-error"),
  placeOrder: $("place-order"),
  success: $("success"),
  orderNumber: $("order-number"),
  successClose: $("success-close"),
  toasts: $("toasts"),
};

/* ---------------- State ---------------- */

const state = {
  products: [],
  categories: [],
  cart: loadCart(), // Map<id, qty>
  filters: { q: "", category: "", min: null, max: null, sort: "featured" },
  quickId: null,
  qvQty: 1,
};

const productMap = new Map();

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    if (!raw || typeof raw !== "object") return new Map();
    const map = new Map();
    for (const [id, qty] of Object.entries(raw)) {
      const n = parseInt(qty, 10);
      if (Number.isInteger(n) && n > 0) map.set(Number(id), Math.min(n, MAX_QTY));
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(state.cart)));
  } catch {
    /* storage unavailable — cart works for the session only */
  }
}

/* ---------------- Helpers ---------------- */

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (n) => fmt.format(n);

async function fetchJSON(url, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const starSVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">' +
  '<path d="M12 2l2.94 6.26 6.56.84-4.83 4.55 1.25 6.5L12 16.9l-5.92 3.25 1.25-6.5L2.5 9.1l6.56-.84z"/></svg>';

function ratingNode(value, count) {
  const wrap = document.createElement("span");
  wrap.className = "rating";
  wrap.innerHTML = starSVG;
  const num = document.createElement("span");
  num.textContent = `${Number(value).toFixed(1)}${count != null ? ` (${count})` : ""}`;
  wrap.append(num);
  return wrap;
}

function placeholderImg(title) {
  const hue = [...title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const letter = (title[0] || "?").toUpperCase();
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
    `<rect width='400' height='400' fill='hsl(${hue},45%,90%)'/>` +
    `<text x='50%' y='55%' font-size='150' text-anchor='middle' dominant-baseline='middle' ` +
    `font-family='sans-serif' font-weight='bold' fill='hsl(${hue},45%,55%)'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function attachImgFallback(img, title) {
  img.addEventListener("error", () => {
    img.removeEventListener("error", img.__fallback || (() => {}));
    img.src = placeholderImg(title);
  }, { once: true });
}

function showToast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  els.toasts.append(t);
  while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add("leaving");
    setTimeout(() => t.remove(), 320);
  }, 2400);
}

const prettyCategory = (c) =>
  c.split(/[-_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/* ---------------- Modal / drawer manager ---------------- */

let openDialog = null; // element currently open
let lastFocused = null;

function openLayer(el) {
  closeLayer();
  lastFocused = document.activeElement;
  el.hidden = false;
  if (el === els.cartDrawer) els.cartBackdrop.hidden = false;
  document.body.classList.add("no-scroll");
  openDialog = el === els.cartDrawer ? el : el.querySelector(".modal");
  const target =
    openDialog.querySelector("input, select, textarea, button:not(.modal-close)") ||
    openDialog.querySelector(".modal-close");
  if (target) target.focus();
}

function closeLayer() {
  if (!openDialog) return;
  const layerEl =
    openDialog === els.cartDrawer
      ? els.cartDrawer
      : openDialog.closest(".modal-backdrop");
  if (layerEl) layerEl.hidden = true;
  els.cartBackdrop.hidden = true;
  document.body.classList.remove("no-scroll");
  openDialog = null;
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}

document.addEventListener("keydown", (e) => {
  if (!openDialog) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeLayer();
    return;
  }
  if (e.key === "Tab" && openDialog) {
    const focusables = openDialog.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

document.querySelectorAll("[data-close]").forEach((btn) =>
  btn.addEventListener("click", closeLayer)
);

document.querySelectorAll(".modal-backdrop").forEach((backdrop) =>
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) closeLayer();
  })
);

els.cartBackdrop.addEventListener("mousedown", closeLayer);
els.cartClose.addEventListener("click", closeLayer);
els.browseBtn.addEventListener("click", () => {
  closeLayer();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
els.cartBtn.addEventListener("click", () => {
  renderCart();
  openLayer(els.cartDrawer);
});

/* ---------------- Data loading ---------------- */

async function init() {
  renderSkeletons();
  try {
    const [cats, products] = await Promise.all([
      fetchJSON("https://dummyjson.com/products/category-list"),
      fetchJSON(
        `${API_BASE}?limit=100&select=id,title,description,category,price,discountPercentage,rating,stock,brand,thumbnail`
      ),
    ]);
    state.categories = cats;
    state.products = products.products;
    state.products.forEach((p) => productMap.set(p.id, p));
    populateCategories();
    applyFilters();
  } catch {
    showError();
  }
}

function populateCategories() {
  state.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = prettyCategory(c);
    els.categorySelect.append(opt);
  });
}

function showError() {
  els.grid.textContent = "";
  els.errorBanner.textContent = "";
  const p = document.createElement("p");
  p.textContent = "Couldn't load products. Check your connection and try again.";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary";
  btn.textContent = "Retry";
  btn.addEventListener("click", () => {
    els.errorBanner.hidden = true;
    renderSkeletons();
    init();
  });
  els.errorBanner.append(p, btn);
  els.errorBanner.hidden = false;
}

function renderSkeletons() {
  els.grid.textContent = "";
  for (let i = 0; i < 8; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton-card";
    const img = document.createElement("div");
    img.className = "skeleton sk-img";
    sk.append(img);
    for (const w of ["", "w60", "w40"]) {
      const line = document.createElement("div");
      line.className = `skeleton sk-line ${w}`.trim();
      sk.append(line);
    }
    els.grid.append(sk);
  }
}

/* ---------------- Filtering ---------------- */

const refilter = () => applyFilters();
const debouncedSearch = debounce(refilter, 300);
const debouncedPrice = debounce(refilter, 450);

els.search.addEventListener("input", () => {
  state.filters.q = els.search.value.trim().toLowerCase();
  debouncedSearch();
});
els.categorySelect.addEventListener("change", () => {
  state.filters.category = els.categorySelect.value;
  applyFilters();
});
els.sortSelect.addEventListener("change", () => {
  state.filters.sort = els.sortSelect.value;
  applyFilters();
});
els.priceMin.addEventListener("input", () => {
  state.filters.min = parseFloat(els.priceMin.value);
  if (Number.isNaN(state.filters.min)) state.filters.min = null;
  debouncedPrice();
});
els.priceMax.addEventListener("input", () => {
  state.filters.max = parseFloat(els.priceMax.value);
  if (Number.isNaN(state.filters.max)) state.filters.max = null;
  debouncedPrice();
});
els.clearFilters.addEventListener("click", () => {
  state.filters = { q: "", category: "", min: null, max: null, sort: "featured" };
  els.search.value = "";
  els.categorySelect.value = "";
  els.sortSelect.value = "featured";
  els.priceMin.value = "";
  els.priceMax.value = "";
  applyFilters();
});

function getFiltered() {
  const { q, category, min, max, sort } = state.filters;
  let list = state.products.filter((p) => {
    if (category && p.category !== category) return false;
    if (min != null && p.price < min) return false;
    if (max != null && p.price > max) return false;
    if (q) {
      const hay = `${p.title} ${p.category} ${p.brand || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  switch (sort) {
    case "price-asc": list = [...list].sort((a, b) => a.price - b.price); break;
    case "price-desc": list = [...list].sort((a, b) => b.price - a.price); break;
    case "rating-desc": list = [...list].sort((a, b) => b.rating - a.rating); break;
    case "title-asc": list = [...list].sort((a, b) => a.title.localeCompare(b.title)); break;
  }
  return list;
}

function applyFilters() {
  const list = getFiltered();
  const { q, category, min, max, sort } = state.filters;
  const hasFilters = Boolean(q || category || min != null || max != null || sort !== "featured");

  els.resultCount.textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
  els.clearFilters.hidden = !hasFilters;
  els.emptyState.hidden = list.length !== 0;
  if (!list.length) els.grid.textContent = "";
  renderGrid(list);
}

/* ---------------- Product cards ---------------- */

function renderGrid(list) {
  els.grid.textContent = "";
  const frag = document.createDocumentFragment();
  list.forEach((p) => frag.push ? frag.append(cardNode(p)) : frag.append(cardNode(p)));
  els.grid.append(frag);
}

function originalPrice(p) {
  const d = p.discountPercentage || 0;
  if (d < 1) return null;
  return p.price / (1 - d / 100);
}

function qtyInCart(id) {
  return state.cart.get(id) || 0;
}

function createStepper(qty, { onMinus, onPlus, wide = false }) {
  const st = document.createElement("div");
  st.className = "stepper" + (wide ? " stepper--wide" : "");

  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  minus.setAttribute("aria-label", "Decrease quantity");
  minus.disabled = qty <= 1;
  minus.addEventListener("click", onMinus);

  const span = document.createElement("span");
  span.className = "qty";
  span.textContent = qty;

  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "Increase quantity");
  plus.addEventListener("click", onPlus);

  st.append(minus, span, plus);
  return st;
}

function cardNode(p) {
  const inCart = qtyInCart(p.id);
  const old = originalPrice(p);

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = p.id;

  const media = document.createElement("button");
  media.type = "button";
  media.className = "card-media";
  media.setAttribute("aria-label", `View ${p.title}`);
  const img = document.createElement("img");
  img.src = p.thumbnail;
  img.alt = p.title;
  img.loading = "lazy";
  attachImgFallback(img, p.title);
  media.append(img);
  if ((p.discountPercentage || 0) >= 5) {
    const badge = document.createElement("span");
    badge.className = "badge-off";
    badge.textContent = `-${Math.round(p.discountPercentage)}%`;
    media.append(badge);
  }
  media.addEventListener("click", () => openQuickView(p.id));

  const body = document.createElement("div");
  body.className = "card-body";

  const cat = document.createElement("p");
  cat.className = "card-cat";
  cat.textContent = prettyCategory(p.category);

  const title = document.createElement("button");
  title.type = "button";
  title.className = "card-title-btn";
  title.textContent = p.title;
  title.addEventListener("click", () => openQuickView(p.id));

  const priceRow = document.createElement("div");
  priceRow.className = "price-row";
  const price = document.createElement("span");
  price.className = "price";
  price.textContent = money(p.price);
  priceRow.append(price);
  if (old) {
    const oldEl = document.createElement("span");
    oldEl.className = "price-old";
    oldEl.textContent = money(old);
    priceRow.append(oldEl);
  }

  body.append(cat, title, ratingNode(p.rating), priceRow);

  if (p.stock === 0) {
    const note = document.createElement("p");
    note.className = "stock-note is-out";
    note.textContent = "Out of stock";
    body.append(note);
  } else if (p.stock < 10) {
    const note = document.createElement("p");
    note.className = "stock-note";
    note.textContent = `Only ${p.stock} left`;
    body.append(note);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";
  if (p.stock === 0) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-add";
    btn.disabled = true;
    btn.textContent = "Out of stock";
    actions.append(btn);
  } else if (inCart > 0) {
    actions.append(createStepper(inCart, {
      onMinus: () => setQty(p.id, inCart - 1),
      onPlus: () => setQty(p.id, inCart + 1),
    }));
  } else {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-add";
    btn.textContent = "Add to cart";
    btn.addEventListener("click", () => addToCart(p.id, 1));
    actions.append(btn);
  }

  card.append(media, body, actions);
  return card;
}

/* ---------------- Cart operations ---------------- */

function addToCart(id, qty) {
  const p = productMap.get(id);
  if (!p) return;
  const next = Math.min(qtyInCart(id) + qty, p.stock, MAX_QTY);
  state.cart.set(id, next);
  saveCart();
  refreshAfterCartChange();
  showToast(`Added ${next} × ${p.title} to cart`);
}

function setQty(id, qty) {
  const p = productMap.get(id);
  if (!p) return;
  if (qty <= 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, Math.min(qty, p.stock, MAX_QTY));
  }
  saveCart();
  refreshAfterCartChange();
}

function refreshAfterCartChange() {
  updateBadge();
  applyFilters(); // re-renders card steppers
  if (els.cartDrawer && !els.cartDrawer.hidden) renderCart();
}

function updateBadge() {
  const total = [...state.cart.values()].reduce((a, b) => a + b, 0);
  els.cartCount.textContent = total;
  els.cartCount.hidden = total === 0;
  els.checkoutBtn.disabled = total === 0;
}

function cartTotals() {
  let subtotal = 0;
  for (const [id, qty] of state.cart) {
    const p = productMap.get(id);
    if (p) subtotal += p.price * qty;
  }
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  return { subtotal, shipping, total: subtotal + shipping };
}

/* ---------------- Cart drawer ---------------- */

function renderCart() {
  els.cartItems.textContent = "";
  const entries = [...state.cart.entries()];
  const count = entries.reduce((a, [, q]) => a + q, 0);

  els.drawerCount.textContent = count ? `(${count} item${count === 1 ? "" : "s"})` : "";
  const isEmpty = entries.length === 0;
  els.cartEmpty.hidden = !isEmpty;
  els.cartFoot.hidden = isEmpty;
  els.cartItems.hidden = isEmpty;

  if (isEmpty) return;

  for (const [id, qty] of entries) {
    const p = productMap.get(id);
    if (!p) continue;
    const line = document.createElement("div");
    line.className = "cart-line";

    const img = document.createElement("img");
    img.src = p.thumbnail;
    img.alt = "";
    attachImgFallback(img, p.title);

    const info = document.createElement("div");
    info.className = "cl-info";
    const title = document.createElement("p");
    title.className = "cl-title";
    title.textContent = p.title;
    const unit = document.createElement("p");
    unit.className = "cl-price";
    unit.textContent = `${money(p.price)} each`;
    info.append(title, unit, createStepper(qty, {
      onMinus: () => setQty(id, qty - 1),
      onPlus: () => setQty(id, qty + 1),
    }));

    const right = document.createElement("div");
    right.className = "cl-right";
    const total = document.createElement("span");
    total.className = "cl-total";
    total.textContent = money(p.price * qty);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => setQty(id, 0));
    right.append(total, remove);

    line.append(img, info, right);
    els.cartItems.append(line);
  }

  const { subtotal, shipping, total } = cartTotals();
  els.totSubtotal.textContent = money(subtotal);
  els.totShipping.textContent = shipping === 0 ? "Free" : money(shipping);
  els.totTotal.textContent = money(total);
  if (subtotal < FREE_SHIPPING_OVER) {
    els.shipHint.textContent = `Add ${money(FREE_SHIPPING_OVER - subtotal)} more for free shipping`;
  } else {
    els.shipHint.textContent = "You unlocked free shipping 🎉";
  }
}

/* ---------------- Quick view ---------------- */

function openQuickView(id) {
  const p = productMap.get(id);
  if (!p) return;
  state.quickId = id;
  state.qvQty = Math.max(1, qtyInCart(id) || 1);

  els.qvImg.src = p.thumbnail;
  els.qvImg.alt = p.title;
  attachImgFallback(els.qvImg, p.title);
  els.qvCategory.textContent = prettyCategory(p.category);
  els.qvTitle.textContent = p.title;
  els.qvDesc.textContent = p.description;
  els.qvPrice.textContent = money(p.price);

  els.qvRating.textContent = "";
  els.qvRating.append(ratingNode(p.rating));

  els.qvStock.className = "qv-stock";
  if (p.stock === 0) {
    els.qvStock.textContent = "Out of stock";
    els.qvStock.classList.add("out");
  } else if (p.stock < 10) {
    els.qvStock.textContent = `Only ${p.stock} left in stock`;
    els.qvStock.classList.add("low");
  } else {
    els.qvStock.textContent = `In stock (${p.stock} available)`;
  }

  renderQvBuyRow();
  openLayer(els.quickview);
}

function renderQvBuyRow() {
  const p = productMap.get(state.quickId);
  if (!p) return;
  const out = p.stock === 0;

  els.qvStepper.textContent = "";
  els.qvAdd.disabled = out;
  els.qvAdd.textContent = out ? "Out of stock" : "Add to cart";

  if (out) return;

  state.qvQty = Math.min(Math.max(1, state.qvQty), p.stock, MAX_QTY);
  els.qvStepper.append(createStepper(state.qvQty, {
    wide: true,
    onMinus: () => { state.qvQty = Math.max(1, state.qvQty - 1); renderQvBuyRow(); },
    onPlus: () => { state.qvQty = Math.min(state.qvQty + 1, p.stock, MAX_QTY); renderQvBuyRow(); },
  }));
}

els.qvAdd.addEventListener("click", () => {
  if (state.quickId == null) return;
  addToCart(state.quickId, state.qvQty);
  closeLayer();
});

/* ---------------- Checkout ---------------- */

els.checkoutBtn.addEventListener("click", () => {
  if (state.cart.size === 0) return;
  renderCheckoutSummary();
  closeLayer();
  openLayer(els.checkout);
});

function renderCheckoutSummary() {
  const { subtotal, shipping, total } = cartTotals();
  const count = [...state.cart.values()].reduce((a, b) => a + b, 0);
  els.coSummary.textContent = "";

  const mk = (label, value, strong = false) => {
    const row = document.createElement("div");
    row.className = "tot-row";
    const l = document.createElement("span");
    l.textContent = label;
    const r = document.createElement("span");
    r.textContent = value;
    if (strong) r.style.color = "var(--text)";
    row.append(l, r);
    return row;
  };

  els.coSummary.append(
    mk(`${count} item${count === 1 ? "" : "s"}`, money(subtotal)),
    mk("Shipping", shipping === 0 ? "Free" : money(shipping)),
    mk("Total", money(total), true)
  );
}

const fields = {
  name: { input: $("co-name"), error: $("err-name") },
  email: { input: $("co-email"), error: $("err-email") },
  address: { input: $("co-address"), error: $("err-address") },
  city: { input: $("co-city"), error: $("err-city") },
  zip: { input: $("co-zip"), error: $("err-zip") },
  card: { input: $("co-card"), error: $("err-card") },
  expiry: { input: $("co-expiry"), error: $("err-expiry") },
  cvc: { input: $("co-cvc"), error: $("err-cvc") },
};

function setFieldError(field, hasError) {
  field.input.classList.toggle("invalid", hasError);
  field.error.hidden = !hasError;
}

Object.values(fields).forEach(({ input }) =>
  input.addEventListener("input", () => {
    input.classList.remove("invalid");
    const err = input.closest(".field")?.querySelector(".field-error");
    if (err) err.hidden = true;
    els.coError.hidden = true;
  })
);

/* Card number: group digits in blocks of 4 */
fields.card.input.addEventListener("input", () => {
  const digits = fields.card.input.value.replace(/\D/g, "").slice(0, 19);
  fields.card.input.value = digits.replace(/(.{4})/g, "$1 ").trim();
});

/* Expiry: auto MM/YY */
fields.expiry.input.addEventListener("input", () => {
  let v = fields.expiry.input.value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
  fields.expiry.input.value = v;
});

function validateCheckout() {
  let firstInvalid = null;
  const check = (key, ok) => {
    setFieldError(fields[key], !ok);
    if (!ok && !firstInvalid) firstInvalid = fields[key].input;
    return ok;
  };

  const v = (key) => fields[key].input.value.trim();

  check("name", v("name").length >= 2);
  check("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email")));
  check("address", v("address").length >= 5);
  check("city", v("city").length >= 2);
  check("zip", v("zip").length >= 3);

  const cardDigits = v("card").replace(/\D/g, "");
  check("card", cardDigits.length >= 13 && cardDigits.length <= 19);

  const expMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v("expiry"));
  let expOk = false;
  if (expMatch) {
    const month = parseInt(expMatch[1], 10);
    const year = 2000 + parseInt(expMatch[2], 10);
    const now = new Date();
    expOk = year > now.getFullYear() ||
      (year === now.getFullYear() && month >= now.getMonth() + 1);
  }
  check("expiry", expOk);

  check("cvc", /^\d{3,4}$/.test(v("cvc")));

  return firstInvalid;
}

els.checkoutForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const firstInvalid = validateCheckout();
  if (firstInvalid) {
    els.coError.hidden = false;
    firstInvalid.focus();
    return;
  }
  els.coError.hidden = true;

  const orderNo = `NS-${String(Date.now()).slice(-6)}`;
  state.cart.clear();
  saveCart();
  updateBadge();
  applyFilters();
  els.checkoutForm.reset();

  els.orderNumber.textContent = orderNo;
  closeLayer();
  openLayer(els.success);
});

els.successClose.addEventListener("click", () => {
  closeLayer();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------------- Init ---------------- */

updateBadge();
init();
