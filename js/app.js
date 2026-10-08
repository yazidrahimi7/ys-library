/*
  ============================================================
  APP — renders the cards and handles the Submit form.
  ============================================================
  Cards come from Notion (see lib/notion.js). The Submit form sends
  suggestions to api/submit.js, which adds them to Notion unpublished.

  Sections in this file:
    1. Setup & state
    2. Rendering (sidebar, cards)
    3. Submit form
    4. Loading cards
    5. Helpers
    6. Start
*/

/* ---------- 1. Setup & state ---------- */

const config = window.LIBRARY_CONFIG;
const allCategories = config.groups.flatMap((g) => g.categories);

const state = {
  cards: [],                          // published cards from Notion
  activeId: allCategories[0].id,      // selected category
};

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const nav = $("#category-nav");
const formDialog = $("#form-dialog");
const form = $("#submit-form");

/* ---------- 2. Rendering ---------- */

function renderSidebar() {
  nav.innerHTML = "";
  for (const group of config.groups) {
    const wrap = el("div", "group");
    wrap.append(el("h3", "group-name", group.name));

    for (const cat of group.categories) {
      const count = cardsFor(cat.id).length;
      const btn = el("button", "cat" + (cat.id === state.activeId ? " is-active" : ""));
      btn.append(el("span", "", cat.name));
      if (count) btn.append(el("span", "cat-count", String(count)));
      btn.addEventListener("click", () => (location.hash = cat.id));
      wrap.append(btn);
    }
    nav.append(wrap);
  }
}

function renderGrid() {
  grid.innerHTML = "";

  const cat = allCategories.find((c) => c.id === state.activeId);
  $("#page-title").textContent = cat.title || cat.name;
  document.title = `${cat.name} · ${config.siteName}`;

  const cards = cardsFor(state.activeId);

  if (!cards.length) {
    const empty = el("div", "empty");
    empty.append(el("p", "", `Nothing in ${cat.name} yet.`));
    const btn = el("button", "btn btn-primary", "+ Suggest a website");
    btn.addEventListener("click", () => openForm());
    empty.append(btn);
    grid.append(empty);
    return;
  }

  for (const item of cards) {
    const card = el("article", "card");

    if (item.thumbnail) {
      const img = el("img", "card-thumb");
      img.src = item.thumbnail;
      img.alt = "";
      img.loading = "lazy";
      card.append(img);
    } else {
      card.append(el("div", "card-thumb"));
    }

    // The title link stretches over the whole card (see .card-link in CSS),
    // so clicking anywhere on the card opens the website in a new tab.
    const title = el("h4", "card-title");
    const link = el("a", "card-link", item.title);
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    title.append(link);
    card.append(title);

    if (item.description) card.append(el("p", "card-desc", item.description));

    grid.append(card);
  }
}

// Cards for one category.
// Order: ⭐ in the title first, then by Notion "order" (empty = last), then newest.
function cardsFor(categoryId) {
  return state.cards
    .filter((c) => c.categories.includes(categoryId))
    .sort(
      (a, b) =>
        isStarred(b) - isStarred(a) ||
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        b.createdAt - a.createdAt
    );
}

function isStarred(card) {
  return card.title.includes("⭐") ? 1 : 0;
}

function render() {
  renderSidebar();
  renderGrid();
}

/* ---------- 3. Submit form ---------- */

// Option values are the category names, which match the Notion "type" tags.
function fillCategorySelect() {
  const select = $("#category-select");
  for (const group of config.groups) {
    const og = document.createElement("optgroup");
    og.label = group.name;
    for (const cat of group.categories) {
      const opt = el("option", "", cat.name);
      opt.value = cat.name;
      opt.dataset.id = cat.id;
      og.append(opt);
    }
    select.append(og);
  }
}

function openForm() {
  showForm();
  formDialog.showModal();
  form.url.focus();
}

// Reset the form and show it (instead of the "Thanks" message)
function showForm() {
  form.reset();
  const active = allCategories.find((c) => c.id === state.activeId);
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

/* ---------- 4. Loading cards ---------- */

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

/* ---------- 5. Helpers ---------- */

// Create an element with an optional class and text.
function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// "example.com" -> "https://example.com"
function normalizeUrl(value = "") {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : "https://" + v;
}

// Read the active category from the URL (#web, #figma, ...)
function readHash() {
  const id = location.hash.slice(1);
  state.activeId = allCategories.some((c) => c.id === id) ? id : allCategories[0].id;
}

/* ---------- 6. Start ---------- */

function fillStaticText() {
  document.querySelectorAll("[data-site-name]").forEach((n) => (n.textContent = config.siteName));
  const f = config.footer;
  $('[data-footer="heading"]').textContent = f.heading;
  $('[data-footer="text"]').textContent = f.text;
  $('[data-footer="credit"]').textContent = f.credit;
  $('[data-footer="link"]').textContent = f.linkLabel;
  $('[data-footer="link"]').href = f.linkUrl;
}

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

window.addEventListener("hashchange", () => {
  readHash();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

(async function start() {
  fillStaticText();
  fillCategorySelect();
  readHash();
  await loadCards();
  render();
})();
