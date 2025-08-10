const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;
const BOOKMARKS_DIR = './bookmarks';

console.log('📚 Starting bookmark server...');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure bookmarks directory exists
async function ensureBookmarksDir() {
    try {
        await fs.access(BOOKMARKS_DIR);
        console.log('📁 Bookmarks directory found');
    } catch {
        await fs.mkdir(BOOKMARKS_DIR, { recursive: true });
        console.log('📁 Created bookmarks directory');
    }
}

// Get safe filename
function getSafeFilename(username) {
    return username.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
}

// Get bookmark file path
function getBookmarkPath(username) {
    const safeUsername = getSafeFilename(username);
    return path.join(BOOKMARKS_DIR, `${safeUsername}.json`);
}

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const files = await fs.readdir(BOOKMARKS_DIR);
        const users = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''))
            .map(username => username.replace(/_/g, ' '));
        
        console.log(`📋 Found ${users.length} users`);
        res.json({ users });
    } catch (error) {
        console.error('❌ Error reading users:', error);
        res.json({ users: [] });
    }
});

// Get bookmarks for user
app.get('/api/bookmarks/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`📖 Getting bookmarks for: ${username}`);
        
        if (!username || username.trim() === '') {
            return res.status(400).json({ error: 'Username is required' });
        }

        const bookmarkPath = getBookmarkPath(username);
        
        try {
            const data = await fs.readFile(bookmarkPath, 'utf8');
            const bookmarks = JSON.parse(data);
            
            console.log(`✅ Loaded ${bookmarks.bookmarkIds?.length || 0} bookmarks for ${username}`);
            
            res.json({
                success: true,
                user: username,
                bookmarks: bookmarks.bookmarkIds || [],
                lastModified: bookmarks.lastModified || new Date().toISOString(),
                bookmarkCount: bookmarks.bookmarkIds ? bookmarks.bookmarkIds.length : 0
            });
        } catch (fileError) {
            console.log(`📝 No existing bookmarks for ${username}, returning empty`);
            res.json({
                success: true,
                user: username,
                bookmarks: [],
                lastModified: new Date().toISOString(),
                bookmarkCount: 0
            });
        }
    } catch (error) {
        console.error('❌ Error getting bookmarks:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Save bookmarks for user
app.post('/api/bookmarks/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { bookmarks } = req.body;

        console.log(`💾 Saving ${bookmarks?.length || 0} bookmarks for: ${username}`);

        if (!username || username.trim() === '') {
            return res.status(400).json({ error: 'Username is required' });
        }

        if (!Array.isArray(bookmarks)) {
            return res.status(400).json({ error: 'Bookmarks must be an array' });
        }

        const bookmarkPath = getBookmarkPath(username);
        
        const bookmarkData = {
            user: username,
            bookmarkIds: bookmarks,
            lastModified: new Date().toISOString(),
            bookmarkCount: bookmarks.length,
            version: '2.0'
        };

        await fs.writeFile(bookmarkPath, JSON.stringify(bookmarkData, null, 2));
        
        console.log(`✅ Saved ${bookmarks.length} bookmarks for ${username}`);
        
        res.json({
            success: true,
            message: `Saved ${bookmarks.length} bookmarks for ${username}`,
            bookmarkCount: bookmarks.length,
            lastModified: bookmarkData.lastModified
        });
    } catch (error) {
        console.error('❌ Error saving bookmarks:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Export bookmarks
app.get('/api/export/:username', async (req, res) => {
    try {
        const { username } = req.params;
        console.log(`📥 Exporting bookmarks for: ${username}`);
        
        const bookmarkPath = getBookmarkPath(username);
        
        try {
            const data = await fs.readFile(bookmarkPath, 'utf8');
            const bookmarks = JSON.parse(data);
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="bookmarks-${getSafeFilename(username)}-${new Date().toISOString().split('T')[0]}.json"`);
            res.send(JSON.stringify(bookmarks, null, 2));
            
            console.log(`✅ Exported bookmarks for ${username}`);
        } catch (fileError) {
            console.log(`❌ No bookmarks found for ${username}`);
            res.status(404).json({ error: 'No bookmarks found for this user' });
        }
    } catch (error) {
        console.error('❌ Error exporting bookmarks:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
    try {
        await ensureBookmarksDir();
        
        app.listen(PORT, () => {
            console.log(`🚀 Bookmark server running on http://localhost:${PORT}`);
            console.log(`📁 Storing bookmarks in: ${path.resolve(BOOKMARKS_DIR)}`);
            console.log(`🔗 API endpoints:`);
            console.log(`   GET  http://localhost:${PORT}/api/health`);
            console.log(`   GET  http://localhost:${PORT}/api/users`);
            console.log(`   GET  http://localhost:${PORT}/api/bookmarks/:username`);
            console.log(`   POST http://localhost:${PORT}/api/bookmarks/:username`);
            console.log(`🌟 Ready for family bookmarks!`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
