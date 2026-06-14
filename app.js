const cardsEl = document.querySelector("#cards");
const generateButton = document.querySelector("#generate");
const revealButton = document.querySelector("#show-all");
const selectAllTabsButton = document.querySelector("#select-all-tabs");
const deselectAllTabsButton = document.querySelector("#deselect-all-tabs");
const tabFilterEl = document.querySelector("#tab-filter");
const cardCountEl = document.querySelector("#card-count");
const tabCountEl = document.querySelector("#tab-count");
const directionButtons = [...document.querySelectorAll("[data-direction]")];

const INVALID_TERMS = new Set([
  "Korean",
  "Phrase (한글)",
  "Section",
  "#"
]);

const rawCards = window.CARD_DATA || [];

const studyCards = rawCards.filter((card) => {
  const hasStudyPair = card.korean && card.english && card.romanization;
  const isHeader = INVALID_TERMS.has(card.korean) || card.english === "English meaning";
  return hasStudyPair && !isHeader;
});

const allTabs = [...new Set(studyCards.map((card) => card.tab))];
let activeTabs = new Set(allTabs);
let direction = "ko-en";
let currentCards = [];
let previousCardKeys = new Set();

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeKey(text) {
  return String(text)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function cardKey(card) {
  return `${card.tab}:${normalizeKey(card.korean)}:${normalizeKey(card.english)}`;
}

function clusterKey(card) {
  const combined = normalizeKey(`${card.korean} ${card.english}`);
  if (
    combined.includes("신천지예수교") ||
    combined.includes("shincheonjichurchofjesus")
  ) {
    return "shincheonji-church-name";
  }
  return cardKey(card);
}

function sampleCards() {
  const candidates = shuffle(studyCards.filter((card) => activeTabs.has(card.tab)));
  const selected = [];
  const selectedKeys = new Set();
  const selectedClusters = new Set();

  for (const card of candidates) {
    if (selected.length === 10) {
      break;
    }

    const key = cardKey(card);
    const cluster = clusterKey(card);
    if (
      selectedKeys.has(key) ||
      selectedClusters.has(cluster) ||
      previousCardKeys.has(key)
    ) {
      continue;
    }

    selected.push(card);
    selectedKeys.add(key);
    selectedClusters.add(cluster);
  }

  if (selected.length < 10) {
    for (const card of candidates) {
      if (selected.length === 10) {
        break;
      }

      const key = cardKey(card);
      const cluster = clusterKey(card);
      if (selectedKeys.has(key) || selectedClusters.has(cluster)) {
        continue;
      }

      selected.push(card);
      selectedKeys.add(key);
      selectedClusters.add(cluster);
    }
  }

  currentCards = selected;
  previousCardKeys = new Set(currentCards.map(cardKey));
}

function syncTabButtons() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", activeTabs.has(button.dataset.tab));
  });
}

function createFace(card, side) {
  const isFront = side === "front";
  const koreanFirst = direction === "ko-en";
  const showKorean = isFront ? koreanFirst : !koreanFirst;
  const prompt = showKorean ? "Translate" : "Recall the Korean";
  const main = showKorean ? card.korean : card.english;
  const supporting = showKorean ? card.romanization : card.korean;
  const answer = showKorean ? card.english : card.romanization;
  const showSupporting = !isFront;
  const badges = [card.tab];
  if (card.type && card.type !== card.tab) {
    badges.push(card.type);
  }

  return `
    <div class="face ${side}">
      <div class="term">
        <span class="prompt">${prompt}</span>
        <span class="main-term">${main}</span>
        ${showSupporting ? `<span class="romanization">${supporting}</span>` : ""}
        ${isFront ? "" : `<span class="meaning">${answer}</span>`}
      </div>
      <div>
        <div class="meta">
          ${badges
            .map((badge, index) => `<span class="badge ${index === 0 ? "tab" : ""}">${badge}</span>`)
            .join("")}
        </div>
        ${isFront ? "" : `<p class="source">${card.source}</p>`}
        <span class="flip-hint">${isFront ? "Tap to reveal" : "Tap to hide"}</span>
      </div>
    </div>
  `;
}

function renderCards() {
  if (activeTabs.size === 0) {
    cardsEl.innerHTML = `
      <div class="empty-state">
        <p class="prompt">No tabs selected</p>
        <p>Select at least one tab to generate cards.</p>
      </div>
    `;
    cardCountEl.textContent = "0 cards";
    tabCountEl.textContent = "0 tabs";
    return;
  }

  cardsEl.innerHTML = currentCards
    .map(
      (card, index) => `
        <article class="card" tabindex="0" aria-label="Study card ${index + 1}">
          <div class="card-inner">
            ${createFace(card, "front")}
            ${createFace(card, "back")}
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => card.classList.toggle("revealed"));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.classList.toggle("revealed");
      }
    });
  });

  cardCountEl.textContent = `${currentCards.length} cards`;
  tabCountEl.textContent = `${activeTabs.size} tabs`;
}

function renderTabs() {
  tabFilterEl.innerHTML = allTabs
    .map(
      (tab) => `
        <button class="chip active" type="button" data-tab="${tab}">
          ${tab}
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (activeTabs.has(tab)) {
        activeTabs.delete(tab);
      } else {
        activeTabs.add(tab);
      }
      syncTabButtons();
      sampleCards();
      renderCards();
    });
  });
}

selectAllTabsButton.addEventListener("click", () => {
  activeTabs = new Set(allTabs);
  syncTabButtons();
  sampleCards();
  renderCards();
});

deselectAllTabsButton.addEventListener("click", () => {
  activeTabs = new Set();
  currentCards = [];
  previousCardKeys = new Set();
  syncTabButtons();
  renderCards();
});

directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    direction = button.dataset.direction;
    directionButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderCards();
  });
});

generateButton.addEventListener("click", () => {
  sampleCards();
  renderCards();
});

revealButton.addEventListener("click", () => {
  document.querySelectorAll(".card").forEach((card) => card.classList.add("revealed"));
});

renderTabs();
sampleCards();
renderCards();
