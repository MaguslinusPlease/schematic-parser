// server-bookmark.js - Client-side bookmark manager with server communication (no inline styles)

export class ServerBookmarkManager {
    constructor() {
        this.bookmarkedItems = new Set();
        this.showBookmarksOnly = false;
        this.currentUser = '';
        this.onFilterChange = null;
        this.serverUrl = 'http://localhost:3001';
        this.lastSaved = null;
    }

    // Initialize the bookmark system
    async init(onFilterChangeCallback) {
        this.onFilterChange = onFilterChangeCallback;
        await this.createUserInterface();
        console.log('Server-based bookmark system initialized');
    }

    // Create the user interface
    async createUserInterface() {
        const container = document.createElement('div');
        container.id = 'bookmark-controls';
        container.className = 'bookmark-controls-container';

        // Server status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'server-status';
        statusIndicator.className = 'server-status-indicator server-status-offline';
        statusIndicator.title = 'Server status';

        // User selection
        const userLabel = document.createElement('label');
        userLabel.textContent = 'User: ';
        userLabel.className = 'user-label';

        const userSelect = document.createElement('select');
        userSelect.id = 'user-select';
        userSelect.className = 'user-select';
        
        // Load existing users from server
        await this.populateUserSelect(userSelect);

        userSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.setCurrentUser(e.target.value);
            }
        });


        
        // Show bookmarks filter
        const filterBtn = this.createButton('📚 Show Bookmarks Only', () => this.toggleBookmarkFilter());
        filterBtn.id = 'bookmark-filter-btn';
        filterBtn.className = 'bookmark-filter-btn';
        
        // Save now button
        const saveBtn = this.createButton('💾 Save Now', async () => {
            await this.saveBookmarks();
        });
        saveBtn.className = 'bookmark-save-btn';
        

        
        // Auto-save toggle
        const autoSaveLabel = document.createElement('label');
        autoSaveLabel.className = 'auto-save-label';
        
        const autoSaveCheckbox = document.createElement('input');
        autoSaveCheckbox.type = 'checkbox';
        autoSaveCheckbox.checked = this.autoSaveEnabled;
        autoSaveCheckbox.className = 'auto-save-checkbox';
        autoSaveCheckbox.addEventListener('change', (e) => {
            this.autoSaveEnabled = e.target.checked;
            if (this.autoSaveEnabled && this.currentUser && this.isDirty) {
                this.setupAutoSave();
            }
        });
        
        autoSaveLabel.appendChild(autoSaveCheckbox);
        autoSaveLabel.appendChild(document.createTextNode('Auto-save'));

        // User status display
        const statusDiv = document.createElement('div');
        statusDiv.id = 'bookmark-status';
        statusDiv.className = 'bookmark-status';

        // Assemble interface
        container.appendChild(statusIndicator);
        container.appendChild(userLabel);
        container.appendChild(userSelect);
        container.appendChild(filterBtn);
        container.appendChild(saveBtn);
        container.appendChild(statusDiv);

        // Add to page
        const searchField = document.getElementById("search-field");
        if (searchField && searchField.parentNode) {
            searchField.parentNode.insertBefore(container, searchField.nextSibling);
        } else {
            document.body.appendChild(container);
        }

        // Check server status
        await this.checkServerStatus();
        this.updateStatus();
    }

    // Create a styled button
    createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        
        return btn;
    }

    // Check server status
    async checkServerStatus() {
        try {
            const response = await fetch(`${this.serverUrl}/api/health`);
            const data = await response.json();
            
            const indicator = document.getElementById('server-status');
            if (indicator) {
                indicator.className = 'server-status-indicator';
                if (data.status === 'ok') {
                    indicator.classList.add('server-status-online');
                    indicator.title = 'Server online';
                } else {
                    indicator.classList.add('server-status-warning');
                    indicator.title = 'Server issue';
                }
            }
            return true;
        } catch (error) {
            console.error('Server health check failed:', error);
            const indicator = document.getElementById('server-status');
            if (indicator) {
                indicator.className = 'server-status-indicator server-status-offline';
                indicator.title = 'Server offline';
            }
            return false;
        }
    }

    // Populate user select with existing users
    async populateUserSelect(selectElement) {
        try {
            const response = await fetch(`${this.serverUrl}/api/users`);
            const data = await response.json();
            
            // Clear existing options except first
            while (selectElement.children.length > 1) {
                selectElement.removeChild(selectElement.lastChild);
            }
            
            // Add default option if not exists
            if (selectElement.children.length === 0) {
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select User...';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                selectElement.appendChild(defaultOption);
            }
            
            // Add users from server
            data.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                selectElement.appendChild(option);
            });
            
            console.log(`Loaded ${data.users.length} users from server`);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    // Set current user and load their bookmarks
    async setCurrentUser(username) {
        if (!username.trim()) return;
        
        this.currentUser = username.trim();
        await this.loadBookmarks();
        
        this.updateStatus();
        console.log(`Switched to user: ${this.currentUser}`);
    }

    // Load bookmarks from server
    async loadBookmarks() {
        if (!this.currentUser) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/bookmarks/${encodeURIComponent(this.currentUser)}`);
            const data = await response.json();
            
            if (data.success) {
                this.bookmarkedItems = new Set(data.bookmarks);
                this.lastSaved = data.lastModified;
                
                this.updateStatus(`Loaded ${data.bookmarkCount} bookmarks`);
                console.log(`Loaded ${data.bookmarkCount} bookmarks for ${this.currentUser}`);
                
                // Refresh display if showing bookmarks
                if (this.showBookmarksOnly && this.onFilterChange) {
                    this.onFilterChange();
                }
            } else {
                console.error('Error loading bookmarks:', data.error);
            }
        } catch (error) {
            console.error('Network error loading bookmarks:', error);
            this.updateStatus('Error: Could not load bookmarks');
        }
    }

    // Save bookmarks to server
    async saveBookmarks(silent = false) {
        if (!this.currentUser) {
            if (!silent) alert('Please select a user first!');
            return;
        }

        try {
            const response = await fetch(`${this.serverUrl}/api/bookmarks/${encodeURIComponent(this.currentUser)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bookmarks: [...this.bookmarkedItems]
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.lastSaved = data.lastModified;
                
                if (!silent) {
                    this.updateStatus(`Saved ${data.bookmarkCount} bookmarks`);
                }
                console.log(`Saved ${data.bookmarkCount} bookmarks for ${this.currentUser}`);
            } else {
                console.error('Error saving bookmarks:', data.error);
                if (!silent) {
                    alert('Error saving bookmarks: ' + data.error);
                }
            }
        } catch (error) {
            console.error('Network error saving bookmarks:', error);
            if (!silent) {
                alert('Network error: Could not save bookmarks');
            }
        }
    }

    // Export bookmarks
    async exportBookmarks() {
        if (!this.currentUser) {
            alert('Please select a user first!');
            return;
        }

        try {
            const response = await fetch(`${this.serverUrl}/api/export/${encodeURIComponent(this.currentUser)}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bookmarks-${this.currentUser}-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                this.updateStatus('Bookmarks exported');
                console.log(`Exported bookmarks for ${this.currentUser}`);
            } else {
                const error = await response.json();
                alert('Export error: ' + error.error);
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Network error: Could not export bookmarks');
        }
    }



    // Update status display
    updateStatus(message = null) {
        const statusDiv = document.getElementById('bookmark-status');
        if (statusDiv) {
            if (message) {
                statusDiv.textContent = message;
                statusDiv.className = 'bookmark-status bookmark-status-temporary';
                // Clear temporary message after 3 seconds
                setTimeout(() => {
                    this.updateStatus();
                }, 3000);
            } else if (this.currentUser) {
                let status = `${this.currentUser}: ${this.bookmarkedItems.size} bookmarks`;
                statusDiv.className = 'bookmark-status bookmark-status-saved';
                statusDiv.textContent = status;
            } else {
                statusDiv.textContent = 'No user selected';
                statusDiv.className = 'bookmark-status bookmark-status-no-user';
            }
        }
    }

    // Create item ID (same as before)
    createItemId(item) {
        return `${item.pageNumber}-${item.title.replace(/[^a-zA-Z0-9]/g, '')}`;
    }

    // Check if item is bookmarked
    isBookmarked(item) {
        return this.bookmarkedItems.has(this.createItemId(item));
    }

    // Toggle bookmark
    async toggleBookmark(item) {
        if (!this.currentUser) {
            alert('Please select a user first!');
            return false;
        }

        const itemId = this.createItemId(item);
        const wasBookmarked = this.bookmarkedItems.has(itemId);
        
        if (wasBookmarked) {
            this.bookmarkedItems.delete(itemId);
        } else {
            this.bookmarkedItems.add(itemId);
        }
        
        // Update button appearance immediately
        const bookmarkBtn = document.querySelector(`[data-item-id="${itemId}"] .star-btn`);
        if (bookmarkBtn) {
            this.updateBookmarkButton(bookmarkBtn, !wasBookmarked);
        }
        
        // Save immediately to server
        await this.saveBookmarks(true); // Silent save
        
        this.updateStatus();
        
        // Refresh if showing bookmarks only
        if (this.showBookmarksOnly && this.onFilterChange) {
            this.onFilterChange();
        }
        
        return !wasBookmarked;
    }

    // Update bookmark button appearance
    updateBookmarkButton(button, isBookmarked) {
        if (isBookmarked) {
            button.innerHTML = '★';
            button.className = 'star-btn star-btn-bookmarked';
            button.title = 'Remove bookmark';
        } else {
            button.innerHTML = '☆';
            button.className = 'star-btn star-btn-unbookmarked';
            button.title = 'Add bookmark';
        }
    }

    // Create bookmark button
    createBookmarkButton(item) {
        const itemId = this.createItemId(item);
        const isBookmarked = this.bookmarkedItems.has(itemId);
        
        const bookmarkBtn = document.createElement("button");
        bookmarkBtn.className = isBookmarked ? 'star-btn star-btn-bookmarked' : 'star-btn star-btn-unbookmarked';
        
        bookmarkBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await this.toggleBookmark(item);
        });
        
        this.updateBookmarkButton(bookmarkBtn, isBookmarked);
        return bookmarkBtn;
    }

    // Toggle bookmark filter
    toggleBookmarkFilter() {
        if (!this.currentUser) {
            alert('Please select a user first!');
            return;
        }

        this.showBookmarksOnly = !this.showBookmarksOnly;
        
        const filterBtn = document.getElementById('bookmark-filter-btn');
        if (filterBtn) {
            if (this.showBookmarksOnly) {
                filterBtn.textContent = '📚 Show All Items';
                filterBtn.classList.add('bookmark-filter-btn-active');
            } else {
                filterBtn.textContent = '📚 Show Bookmarks Only';
                filterBtn.classList.remove('bookmark-filter-btn-active');
            }
        }
        
        if (this.onFilterChange) {
            this.onFilterChange();
        }
    }

    // Should show item based on bookmark filter
    shouldShowItem(item) {
        if (!this.showBookmarksOnly) return true;
        return this.isBookmarked(item);
    }

    // Get status text for loading indicator
    getStatusText(currentDisplayed, totalFiltered) {
        let statusText = `Showing ${currentDisplayed} of ${totalFiltered} items`;
        if (this.showBookmarksOnly && this.currentUser) {
            statusText += ` (${this.currentUser}'s bookmarks)`;
        }
        return statusText;
    }

    // Get completion message
    getCompletionMessage(totalFiltered) {
        if (totalFiltered === 0) {
            return this.showBookmarksOnly && this.currentUser
                ? `No bookmarks found for ${this.currentUser}.`
                : "No items found matching your filters.";
        } else {
            return this.showBookmarksOnly && this.currentUser
                ? `All ${totalFiltered} bookmarks for ${this.currentUser} loaded.`
                : `All ${totalFiltered} filtered items loaded.`;
        }
    }
}

// Export instance
export const serverBookmarkManager = new ServerBookmarkManager();