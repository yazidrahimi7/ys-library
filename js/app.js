/*
  ============================================================
  APP — renders the cards, the gallery, search and the Submit form.
  ============================================================
  Cards come from Notion (see lib/notion.js).
  - Website cards: the Submit form sends suggestions to api/submit.js,
    which adds them to Notion unpublished.
  - Gallery categories (`layout: "gallery"` in config.js): images in a
    masonry layout; the Submit button becomes Upload (api/upload.js).

  Sections in this file:
    1. Setup & state
    2. Sidebar
    3. Content (All / Featured / category / search results)
    4. Cards
    5. Gallery (masonry) + image viewer
    6. Loading skeleton
    7. Submit / upload form
    8. Loading cards
    9. Helpers
   10. Start
*/

/* ---------- 1. Setup & state ---------- */

const config = window.LIBRARY_CONFIG;
const allCategories = config.groups.flatMap((g) => g.categories);

// How many cards each category shows on the "All" page before "View all"
const PREVIEW_COUNT = 8;

// Show the loading skeleton only if cards take longer than this (ms)
const SKELETON_DELAY = 250;

const state = {
  cards: [],                                   // published cards from Notion
  loaded: false,                               // true once cards have loaded
  activeId: "all",                             // "all" or a category id
  query: "",                                   // search text
  openGroups: new Set(config.groups.filter((g) => g.open).map((g) => g.name)),
};

const $ = (sel) => document.querySelector(sel);
const nav = $("#nav");
const content = $("#content");
const sidebar = $("#sidebar");
const searchInput = $("#search");
const formDialog = $("#form-dialog");
const form = $("#submit-form");
const lightbox = $("#lightbox");

const activeCategory = () => allCategories.find((c) => c.id === state.activeId);
const isGallery = (cat) => cat?.layout === "gallery";

/* ---------- 2. Sidebar ---------- */

function renderNav() {
  nav.innerHTML = "";

  const all = navItem("All", state.activeId === "all" && !state.query);
  all.classList.add("nav-all");
  all.addEventListener("click", () => goTo("all"));
  nav.append(all);

  for (const group of config.groups) {
    const wrap = el("div", "nav-group" + (state.openGroups.has(group.name) ? " is-open" : ""));

    const header = navItem(group.name, false);
    header.setAttribute("aria-expanded", state.openGroups.has(group.name));
    header.append(icon("chevron-down", "nav-chevron"));
    header.addEventListener("click", () => {
      state.openGroups.has(group.name) ? state.openGroups.delete(group.name) : state.openGroups.add(group.name);
      wrap.classList.toggle("is-open");
      header.setAttribute("aria-expanded", wrap.classList.contains("is-open"));
    });

    const items = el("div", "nav-group-items");
    const inner = el("div");
    for (const cat of group.categories) {
      const item = navItem(cat.name, cat.id === state.activeId && !state.query);
      item.classList.add("nav-sub");
      item.addEventListener("click", () => goTo(cat.id));
      inner.append(item);
    }
    items.append(inner);
    wrap.append(header, items);
    nav.append(wrap);
  }
}

function navItem(label, active) {
  const btn = el("button", "nav-item" + (active ? " is-active" : ""));
  btn.append(el("span", "", label));
  return btn;
}

function goTo(id) {
  closeSidebar();
  searchInput.value = "";
  state.query = "";
  if (location.hash === "#" + id) render();
  else location.hash = id;
}

// Tablet/mobile: the sidebar slides in from the menu button
function openSidebar() { sidebar.classList.add("is-open"); }
function closeSidebar() { sidebar.classList.remove("is-open"); }

// The Submit buttons say "Upload" on gallery pages
function updateCtaLabels() {
  const upload = isGallery(activeCategory());
  document.querySelectorAll("[data-cta-label]").forEach((n) => (n.textContent = upload ? "Upload" : "Submit"));
  $(".submit-btn").setAttribute("aria-label", upload ? "Upload a screenshot" : "Submit a website");
}

