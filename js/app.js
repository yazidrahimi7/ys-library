/*
  ============================================================
  APP — renders the cards and handles search + the Submit form.
  ============================================================
  Cards come from Notion (see lib/notion.js). The Submit form sends
  suggestions to api/submit.js, which adds them to Notion unpublished.

  Sections in this file:
    1. Setup & state
    2. Sidebar
    3. Content (All / Featured / category / search results)
    4. Cards
    5. Submit form
    6. Loading cards
    7. Helpers
    8. Start
*/

/* ---------- 1. Setup & state ---------- */

const config = window.LIBRARY_CONFIG;
const allCategories = config.groups.flatMap((g) => g.categories);

// How many cards each category shows on the "All" page before "View all"
const PREVIEW_COUNT = 8;

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

/* ---------- 3. Content ---------- */

function renderContent() {
  content.innerHTML = "";
  if (!state.loaded) return;   // avoid flashing "Nothing here yet" while loading

  // Search results
  if (state.query) {
    const results = sortCards(state.cards.filter((c) => matches(c, state.query)));
    document.title = `Search · ${config.siteName}`;
    content.append(section(`Results for “${state.query}”`, results, {
      note: `${results.length} website${results.length === 1 ? "" : "s"}`,
      empty: "No websites match your search.",
    }));
    return;
  }

  // "All": Featured (⭐ cards) + a preview of every category that has cards
  if (state.activeId === "all") {
    document.title = config.siteName;
    const featured = sortCards(state.cards.filter(isStarred));
    if (featured.length) content.append(section("Featured", featured));

    for (const cat of allCategories) {
      const cards = cardsFor(cat.id);
      if (!cards.length) continue;
      const more = cards.length > PREVIEW_COUNT ? cat.id : null;
      content.append(section(cat.name, cards.slice(0, PREVIEW_COUNT), { viewAll: more }));
    }

    if (!state.cards.length) {
      content.append(section("All", [], { empty: "Nothing here yet." }));
    }
    return;
  }

  // One category
  const cat = allCategories.find((c) => c.id === state.activeId);
  document.title = `${cat.name} · ${config.siteName}`;
  content.append(section(cat.name, cardsFor(cat.id), { empty: `Nothing in ${cat.name} yet.` }));
}

// A heading + grid of cards. Options: note, empty (message), viewAll (category id)
function section(title, cards, { note, empty, viewAll } = {}) {
  const wrap = el("section", "section");
  const head = el("h2", "section-title", title);
  wrap.append(head);
  if (note) wrap.append(el("p", "section-note", note));

  if (!cards.length) {
    const box = el("div", "empty");
    box.append(el("p", "", empty || "Nothing here yet."));
    const btn = el("button", "btn btn-primary", "Suggest a website");
    btn.prepend(icon("plus"));
    btn.addEventListener("click", () => openForm());
    box.append(btn);
    wrap.append(box);
    return wrap;
  }

  const grid = el("div", "grid");
  cards.forEach((c) => grid.append(cardEl(c)));
  wrap.append(grid);

  if (viewAll) {
    const link = el("a", "btn btn-ghost view-all", "View all");
    link.href = "#" + viewAll;
    link.append(icon("arrow-right"));
    link.style.marginTop = "20px";
    wrap.append(link);
  }
  return wrap;
}

/* ---------- 4. Cards ---------- */

function cardEl(item) {
  const card = el("article", "card");

  // Image: the Notion "thumbnail" link if set, otherwise an automatic
  // screenshot of the website (see api/thumb.js). Grey box if neither loads.
  const img = el("img", "card-thumb");
  img.src = item.thumbnail || `api/thumb?id=${encodeURIComponent(item.id)}`;
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => img.replaceWith(el("div", "card-thumb")), { once: true });
  card.append(img);

  // The title link stretches over the whole card (see .card-link in CSS),
  // so clicking anywhere on the card opens the website in a new tab.
  const title = el("h3", "card-title");
  const link = el("a", "card-link", displayTitle(item.title));
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener";
  title.append(link);
  card.append(title);

  if (item.description) card.append(el("p", "card-desc", item.description));
  return card;
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

// The ⭐ only marks Featured cards — don't show it in the title
function displayTitle(title) {
  return title.replace(/⭐/g, "").trim();
}

// Search looks at the title, description, link and categories
function matches(card, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = [card.title, card.description, card.url, ...card.types].join(" ").toLowerCase();
  return words.every((w) => text.includes(w));
}

/* ---------- 5. Submit form ---------- */

// Option values are the category names, which match the Notion "type" tags.
function fillCategorySelect() {
  const select = $("#category-select");
  for (const group of config.groups) {
    const og = document.createElement("optgroup");
    og.label = group.name;
    for (const cat of group.categories) {
      const opt = el("option", "", cat.name);
      opt.value = cat.name;
      og.append(opt);
    }
    select.append(og);
  }
}

function openForm() {
  closeSidebar();
  showForm();
  formDialog.showModal();
  form.url.focus();
}

// Reset the form and show it (instead of the "Thanks" message)
function showForm() {
  form.reset();
  const active = allCategories.find((c) => c.id === state.activeId) || allCategories[0];
  form.type.value = active.name;
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

  const data = Object.fromEntries(new FormData(form));
  data.url = normalizeUrl(data.url);
  if (data.thumbnail) data.thumbnail = normalizeUrl(data.thumbnail);

  if (!data.url) return setMessage("Please enter the website link.", true);

  const sendBtn = $("#send-btn");
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending…";
  setMessage("");

  try {
    const res = await fetch("api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const reply = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(reply.error || submitErrorFor(res.status));

    form.hidden = true;
    $("#thanks").hidden = false;
  } catch (err) {
    setMessage(err.message || "Something went wrong. Please try again.", true);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Submit";
  }
});

// Message for errors that don't come with one (e.g. no API when running locally)
function submitErrorFor(status) {
  if (status === 404 || status === 405 || status === 501) {
    return "Submitting only works on the live site.";
  }
  return "Something went wrong. Please try again.";
}

$("#submit-another").addEventListener("click", () => {
  showForm();
  form.url.focus();
});

/* ---------- 6. Loading cards ---------- */

// Where cards come from, tried in order:
//   1. api/cards      — live from Notion (on Vercel, see api/cards.js)
//   2. data/cms.json  — saved copy from `npm run sync` (used when running locally)
const CARD_SOURCES = ["api/cards", "data/cms.json"];

// Each Notion "type" tag is matched to a category by name, e.g. "Web" → #web.
async function loadCards() {
  const cards = await fetchFirstWorking(CARD_SOURCES);
  const byName = (name) =>
    allCategories.find((c) => c.name.toLowerCase() === name.toLowerCase() || c.id === name.toLowerCase());

  state.cards = cards.map((c) => ({
    ...c,
    categories: c.types.map(byName).filter(Boolean).map((cat) => cat.id),
    createdAt: Date.parse(c.createdAt) || 0,
  }));
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

/* ---------- 7. Helpers ---------- */

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
  drawIcons();
}

/* ---------- 8. Start ---------- */

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
  render();
  window.scrollTo({ top: 0 });
});

(async function start() {
  fillStaticText();
  fillCategorySelect();
  readHash();
  render();           // show the layout right away
  await loadCards();
  state.loaded = true;
  render();           // then fill in the cards
})();
