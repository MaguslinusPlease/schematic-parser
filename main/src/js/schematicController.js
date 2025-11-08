import { serverBookmarkManager } from "./server-bookmark.js";

let allData = [];
let allItems = [];
let filteredItems = [];
let currentlyDisplayed = 0;
let currentSearchTerm = "";
let selectedCategories = [];
let selectedThemes = []; // <-- added
const ITEMS_PER_BATCH = 24;

async function loadData() {
  try {
    const response = await fetch("./../../minecraft-schematics.json");
    allData = await response.json();
    allItems = allData.map((item) => ({
      ...item,
      pageNumber: null, // or undefined if you want to track pages
    }));
    filteredItems = [...allItems];
    currentlyDisplayed = 0;

    const schematicList = document.getElementById("schematic-list");
    schematicList.innerHTML = "";

    loadMoreItems();
    setupInfiniteScroll();
    setupSearchFilter();
    setupThemeFilters(); // <-- initialize themes
    setupCategoryFilters();

    console.log(`Loaded ${allItems.length} total items`);

    await serverBookmarkManager.init(() => filterItems());
  } catch (error) {
    console.error("Error loading data:", error);
    const schematicList = document.getElementById("schematic-list");
    schematicList.innerHTML = `<p>Error loading data: ${error.message}</p>`;
  }
}

function setupSearchFilter() {
  const searchField = document.getElementById("search-field");

  if (!searchField) {
    console.warn("Search field not found");
    return;
  }

  searchField.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value.toLowerCase().trim();
    filterItems();
  });
}

function setupCategoryFilters() {
  const categoryCards = document.querySelectorAll(".category-card");

  categoryCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      const category = e.target.getAttribute("data-category");

      if (category === "") {
        // Clear all button clicked
        selectedCategories = [];
        categoryCards.forEach((c) => c.classList.remove("active"));
        e.target.classList.add("active");
      } else {
        // Remove active state from "All Categories" button
        document
          .querySelector(".category-card.clear-btn")
          .classList.remove("active");

        // Toggle this category
        if (selectedCategories.includes(category)) {
          selectedCategories = selectedCategories.filter(
            (cat) => cat !== category
          );
          e.target.classList.remove("active");
        } else {
          selectedCategories.push(category);
          e.target.classList.add("active");
        }

        // If no categories selected, activate "All Categories"
        if (selectedCategories.length === 0) {
          document
            .querySelector(".category-card.clear-btn")
            .classList.add("active");
        }
      }

      filterItems();
    });
  });

  // Set "All Categories" as active by default
  const catClear = document.querySelector(".category-card.clear-btn");
  if (catClear) catClear.classList.add("active");
}

function setupThemeFilters() {
  const themeCards = document.querySelectorAll(".theme-card");

  themeCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      const theme = e.target.getAttribute("data-theme");

      if (theme === "") {
        // Clear all button clicked
        selectedThemes = [];
        themeCards.forEach((c) => c.classList.remove("active"));
        e.target.classList.add("active");
      } else {
        // Remove active state from "All Themes" button
        document.querySelector(".theme-card.clear-btn")?.classList.remove("active");

        // Toggle this theme
        if (selectedThemes.includes(theme)) {
          selectedThemes = selectedThemes.filter((t) => t !== theme);
          e.target.classList.remove("active");
        } else {
          selectedThemes.push(theme);
          e.target.classList.add("active");
        }

        // If no themes selected, activate "All Themes"
        if (selectedThemes.length === 0) {
          document.querySelector(".theme-card.clear-btn")?.classList.add("active");
        }
      }

      filterItems();
    });
  });

  // Set "All Themes" as active by default
  const themeClear = document.querySelector(".theme-card.clear-btn");
  if (themeClear) themeClear.classList.add("active");
}

function filterItems() {
  // Clear category & theme filters when showing bookmarks only
  if (serverBookmarkManager.showBookmarksOnly) {
    selectedCategories = [];
    selectedThemes = [];

    document.querySelectorAll(".category-card").forEach((card) => {
      card.classList.remove("active");
    });
    document.querySelectorAll(".theme-card").forEach((card) => {
      card.classList.remove("active");
    });

    const clearCat = document.querySelector(".category-card.clear-btn");
    if (clearCat) clearCat.classList.add("active");

    const clearTheme = document.querySelector(".theme-card.clear-btn");
    if (clearTheme) clearTheme.classList.add("active");
  }

  filteredItems = allItems.filter((item) => {
    const matchesSearch =
      currentSearchTerm === "" ||
      (item.fullTitle || "").toLowerCase().includes(currentSearchTerm);

    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.includes(item.category);

    const matchesTheme =
      selectedThemes.length === 0 || selectedThemes.includes(item.theme);

    const matchesBookmarkFilter = serverBookmarkManager.shouldShowItem(item);

    return matchesSearch && matchesCategory && matchesTheme && matchesBookmarkFilter;
  });

  currentlyDisplayed = 0;
  const schematicList = document.getElementById("schematic-list");
  schematicList.innerHTML = "";

  loadMoreItems();
  updateLoadingIndicator();
}