/* ---------- 3. Content ---------- */

function renderContent() {
  if (!state.loaded) return;   // the skeleton (section 6) shows while loading
  content.innerHTML = "";

  // Search results
  if (state.query) {
    const results = sortCards(state.cards.filter((c) => matches(c, state.query)));
    document.title = `Search · ${config.siteName}`;
    content.append(section(`Results for “${state.query}”`, results, {
      note: `${results.length} result${results.length === 1 ? "" : "s"}`,
      empty: "Nothing matches your search.",
    }));
    return;
  }

  // "All": Featured (cards tagged "Featured" in Notion) + a preview of every category
  if (state.activeId === "all") {
    document.title = config.siteName;
    const featured = sortCards(state.cards.filter(isFeatured));
    if (featured.length) content.append(section("Featured", featured));

    for (const cat of allCategories) {
      const cards = cardsFor(cat.id);
      if (!cards.length) continue;
      const more = cards.length > PREVIEW_COUNT ? cat.id : null;
      content.append(section(cat.name, cards.slice(0, PREVIEW_COUNT), { viewAll: more, gallery: isGallery(cat) }));
    }

    if (!state.cards.length) {
      content.append(section("All", [], { empty: "Nothing here yet." }));
    }
    return;
  }

  // One category
  const cat = activeCategory();
  document.title = `${cat.name} · ${config.siteName}`;
  content.append(section(cat.name, cardsFor(cat.id), {
    empty: `Nothing in ${cat.name} yet.`,
    gallery: isGallery(cat),
  }));
}

// A heading + cards. Options: note, empty (message), viewAll (category id),
// gallery (true → masonry of images instead of website cards)
function section(title, cards, { note, empty, viewAll, gallery } = {}) {
  const wrap = el("section", "section");

  // Title row: heading on the left, "View all" on the right (when there are more)
  const head = el("div", "section-head");
  head.append(el("h2", "section-title", title));
  if (viewAll) {
    const link = el("a", "view-all", "View all");
    link.href = "#" + viewAll;
    link.append(icon("arrow-right"));
    head.append(link);
  }
  wrap.append(head);
  if (note) wrap.append(el("p", "section-note", note));

  if (!cards.length) {
    const box = el("div", "empty");
    box.append(el("p", "", empty || "Nothing here yet."));
    const btn = el("button", "btn btn-primary", gallery ? "Upload a screenshot" : "Suggest a website");
    btn.prepend(icon("plus"));
    btn.addEventListener("click", () => openForm());
    box.append(btn);
    wrap.append(box);
    return wrap;
  }

  if (gallery) {
    wrap.append(masonry(cards));
  } else {
    const grid = el("div", "grid");
    cards.forEach((c) => grid.append(cardEl(c, cards)));
    wrap.append(grid);
  }
  return wrap;
}

/* ---------- 4. Cards ---------- */

// `list` is the set of cards shown with it, for the image viewer's arrows
function cardEl(item, list = [item]) {
  const card = el("article", "card");

  // Image: the Notion "thumbnail" link if set, otherwise an automatic
  // screenshot of the website (see api/thumb.js). Grey box if neither loads.
  card.append(imageEl("card-thumb", item.thumbnail || `api/thumb?id=${encodeURIComponent(item.id)}`));

  // The title link stretches over the whole card (see .card-link in CSS), so
  // clicking anywhere opens the website in a new tab — or, for an uploaded
  // image with no website, opens it enlarged.
  const title = el("h3", "card-title");
  const link = el("a", "card-link", displayTitle(item.title));
  if (item.url) {
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
  } else {
    const images = list.filter((c) => !c.url);
    link.href = "#";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openLightbox(images, images.indexOf(item));
    });
  }
  title.append(link);
  card.append(title);

  if (item.description) card.append(el("p", "card-desc", item.description));
  return card;
}

