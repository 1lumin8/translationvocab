const cardsEl = document.querySelector("#cards");
const generateButton = document.querySelector("#generate");
const revealButton = document.querySelector("#show-all");
const selectAllTabsButton = document.querySelector("#select-all-tabs");
const deselectAllTabsButton = document.querySelector("#deselect-all-tabs");
const tabFilterEl = document.querySelector("#tab-filter");
const cardCountEl = document.querySelector("#card-count");
const tabCountEl = document.querySelector("#tab-count");
const directionButtons = [...document.querySelectorAll("[data-direction]")];
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];

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
let difficulty = "all";
let currentCards = [];
let previousCardKeys = new Set();
let deckQueue = [];
let deckSignature = "";

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
  if (
    combined.includes("요한계시록") ||
    combined.includes("신약계시록") ||
    combined === "계시록thebookofrevelation" ||
    combined === "요한계시록revelation" ||
    combined === "요한계시록bookofrevelation"
  ) {
    return "book-of-revelation";
  }
  return cardKey(card);
}

function difficultyScore(card) {
  const koreanLength = [...card.korean].length;
  const englishLength = card.english.length;
  const combined = normalizeKey(`${card.tab} ${card.type} ${card.korean} ${card.english}`);
  let score = 0;

  if (koreanLength <= 4 && englishLength <= 28) {
    score += 0;
  } else if (koreanLength <= 9 && englishLength <= 70) {
    score += 1;
  } else {
    score += 2;
  }

  if (
    combined.includes("idiom") ||
    combined.includes("phrase") ||
    combined.includes("rhetorical") ||
    combined.includes("organization") ||
    combined.includes("doctrinal") ||
    combined.includes("prayer")
  ) {
    score += 1;
  }

  if (card.tab === "Phrases" || card.tab === "SCJ Organization") {
    score += 1;
  }

  return Math.min(score, 3);
}

function matchesDifficulty(card) {
  const score = difficultyScore(card);
  if (difficulty === "easy") {
    return score <= 1;
  }
  if (difficulty === "medium") {
    return score === 2;
  }
  if (difficulty === "hard") {
    return score >= 3;
  }
  return true;
}

function getActivePool() {
  const filteredCards = studyCards.filter(
    (card) => activeTabs.has(card.tab) && matchesDifficulty(card)
  );
  const fallbackCards = studyCards.filter((card) => activeTabs.has(card.tab));
  return filteredCards.length >= 10 ? filteredCards : fallbackCards;
}

function getDeckSignature() {
  return `${[...activeTabs].sort().join("|")}::${difficulty}`;
}

function refreshDeck(force = false) {
  const signature = getDeckSignature();
  if (!force && signature === deckSignature && deckQueue.length >= 10) {
    return;
  }

  const recent = new Set([...previousCardKeys, ...currentCards.map(cardKey)]);
  const pool = getActivePool();
  const fresh = pool.filter((card) => !recent.has(cardKey(card)));
  deckQueue = shuffle(fresh.length >= 10 ? fresh : pool);
  deckSignature = signature;
}

function sampleCards() {
  refreshDeck();
  const selected = [];
  const selectedKeys = new Set();
  const selectedClusters = new Set();

  while (deckQueue.length && selected.length < 10) {
    const card = deckQueue.shift();
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
    refreshDeck(true);
    while (deckQueue.length && selected.length < 10) {
      const card = deckQueue.shift();
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

function resetDeckAndSample() {
  deckQueue = [];
  deckSignature = "";
  previousCardKeys = new Set();
  sampleCards();
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
      resetDeckAndSample();
      renderCards();
    });
  });
}

selectAllTabsButton.addEventListener("click", () => {
  activeTabs = new Set(allTabs);
  syncTabButtons();
  resetDeckAndSample();
  renderCards();
});

deselectAllTabsButton.addEventListener("click", () => {
  activeTabs = new Set();
  currentCards = [];
  previousCardKeys = new Set();
  deckQueue = [];
  deckSignature = "";
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

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty;
    difficultyButtons.forEach((item) => item.classList.toggle("active", item === button));
    resetDeckAndSample();
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