function loadMoreItems() {
  const schematicList = document.getElementById("schematic-list");
  const itemsToLoad = filteredItems.slice(
    currentlyDisplayed,
    currentlyDisplayed + ITEMS_PER_BATCH
  );

  if (itemsToLoad.length === 0) return;

  itemsToLoad.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "item";
    itemDiv.setAttribute(
      "data-item-id",
      serverBookmarkManager.createItemId(item)
    );

    const linkUrl = item.downloadLink || item.fullUrl || "#";

    // --- IMAGE SECTION ---
    const imageDiv = document.createElement("div");
    imageDiv.className = "item-image";

    const link = document.createElement("a");
    link.href = linkUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src =
      item.imageSrc || "https://via.placeholder.com/300x200?text=No+Image";
    img.alt = item.fullTitle;
    img.loading = "lazy";
    img.onerror = function () {
      this.src = "https://via.placeholder.com/300x200?text=No+Image";
    };

    link.appendChild(img);

    // Bookmark button
    const bookmarkSpan = document.createElement("span");
    bookmarkSpan.className = "bookmark";
    const bookmarkBtn = serverBookmarkManager.createBookmarkButton(item);
    bookmarkSpan.appendChild(bookmarkBtn);

    imageDiv.appendChild(link);
    imageDiv.appendChild(bookmarkSpan);

    // --- TITLE SECTION ---
    const textDiv = document.createElement("div");
    textDiv.className = "text";

    const titleLink = document.createElement("a");
    titleLink.href = linkUrl;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.className = "item-title";
    titleLink.textContent = item.fullTitle;

    textDiv.appendChild(titleLink);

    // --- META DATA SECTION ---
    const metaDiv = document.createElement("div");
    metaDiv.className = "meta-data";

    const themeSpan = document.createElement("span");
    themeSpan.className = "theme";
    themeSpan.innerHTML = `<strong>Theme:</strong> ${item.theme || "N/A"}`;

    const categorySpan = document.createElement("span");
    categorySpan.className = "category";
    categorySpan.innerHTML = `<strong>Category:</strong> ${item.category || "Uncategorized"}`;

    metaDiv.appendChild(themeSpan);
    metaDiv.appendChild(categorySpan);

    // --- ASSEMBLE ITEM ---
    itemDiv.appendChild(imageDiv);
    itemDiv.appendChild(textDiv);
    itemDiv.appendChild(metaDiv);

    schematicList.appendChild(itemDiv);
  });

  currentlyDisplayed += itemsToLoad.length;
  updateLoadingIndicator();
}


function setupInfiniteScroll() {
  window.addEventListener("scroll", () => {
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 1000
    ) {
      if (currentlyDisplayed < filteredItems.length) {
        loadMoreItems();
      }
    }
  });
}

function updateLoadingIndicator() {
  let loadingDiv = document.getElementById("loading-indicator");

  if (!loadingDiv) {
    loadingDiv = document.createElement("div");
    loadingDiv.id = "loading-indicator";
    loadingDiv.style.textAlign = "center";
    loadingDiv.style.padding = "2rem";
    loadingDiv.style.fontSize = "1.1rem";
    document.body.appendChild(loadingDiv);
  }

  if (currentlyDisplayed < filteredItems.length) {
    let statusText = serverBookmarkManager.getStatusText(
      currentlyDisplayed,
      filteredItems.length
    );

    if (
      !serverBookmarkManager.showBookmarksOnly &&
      selectedCategories.length > 0
    ) {
      statusText += ` in ${selectedCategories.length} selected categor${
        selectedCategories.length === 1 ? "y" : "ies"
      }`;
    }

    if (
      !serverBookmarkManager.showBookmarksOnly &&
      selectedThemes.length > 0
    ) {
      statusText += ` and ${selectedThemes.length} selected theme${
        selectedThemes.length === 1 ? "" : "s"
      }`;
    }

    if (currentSearchTerm) {
      statusText += ` matching "${currentSearchTerm}"`;
    }

    statusText += ". Scroll for more...";
    loadingDiv.textContent = statusText;
    loadingDiv.style.display = "block";
  } else {
    loadingDiv.textContent = serverBookmarkManager.getCompletionMessage(
      filteredItems.length
    );

    setTimeout(() => {
      if (filteredItems.length > 0) {
        loadingDiv.style.display = "none";
      }
    }, 2000);
  }
}

loadData();