// An <img> that shimmers until it loads, and becomes a grey box if it fails
function imageEl(className, src) {
  const img = el("img", `${className} is-loading`);
  img.src = src;
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("load", () => img.classList.remove("is-loading"), { once: true });
  img.addEventListener("error", () => img.replaceWith(el("div", className)), { once: true });
  return img;
}

function cardsFor(categoryId) {
  return sortCards(state.cards.filter((c) => c.categories.includes(categoryId)));
}

// Order: ⭐ in the title first, then by Notion "order" (empty = last), then newest.
function sortCards(cards) {
  return [...cards].sort(
    (a, b) =>
      isStarred(b) - isStarred(a) ||
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      b.createdAt - a.createdAt
  );
}

function isStarred(card) {
  return card.title.includes("⭐") ? 1 : 0;
}

// Tagged with config.featuredTag (e.g. "Featured") in Notion's "type" column
function isFeatured(card) {
  const tag = config.featuredTag.toLowerCase();
  return card.types.some((t) => t.toLowerCase() === tag);
}

// The ⭐ only pins a card to the top of its lists — don't show it in the title
function displayTitle(title) {
  return title.replace(/⭐/g, "").trim();
}

// Search looks at the title, description, link and categories
function matches(card, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = [card.title, card.description, card.url, ...card.types].join(" ").toLowerCase();
  return words.every((w) => text.includes(w));
}

/* ---------- 5. Gallery (masonry) + image viewer ---------- */

// Columns of images; how many is set by --gallery-columns in the CSS
// (4 desktop, 3 tablet, 2 phone). Images fill the columns left to right.
function masonry(items) {
  const count = galleryColumns();
  const wrap = el("div", "masonry");
  const columns = Array.from({ length: count }, () => wrap.appendChild(el("div", "masonry-col")));

  items.forEach((item, i) => {
    const shot = el("button", "shot");
    shot.setAttribute("aria-label", `View ${displayTitle(item.title)}`);
    shot.append(imageEl("shot-img", item.thumbnail));
    shot.addEventListener("click", () => openLightbox(items, i));
    columns[i % count].append(shot);
  });
  return wrap;
}

function galleryColumns() {
  return Number(getComputedStyle(document.documentElement).getPropertyValue("--gallery-columns")) || 4;
}

// Re-arrange galleries when the screen size changes the number of columns
let lastColumns = galleryColumns();
window.addEventListener("resize", () => {
  if (galleryColumns() !== lastColumns) {
    lastColumns = galleryColumns();
    renderContent();
    drawIcons();
  }
});

// Image viewer: one image enlarged, with previous / next
const viewer = { items: [], index: 0 };

function openLightbox(items, index) {
  viewer.items = items;
  showImage(index);
  if (!lightbox.open) lightbox.showModal();
}

function showImage(index) {
  const n = viewer.items.length;
  viewer.index = (index + n) % n;   // wrap around at either end
  const item = viewer.items[viewer.index];
  $("#lightbox-img").src = item.thumbnail;
  $("#lightbox-img").alt = displayTitle(item.title);
  $("#lightbox-caption").textContent = [displayTitle(item.title), item.description].filter(Boolean).join(" — ");
  lightbox.classList.toggle("is-single", n < 2);
}

$("#lightbox-prev").addEventListener("click", () => showImage(viewer.index - 1));
$("#lightbox-next").addEventListener("click", () => showImage(viewer.index + 1));
lightbox.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") showImage(viewer.index - 1);
  if (e.key === "ArrowRight") showImage(viewer.index + 1);
});
// Clicking the dark area around the image closes it
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox || e.target.classList.contains("lightbox-figure")) lightbox.close();
});

/* ---------- 6. Loading skeleton ---------- */

