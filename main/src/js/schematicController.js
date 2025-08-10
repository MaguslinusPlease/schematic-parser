import { serverBookmarkManager } from './server-bookmark.js';

let allData = [];
let allItems = [];
let filteredItems = [];
let currentlyDisplayed = 0;
let currentSearchTerm = "";
let selectedCategories = [];
const ITEMS_PER_BATCH = 24;

async function loadData() {
    try {
        const response = await fetch("./../../minecraft-schematics.json");
        allData = await response.json();
        
        allItems = [];
        allData.forEach((page) => {
            page.items.forEach((item) => {
                allItems.push({
                    ...item,
                    pageNumber: page.page,
                });
            });
        });
        
        filteredItems = [...allItems];
        currentlyDisplayed = 0;
        
        const schematicList = document.getElementById("schematic-list");
        schematicList.innerHTML = "";
        
        loadMoreItems();
        setupInfiniteScroll();
        setupSearchFilter();
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
    
    categoryCards.forEach(card => {
        card.addEventListener("click", (e) => {
            const category = e.target.getAttribute("data-category");
            
            if (category === "") {
                // Clear all button clicked
                selectedCategories = [];
                categoryCards.forEach(c => c.classList.remove("active"));
                e.target.classList.add("active");
            } else {
                // Remove active state from "All Categories" button
                document.querySelector(".category-card.clear-btn").classList.remove("active");
                
                // Toggle this category
                if (selectedCategories.includes(category)) {
                    selectedCategories = selectedCategories.filter(cat => cat !== category);
                    e.target.classList.remove("active");
                } else {
                    selectedCategories.push(category);
                    e.target.classList.add("active");
                }
                
                // If no categories selected, activate "All Categories"
                if (selectedCategories.length === 0) {
                    document.querySelector(".category-card.clear-btn").classList.add("active");
                }
            }
            
            filterItems();
        });
    });
    
    // Set "All Categories" as active by default
    document.querySelector(".category-card.clear-btn").classList.add("active");
}

function filterItems() {
    // Clear category filters when showing bookmarks only
    if (serverBookmarkManager.showBookmarksOnly) {
        selectedCategories = [];
        document.querySelectorAll('.category-card').forEach(card => {
            card.classList.remove('active');
        });
        const clearBtn = document.querySelector('.category-card.clear-btn');
        if (clearBtn) {
            clearBtn.classList.add('active');
        }
    }
    
    filteredItems = allItems.filter(item => {
        const matchesSearch = currentSearchTerm === "" || 
            item.title.toLowerCase().includes(currentSearchTerm);
        
        const matchesCategory = selectedCategories.length === 0 || 
            selectedCategories.includes(item.category);
        
        // Update this line:
        const matchesBookmarkFilter = serverBookmarkManager.shouldShowItem(item);
        
        return matchesSearch && matchesCategory && matchesBookmarkFilter;
    });
    
    currentlyDisplayed = 0;
    const schematicList = document.getElementById("schematic-list");
    schematicList.innerHTML = "";
    
    loadMoreItems();
    updateLoadingIndicator();
}

function loadMoreItems() {
    const schematicList = document.getElementById("schematic-list");
    const itemsToLoad = filteredItems.slice(currentlyDisplayed, currentlyDisplayed + ITEMS_PER_BATCH);
    
    if (itemsToLoad.length === 0) return;
    
    itemsToLoad.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "item";
        itemDiv.setAttribute("data-item-id", serverBookmarkManager.createItemId(item));
        
        // TOP SECTION (Image)
        const topDiv = document.createElement("div");
        topDiv.className = "top";
        
        const imgLink = document.createElement("a");
        imgLink.href = item.fullUrl;
        imgLink.target = "_blank";
        imgLink.style.position = "relative";
        imgLink.style.display = "block";
        
        const img = document.createElement("img");
        img.className = "schematic-preview";
        img.loading = "lazy";
        img.src = item.imageSrc || "https://via.placeholder.com/300x200?text=No+Image";
        img.alt = item.title;
        img.onerror = function() {
            this.src = "https://via.placeholder.com/300x200?text=No+Image";
        };
        
        imgLink.appendChild(img);
        topDiv.appendChild(imgLink);
        
        // BOTTOM SECTION
        const bottomDiv = document.createElement("div");
        bottomDiv.className = "bottom";
        
        // META-DATA SECTION (Category + Star Button)
        const metaDataDiv = document.createElement("div");
        metaDataDiv.className = "meta-data";
        
        const category = document.createElement("span");
        category.className = "schematic-category-card";
        category.textContent = item.category || "Uncategorized";
        
        const bookmarkBtn = serverBookmarkManager.createBookmarkButton(item);
        
        metaDataDiv.appendChild(category);
        metaDataDiv.appendChild(bookmarkBtn);
        
        // TITLE SECTION
        const titleLink = document.createElement("a");
        titleLink.href = item.fullUrl;
        titleLink.target = "_blank";
        titleLink.style.textDecoration = "none";
        titleLink.style.color = "inherit";
        
        const title = document.createElement("h2");
        title.className = "schematic-title";
        title.textContent = item.title;
        
        titleLink.appendChild(title);
        
        // ASSEMBLE BOTTOM SECTION
        bottomDiv.appendChild(metaDataDiv);
        bottomDiv.appendChild(titleLink);
        
        // ASSEMBLE ITEM
        itemDiv.appendChild(topDiv);
        itemDiv.appendChild(bottomDiv);
        
        schematicList.appendChild(itemDiv);
    });
    
    currentlyDisplayed += itemsToLoad.length;
    updateLoadingIndicator();
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
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
        let statusText = serverBookmarkManager.getStatusText(currentlyDisplayed, filteredItems.length);
        
        if (!serverBookmarkManager.showBookmarksOnly && selectedCategories.length > 0) {
            statusText += ` in ${selectedCategories.length} selected categor${selectedCategories.length === 1 ? 'y' : 'ies'}`;
        }
        
        if (currentSearchTerm) {
            statusText += ` matching "${currentSearchTerm}"`;
        }
        
        statusText += ". Scroll for more...";
        loadingDiv.textContent = statusText;
        loadingDiv.style.display = "block";
    } else {
        loadingDiv.textContent = serverBookmarkManager.getCompletionMessage(filteredItems.length);
        
        setTimeout(() => {
            if (filteredItems.length > 0) {
                loadingDiv.style.display = "none";
            }
        }, 2000);
    }
}

loadData();