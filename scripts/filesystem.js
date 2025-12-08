/*
   ELYSIA CODE COMPANION v1.2.2 - File System Access
   Read local folders using File System Access API
*/

import Utils from "./utils.js";

const FileSystem = {
    currentHandle: null,
    files: [],
    folderName: "",
    fileContentCache: new Map(), // Cache for file contents
    cacheMaxSize: 50, // Max cached files

    // Check if File System Access API is supported
    isSupported() {
        return "showDirectoryPicker" in window;
    },

    // Open Folder Picker
    async openFolder() {
        if (!this.isSupported()) {
            Utils.toast.error("File System Access API not supported in this browser. Try Chrome or Edge.");
            return null;
        }

        try {
            const handle = await window.showDirectoryPicker({
                mode: "read"
            });

            this.currentHandle = handle;
            this.folderName = handle.name;

            Utils.toast.info("Reading folder...");
            const files = await this.readDirectory(handle);
            this.files = files;

            Utils.toast.success(`Loaded ${files.length} files from "${this.folderName}"`);
            return {
                handle,
                name: this.folderName,
                files
            };
        } catch (err) {
            if (err.name === "AbortError") {
                Utils.toast.info("Folder selection cancelled");
            } else {
                console.error("Failed to open folder:", err);
                Utils.toast.error("Failed to open folder: " + err.message);
            }
            return null;
        }
    },

    // Read Directory Recursively
    async readDirectory(dirHandle, path = "", maxFiles = 1000) {
        const files = [];
        const maxFileSizeMB = 5; // Skip files larger than 5MB

        try {
            for await (const entry of dirHandle.values()) {
                if (files.length >= maxFiles) {
                    Utils.toast.warning(`Reached max file limit (${maxFiles})`);
                    break;
                }

                const fullPath = path ? `${path}/${entry.name}` : entry.name;

                if (entry.kind === "directory") {
                    // Skip common directories
                    if (this.shouldSkipDirectory(entry.name)) continue;

                    // Recursively read subdirectory
                    const subFiles = await this.readDirectory(entry, fullPath, maxFiles - files.length);
                    files.push(...subFiles);
                } else if (entry.kind === "file") {
                    // Skip non-text files
                    if (!Utils.isTextFile(entry.name)) continue;

                    try {
                        const file = await entry.getFile();

                        // Skip large files
                        if (file.size > maxFileSizeMB * 1024 * 1024) {
                            // Skipping large file: logged for debugging
                            // console.log(`Skipping large file: ${fullPath} (${Utils.formatFileSize(file.size)})`);
                            continue;
                        }

                        files.push({
                            name: entry.name,
                            path: fullPath,
                            type: entry.kind,
                            size: file.size,
                            extension: Utils.getFileExtension(entry.name),
                            language: Utils.getLanguageFromExtension(Utils.getFileExtension(entry.name)),
                            handle: entry
                        });
                    } catch (err) {
                        console.warn(`Failed to read file ${fullPath}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to read directory:", err);
        }

        return files;
    },

    // Check if directory should be skipped
    shouldSkipDirectory(name) {
        const nameLower = name.toLowerCase();
        const skipDirs = [
            "node_modules",
            ".git",
            ".vscode",
            "dist",
            "build",
            ".cache",
            "coverage",
            ".next",
            ".nuxt",
            "__pycache__",
            "vendor",
            "target"
        ];
        return skipDirs.includes(nameLower) || name.startsWith(".");
    },

    // Read File Content
    async readFile(fileEntry) {
        try {
            // Check cache first
            const cacheKey = fileEntry.path;
            if (this.fileContentCache.has(cacheKey)) {
                // Cache hit: logged for debugging
                // console.log(`Cache hit for: ${fileEntry.path}`);
                return this.fileContentCache.get(cacheKey);
            }

            const file = await fileEntry.handle.getFile();

            // Warn for very large files (> 1MB)
            if (file.size > 1024 * 1024) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                console.warn(`Reading large file: ${fileEntry.path} (${sizeMB}MB)`);

                // Block files > 5MB for safety
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error(`File too large (${sizeMB}MB). Maximum size is 5MB.`);
                }
            }

            const content = await file.text();

            // Add to cache
            if (this.fileContentCache.size >= this.cacheMaxSize) {
                // Remove oldest entry (simple LRU)
                const firstKey = this.fileContentCache.keys().next().value;
                this.fileContentCache.delete(firstKey);
            }
            this.fileContentCache.set(cacheKey, content);

            return content;
        } catch (err) {
            console.error("Failed to read file:", err);
            throw err;
        }
    },

    // Get File by Path
    getFileByPath(path) {
        // Validate path to prevent directory traversal
        if (!path || typeof path !== "string") {
            console.warn("Invalid file path provided");
            return null;
        }

        // Normalize path and prevent directory traversal
        const normalizedPath = path.replace(/\\/g, "/"); // Normalize backslashes

        // Prevent directory traversal attacks
        if (
            normalizedPath.includes("..") ||
            normalizedPath.startsWith("/") ||
            normalizedPath.includes(":") || // Windows absolute paths
            /\.\.[\/\\]/.test(path) || // Encoded traversal
            /%2e%2e/i.test(path) // URL encoded traversal
        ) {
            console.warn("Potentially malicious path detected:", path);
            return null;
        }

        return this.files.find(f => f.path === normalizedPath);
    },

    // Search Files
    searchFiles(query) {
        if (!query) return this.files;

        query = query.toLowerCase();
        return this.files.filter(f => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query));
    },

    // Get Project Statistics
    getStats() {
        if (this.files.length === 0) {
            return {
                totalFiles: 0,
                totalSize: 0,
                languages: {},
                fileTypes: {}
            };
        }

        const stats = {
            totalFiles: this.files.length,
            totalSize: this.files.reduce((sum, f) => sum + f.size, 0),
            languages: {},
            fileTypes: {}
        };

        this.files.forEach(file => {
            // Count by language
            const lang = file.language || "unknown";
            stats.languages[lang] = (stats.languages[lang] || 0) + 1;

            // Count by extension
            const ext = file.extension || "none";
            stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        });

        return stats;
    },

    // Build File Tree Structure
    buildTree() {
        const tree = {
            name: this.folderName,
            type: "directory",
            children: []
        };

        this.files.forEach(file => {
            const parts = file.path.split("/");
            let current = tree;

            parts.forEach((part, index) => {
                const isLast = index === parts.length - 1;

                if (isLast) {
                    current.children.push({
                        name: part,
                        type: "file",
                        path: file.path,
                        file
                    });
                } else {
                    let dir = current.children.find(c => c.name === part && c.type === "directory");
                    if (!dir) {
                        dir = {
                            name: part,
                            type: "directory",
                            children: []
                        };
                        current.children.push(dir);
                    }
                    current = dir;
                }
            });
        });

        // Sort: directories first, then files (alphabetically)
        const sortTree = node => {
            if (node.children) {
                node.children.sort((a, b) => {
                    if (a.type === b.type) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.type === "directory" ? -1 : 1;
                });
                node.children.forEach(sortTree);
            }
        };
        sortTree(tree);

        return tree;
    },

    // Close Current Folder
    close() {
        // Clear all references to prevent memory leaks
        this.currentHandle = null;
        this.files = []; // Reset array reference
        this.folderName = "";

        // Clear cache properly
        if (this.fileContentCache) {
            this.fileContentCache.clear();
        }

        // Folder closed: logged for debugging
        // console.log("Folder closed, memory cleaned");
    }
};

export default FileSystem;