// Grey placeholder cards, shown only if cards take a while to load
function renderSkeleton() {
  if (state.loaded) return;
  content.innerHTML = "";
  const gallery = isGallery(activeCategory());
  const sections = state.activeId === "all" ? 2 : 1;

  for (let s = 0; s < sections; s++) {
    const wrap = el("section", "section");
    wrap.setAttribute("aria-hidden", "true");
    wrap.append(el("div", "skeleton skeleton-title"));

    if (gallery) {
      const fake = Array.from({ length: 8 }, (_, i) => ({ h: [320, 420, 260, 380][i % 4] }));
      const count = galleryColumns();
      const grid = el("div", "masonry");
      const cols = Array.from({ length: count }, () => grid.appendChild(el("div", "masonry-col")));
      fake.forEach((f, i) => {
        const box = el("div", "skeleton");
        box.style.height = f.h + "px";
        cols[i % count].append(box);
      });
      wrap.append(grid);
    } else {
      const grid = el("div", "grid");
      for (let i = 0; i < 4; i++) {
        const card = el("div", "card skeleton-card");
        card.append(el("div", "skeleton card-thumb"), el("div", "skeleton skeleton-line"), el("div", "skeleton skeleton-line short"));
        grid.append(card);
      }
      wrap.append(grid);
    }
    content.append(wrap);
  }
}

/* ---------- 7. Submit / upload form ---------- */

// Website categories only — gallery images are added with Upload instead.
// Option values are the category names, which match the Notion "type" tags.
function fillCategorySelect() {
  const select = $("#category-select");
  for (const group of config.groups) {
    const og = document.createElement("optgroup");
    og.label = group.name;
    for (const cat of group.categories.filter((c) => !isGallery(c))) {
      const opt = el("option", "", cat.name);
      opt.value = cat.name;
      og.append(opt);
    }
    if (og.children.length) select.append(og);
  }
}

const formMode = () => (isGallery(activeCategory()) ? "upload" : "website");
let pickedImage = null;   // the File chosen in upload mode

function openForm() {
  closeSidebar();
  showForm();
  formDialog.showModal();
  if (formMode() === "website") {
    form.url.focus();
    showQuotaNote();
  }
}

// Reset the form for the current mode and show it (instead of "Thanks")
function showForm() {
  form.reset();
  const mode = formMode();
  form.dataset.mode = mode;
  form.querySelectorAll("[data-only]").forEach((n) => (n.hidden = n.dataset.only !== mode));

  if (mode === "upload") {
    $("#form-title").textContent = "Upload a screenshot";
    $("#send-btn").textContent = "Upload";
    $("#title-input").placeholder = "Optional";
    $("#password-field").hidden = Boolean(savedPassword());
    setPickedImage(null);
  } else {
    $("#form-title").textContent = "Submit a website";
    $("#send-btn").textContent = "Submit";
    $("#title-input").placeholder = "Leave empty to use the domain name";
    const active = activeCategory();
    if (active && !isGallery(active)) form.type.value = active.name;
  }
  setMessage("");
  form.hidden = false;
  $("#thanks").hidden = true;
}

function setMessage(text, isError = false) {
  const msg = $("#form-message");
  msg.textContent = text;
  msg.classList.toggle("is-error", isError);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = form.dataset.mode;
  const sendBtn = $("#send-btn");
  const label = sendBtn.textContent;

  try {
    sendBtn.disabled = true;
    setMessage("");
    if (mode === "upload") {
      sendBtn.textContent = "Uploading…";
      await uploadImage();
      showThanks("Uploaded!", "Your screenshot is in the gallery now.");
    } else {
      sendBtn.textContent = "Sending…";
      await submitWebsite();
      showThanks("Thanks!", "Your suggestion was sent. It will appear on the site once it's reviewed.");
    }
  } catch (err) {
    setMessage(err.message || "Something went wrong. Please try again.", true);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = label;
  }
});

function showThanks(title, text) {
  $("#thanks-title").textContent = title;
  $("#thanks-text").textContent = text;
  form.hidden = true;
  $("#thanks").hidden = false;
}

