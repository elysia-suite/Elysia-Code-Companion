/*
   ELYSIA CODE COMPANION v1.2.2 - Database Layer
   IndexedDB via Dexie.js for chat history & cache
*/

import Utils from "./utils.js";

// Initialize Dexie Database
const db = new Dexie("ElysiaCodeCompanion");

db.version(1).stores({
    chats: "++id, timestamp, model",
    fileCache: "path, content, timestamp"
});

const DB = {
    // Chat History
    async saveChat(userMessage, assistantMessage, context = {}) {
        try {
            return await db.chats.add({
                timestamp: Date.now(),
                userMessage,
                assistantMessage,
                model: context.model || "unknown",
                folderName: context.folderName || null,
                fileCount: context.fileCount || 0
            });
        } catch (err) {
            console.error("Failed to save chat:", err);
            return null;
        }
    },

    async getChats(limit = 50) {
        try {
            return await db.chats.orderBy("timestamp").reverse().limit(limit).toArray();
        } catch (err) {
            console.error("Failed to get chats:", err);
            return [];
        }
    },

    async clearChats() {
        try {
            await db.chats.clear();
            Utils.toast.success("Chat history cleared");
            return true;
        } catch (err) {
            console.error("Failed to clear chats:", err);
            Utils.toast.error("Failed to clear chat history");
            return false;
        }
    },

    async getChat(id) {
        try {
            return await db.chats.get(id);
        } catch (err) {
            console.error("Failed to get chat:", err);
            return null;
        }
    },

    // File Cache - CURRENTLY UNUSED (FileSystem uses in-memory Map cache instead)
    // Kept for potential future feature: persistent cache across browser sessions
    // TODO: Consider using this for larger projects or implement cache strategy toggle
    /*
    async cacheFile(path, content) {
        try {
            await db.fileCache.put({
                path,
                content,
                timestamp: Date.now()
            });
            return true;
        } catch (err) {
            console.error("Failed to cache file:", err);
            return false;
        }
    },

    async getCachedFile(path) {
        try {
            const cached = await db.fileCache.get(path);
            // Cache expires after 1 hour
            if (cached && Date.now() - cached.timestamp < 3600000) {
                return cached.content;
            }
            return null;
        } catch (err) {
            console.error("Failed to get cached file:", err);
            return null;
        }
    },

    async clearFileCache() {
        try {
            await db.fileCache.clear();
            return true;
        } catch (err) {
            console.error("Failed to clear file cache:", err);
            return false;
        }
    },
    */

    // Stats
    async getStats() {
        try {
            const chatCount = await db.chats.count();
            const cacheCount = await db.fileCache.count();
            return { chatCount, cacheCount };
        } catch (err) {
            console.error("Failed to get stats:", err);
            return { chatCount: 0, cacheCount: 0 };
        }
    }
};

export default DB;