async function submitWebsite() {
  const data = Object.fromEntries(new FormData(form));
  data.url = normalizeUrl(data.url);
  if (data.thumbnail) data.thumbnail = normalizeUrl(data.thumbnail);
  if (!data.url) throw new Error("Please enter the website link.");

  const res = await fetch("api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const reply = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(reply.error || submitErrorFor(res.status));
}

async function uploadImage() {
  if (!pickedImage) throw new Error("Please choose an image.");
  const password = $("#password-input").value || savedPassword();
  if (!password) throw new Error("Please enter your password.");

  const image = await shrinkImage(pickedImage);
  const res = await fetch("api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Password": password },
    body: JSON.stringify({
      image,
      title: $("#title-input").value,
      description: form.querySelector("[name=description]").value,
    }),
  });
  const reply = await res.json().catch(() => ({}));

  if (res.status === 401) {
    savePassword("");                 // forget a wrong password and ask again
    $("#password-field").hidden = false;
    throw new Error("That password isn't right.");
  }
  if (!res.ok) throw new Error(reply.error || submitErrorFor(res.status));

  savePassword(password);
  // Show it right away (the card list from Notion refreshes within a minute)
  state.cards.push(prepareCard(reply.card));
  renderContent();
  drawIcons();
}

// Phone screenshots can be several MB; make a JPEG at most 1200px wide
// (and 4000px tall) so uploads are quick and fit Vercel's size limit.
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't an image this browser can read."));
      i.src = url;
    });
    const scale = Math.min(1, 1200 / img.naturalWidth, 4000 / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL("image/jpeg", 0.85);
    if (data.length > 3_500_000) data = canvas.toDataURL("image/jpeg", 0.7);
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Show the chosen image in the picker
let previewUrl = null;
function setPickedImage(file) {
  pickedImage = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = file ? URL.createObjectURL(file) : null;
  $("#image-preview").hidden = !file;
  $("#image-hint").hidden = Boolean(file);
  if (file) $("#image-preview").src = previewUrl;
  else $("#image-preview").removeAttribute("src");
}
$("#image-input").addEventListener("change", (e) => setPickedImage(e.target.files[0] || null));

// The password is remembered in this browser only, after it works once
function savedPassword() {
  try { return localStorage.getItem("uploadPassword") || ""; } catch { return ""; }
}
function savePassword(password) {
  try { password ? localStorage.setItem("uploadPassword", password) : localStorage.removeItem("uploadPassword"); } catch {}
}

// Message for errors that don't come with one (e.g. no API when running locally)
function submitErrorFor(status) {
  if (status === 404 || status === 405 || status === 501) {
    return "This only works on the live site.";
  }
  return "Something went wrong. Please try again.";
}

$("#submit-another").addEventListener("click", () => {
  showForm();
  if (formMode() === "website") form.url.focus();
});

// Small warning when screenshots for preview images are running low
// (see api/quota.js). Checked once per page visit; nothing shows if unknown.
let quotaRequest = null;
async function showQuotaNote() {
  quotaRequest ||= fetch("api/quota").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const quota = await quotaRequest;
  const note = $("#quota-note");
  if (!quota || !quota.low) return (note.hidden = true);

  const back = quota.resetAt ? ` They're back ${timeFromNow(quota.resetAt)}.` : "";
  $("#quota-text").textContent = quota.out
    ? `Preview screenshots are paused for today, so your submission's image will be added later.${back}`
    : `Only ${quota.remaining} preview screenshot${quota.remaining === 1 ? "" : "s"} left today — images for new submissions may be added later.`;
  note.hidden = false;
}

// e.g. "in about 3 hours" / "in a few minutes"
function timeFromNow(ms) {
  const hours = Math.round((ms - Date.now()) / 3600000);
  if (hours >= 2) return `in about ${hours} hours`;
  if (hours === 1) return "in about an hour";
  return "in a few minutes";
}

/* ---------- 8. Loading cards ---------- */

// Where cards come from, tried in order:
//   1. api/cards      — live from Notion (on Vercel, see api/cards.js)
//   2. data/cms.json  — saved copy from `npm run sync` (used when running locally)
const CARD_SOURCES = ["api/cards", "data/cms.json"];

async function loadCards() {
  const cards = await fetchFirstWorking(CARD_SOURCES);
  state.cards = cards.map(prepareCard);
}

// Each Notion "type" tag is matched to a category by name, e.g. "Web" → #web.
function prepareCard(c) {
  const byName = (name) =>
    allCategories.find((cat) => cat.name.toLowerCase() === name.toLowerCase() || cat.id === name.toLowerCase());
  return {
    ...c,
    categories: c.types.map(byName).filter(Boolean).map((cat) => cat.id),
    createdAt: Date.parse(c.createdAt) || 0,
  };
}

async function fetchFirstWorking(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const { cards } = await res.json();
      if (Array.isArray(cards)) return cards;
    } catch {
      // Not available here (or not JSON) — try the next source
    }
  }
  console.warn("No cards available");
  return [];
}

/* ---------- 9. Helpers ---------- */

// Create an element with an optional class and text.
function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// A Feather icon by name (see https://feathericons.com)
function icon(name, className = "") {
  const i = document.createElement("i");
  i.dataset.feather = name;
  if (className) i.dataset.class = className;
  return i;
}

// Turn every <i data-feather="..."> into its SVG icon
function drawIcons() {
  if (!window.feather) return;
  document.querySelectorAll("i[data-feather]").forEach((i) => {
    const extra = i.dataset.class ? { class: `feather feather-${i.dataset.feather} ${i.dataset.class}` } : {};
    i.outerHTML = feather.icons[i.dataset.feather].toSvg(extra);
  });
}

// "example.com" -> "https://example.com"
function normalizeUrl(value = "") {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : "https://" + v;
}

// Read the active category from the address (#all, #web, #figma, ...)
function readHash() {
  const id = location.hash.slice(1);
  state.activeId = allCategories.some((c) => c.id === id) ? id : "all";

  // Open the group that holds the active category
  const group = config.groups.find((g) => g.categories.some((c) => c.id === state.activeId));
  if (group) state.openGroups.add(group.name);
}

function render() {
  renderNav();
  renderContent();
  updateCtaLabels();
  drawIcons();
}

/* ---------- 10. Start ---------- */

function fillStaticText() {
  document.querySelectorAll("[data-text]").forEach((n) => {
    const [section, key] = n.dataset.text.split(".");
    n.textContent = config[section][key];
  });
  searchInput.placeholder = config.searchPlaceholder;
}

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim();
  render();
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchInput.value = "";
    state.query = "";
    render();
  }
});

document.querySelectorAll("[data-open-submit]").forEach((b) => b.addEventListener("click", () => openForm()));
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close())
);
// Close the form when clicking the dark backdrop
formDialog.addEventListener("click", (e) => {
  const r = formDialog.getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (e.target === formDialog && outside) formDialog.close();
});

$("#menu-btn").addEventListener("click", openSidebar);
$("#sidebar-close").addEventListener("click", closeSidebar);
$("#sidebar-backdrop").addEventListener("click", closeSidebar);

window.addEventListener("hashchange", () => {
  readHash();
  if (state.loaded) render();
  else { renderNav(); updateCtaLabels(); renderSkeleton(); drawIcons(); }
  window.scrollTo({ top: 0 });
});

(async function start() {
  fillStaticText();
  fillCategorySelect();
  readHash();
  render();           // show the layout right away
  const skeleton = setTimeout(renderSkeleton, SKELETON_DELAY);
  await loadCards();
  clearTimeout(skeleton);
  state.loaded = true;
  render();           // then fill in the cards
})();
