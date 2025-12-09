/*
   ELYSIA CODE COMPANION v1.2.2 - Main Application
   Entry point and UI orchestration
*/

import Utils from "./utils.js";
import DB from "./db.js";
import FileSystem from "./filesystem.js";
import Chat from "./chat.js";

class App {
    constructor() {
        this.state = {
            apiKey: null,
            model: "x-ai/grok-4.1-fast",
            maxFiles: 100,
            autoPreview: true,
            syntaxHighlighting: true,
            maxResponseTokens: 4000,
            maxHistoryMessages: 20,
            theme: "dark",
            currentFile: null
        };

        this.elements = {
            btnOpenFolder: document.getElementById("btn-open-folder"),
            btnCloseFolder: document.getElementById("btn-close-folder"),
            btnSettings: document.getElementById("btn-settings"),
            btnHistory: document.getElementById("btn-history"),
            btnSaveSettings: document.getElementById("btn-save-settings"),
            btnClearHistory: document.getElementById("btn-clear-history"),
            fileTree: document.getElementById("file-tree"),
            filePreview: document.getElementById("file-preview"),
            folderInfo: document.getElementById("folder-info"),
            folderName: document.getElementById("folder-name"),
            folderStats: document.getElementById("folder-stats"),
            searchFiles: document.getElementById("search-files"),
            apiKeyInput: document.getElementById("api-key"),
            modelSelect: document.getElementById("model-select"),
            maxFilesInput: document.getElementById("max-files"),
            autoPreviewCheckbox: document.getElementById("auto-preview"),
            syntaxHighlightingCheckbox: document.getElementById("syntax-highlighting"),
            maxResponseTokensInput: document.getElementById("max-response-tokens"),
            maxHistoryMessagesInput: document.getElementById("max-history-messages"),
            themeSelect: document.getElementById("theme-select")
        };
    }

    async init() {
        // Load settings
        this.loadSettings();

        // Ensure all modals are closed on startup (safety check)
        document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));

        // Initialize chat
        Chat.init();

        // Setup event listeners
        this.setupEventListeners();

        // Check File System Access API support
        if (!FileSystem.isSupported()) {
            Utils.toast.warning("File System Access API not supported. Please use Chrome or Edge browser.");
        }

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Setup drag & drop for folder
        this.setupDragAndDrop();

        // Apply theme
        this.applyTheme(this.state.theme);

        // App initialized (production: silent mode)
        // console.log("💎 Elysia Code Companion initialized");
    }

    setupDragAndDrop() {
        const dropZone = document.body;

        dropZone.addEventListener("dragover", e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", async e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("drag-over");

            const items = e.dataTransfer.items;

            // Check if folder was dropped
            if (items && items.length > 0) {
                const item = items[0];
                if (item.kind === "file") {
                    const entry = item.webkitGetAsEntry?.();
                    if (entry && entry.isDirectory) {
                        Utils.toast.info(
                            "Drag & drop folder detected. Please use 'Open Folder' button for full access."
                        );
                    } else {
                        Utils.toast.warning("Please drag a folder, not individual files.");
                    }
                }
            }
        });
    }

    setupSidebarToggles() {
        const btnToggleLeft = document.getElementById("btn-toggle-left");
        const btnToggleRight = document.getElementById("btn-toggle-right");
        const sidebarLeft = document.getElementById("sidebar-left");
        const sidebarRight = document.getElementById("sidebar-right");
        const overlay = document.getElementById("sidebar-overlay");

        const isMobile = () => window.innerWidth <= 900;

        // Toggle left sidebar
        btnToggleLeft.addEventListener("click", () => {
            if (isMobile()) {
                sidebarLeft.classList.toggle("visible");
                sidebarRight.classList.remove("visible");
                overlay.classList.toggle("active", sidebarLeft.classList.contains("visible"));
            } else {
                sidebarLeft.classList.toggle("hidden");
            }
            btnToggleLeft.classList.toggle(
                "active",
                isMobile() ? sidebarLeft.classList.contains("visible") : !sidebarLeft.classList.contains("hidden")
            );
            btnToggleRight.classList.remove("active");
        });

        // Toggle right sidebar
        btnToggleRight.addEventListener("click", () => {
            if (isMobile()) {
                sidebarRight.classList.toggle("visible");
                sidebarLeft.classList.remove("visible");
                overlay.classList.toggle("active", sidebarRight.classList.contains("visible"));
            } else {
                sidebarRight.classList.toggle("hidden");
            }
            btnToggleRight.classList.toggle(
                "active",
                isMobile() ? sidebarRight.classList.contains("visible") : !sidebarRight.classList.contains("hidden")
            );
            btnToggleLeft.classList.remove("active");
        });

        // Close sidebars when clicking overlay
        overlay.addEventListener("click", () => {
            sidebarLeft.classList.remove("visible");
            sidebarRight.classList.remove("visible");
            overlay.classList.remove("active");
            btnToggleLeft.classList.remove("active");
            btnToggleRight.classList.remove("active");
        });

        // Set initial active state for desktop (sidebars visible by default)
        if (!isMobile()) {
            btnToggleLeft.classList.add("active");
            btnToggleRight.classList.add("active");
        }

        // Handle resize
        window.addEventListener("resize", () => {
            if (!isMobile()) {
                sidebarLeft.classList.remove("visible");
                sidebarRight.classList.remove("visible");
                overlay.classList.remove("active");
            }
        });
    }

    applyTheme(theme) {
        document.body.setAttribute("data-theme", theme);
        this.state.theme = theme;
        Utils.storage.set("theme", theme);
    }

    setupKeyboardShortcuts() {
        document.addEventListener("keydown", e => {
            // Ctrl+O: Open folder
            if (e.ctrlKey && e.key === "o") {
                e.preventDefault();
                this.openFolder();
            }
            // Ctrl+K: Focus search
            if (e.ctrlKey && e.key === "k") {
                e.preventDefault();
                this.elements.searchFiles.focus();
            }
            // Escape: Close modals
            if (e.key === "Escape") {
                document.querySelectorAll(".modal.active").forEach(modal => {
                    Utils.modal.close(modal.id);
                });
            }
            // Ctrl+Enter: Send message (when chat input focused)
            if (e.ctrlKey && e.key === "Enter" && document.activeElement === document.getElementById("chat-input")) {
                e.preventDefault();
                Chat.sendMessage();
            }
            // Arrow Up/Down: Navigate file tree (when file tree focused)
            if ((e.key === "ArrowUp" || e.key === "ArrowDown") && document.activeElement.closest(".file-tree")) {
                e.preventDefault();
                this.navigateFileTree(e.key === "ArrowUp" ? -1 : 1);
            }
            // Enter: Open selected file in tree
            if (e.key === "Enter" && document.activeElement.classList.contains("tree-item")) {
                e.preventDefault();
                const path = document.activeElement.dataset.path;
                if (path) this.previewFile(path);
            }
        });
    }

    setupEventListeners() {
        // Folder actions
        this.elements.btnOpenFolder.addEventListener("click", () => this.openFolder());
        this.elements.btnCloseFolder.addEventListener("click", () => this.closeFolder());

        // Settings
        this.elements.btnSettings.addEventListener("click", () => {
            this.populateSettings();
            Utils.modal.open("modal-settings");
        });

        this.elements.btnSaveSettings.addEventListener("click", () => {
            this.saveSettings();
            Utils.modal.close("modal-settings");
        });

        // History
        this.elements.btnHistory.addEventListener("click", () => {
            this.loadHistory();
            Utils.modal.open("modal-history");
        });

        this.elements.btnClearHistory.addEventListener("click", async () => {
            if (confirm("Are you sure you want to clear all chat history?")) {
                await DB.clearChats();
                this.loadHistory();
            }
        });

        // Sidebar toggles
        this.setupSidebarToggles();

        // File search
        this.elements.searchFiles.addEventListener(
            "input",
            Utils.debounce(e => this.searchFiles(e.target.value), 300)
        );

        // API Key visibility toggle
        const btnToggleApiKey = document.getElementById("btn-toggle-api-key");
        if (btnToggleApiKey) {
            btnToggleApiKey.addEventListener("click", () => {
                const apiKeyInput = this.elements.apiKeyInput;
                const isPassword = apiKeyInput.type === "password";
                apiKeyInput.type = isPassword ? "text" : "password";
                btnToggleApiKey.textContent = isPassword ? "🙈" : "👁️";
            });
        }

        // About modal
        const btnAbout = document.getElementById("btn-about");

        if (btnAbout) {
            btnAbout.addEventListener("click", e => {
                e.preventDefault();
                Utils.modal.open("modal-about");
            });
        }
    }

    loadSettings() {
        this.state.apiKey = Utils.storage.get("apiKey");
        this.state.model = Utils.storage.get("model", "x-ai/grok-4.1-fast");
        this.state.maxFiles = Utils.storage.get("maxFiles", 100);
        this.state.autoPreview = Utils.storage.get("autoPreview", true);
        this.state.syntaxHighlighting = Utils.storage.get("syntaxHighlighting", true);
        this.state.maxResponseTokens = Utils.storage.get("maxResponseTokens", 4000);
        this.state.maxHistoryMessages = Utils.storage.get("maxHistoryMessages", 20);
        this.state.theme = Utils.storage.get("theme", "dark");
    }

    populateSettings() {
        this.elements.apiKeyInput.value = this.state.apiKey || "";
        this.elements.modelSelect.value = this.state.model;
        this.elements.maxFilesInput.value = this.state.maxFiles;
        this.elements.autoPreviewCheckbox.checked = this.state.autoPreview;
        this.elements.syntaxHighlightingCheckbox.checked = this.state.syntaxHighlighting;
        this.elements.maxResponseTokensInput.value = this.state.maxResponseTokens;
        this.elements.maxHistoryMessagesInput.value = this.state.maxHistoryMessages;
        this.elements.themeSelect.value = this.state.theme;
    }

    saveSettings() {
        this.state.apiKey = this.elements.apiKeyInput.value;
        this.state.model = this.elements.modelSelect.value;
        this.state.maxFiles = parseInt(this.elements.maxFilesInput.value);
        this.state.autoPreview = this.elements.autoPreviewCheckbox.checked;
        this.state.syntaxHighlighting = this.elements.syntaxHighlightingCheckbox.checked;
        this.state.maxResponseTokens = parseInt(this.elements.maxResponseTokensInput.value);
        this.state.maxHistoryMessages = parseInt(this.elements.maxHistoryMessagesInput.value);
        this.state.theme = this.elements.themeSelect.value;

        Utils.storage.set("apiKey", this.state.apiKey);
        Utils.storage.set("model", this.state.model);
        Utils.storage.set("maxFiles", this.state.maxFiles);
        Utils.storage.set("autoPreview", this.state.autoPreview);
        Utils.storage.set("syntaxHighlighting", this.state.syntaxHighlighting);
        Utils.storage.set("maxResponseTokens", this.state.maxResponseTokens);
        Utils.storage.set("maxHistoryMessages", this.state.maxHistoryMessages);

        // Update Chat module with new history limit
        if (window.Chat) {
            window.Chat.maxHistoryMessages = this.state.maxHistoryMessages;
        }

        // Apply theme
        this.applyTheme(this.state.theme);

        Utils.toast.success("Settings saved!");
    }

    async openFolder() {
        Utils.loading.show("Opening folder picker...");

        try {
            const result = await FileSystem.openFolder();
            if (!result) {
                Utils.loading.hide();
                return;
            }

            Utils.loading.update("Loading files...");

            // Update UI
            this.elements.folderInfo.style.display = "block";
            this.elements.folderName.textContent = result.name;
            this.elements.folderStats.textContent = `${result.files.length} files`;
            this.elements.btnOpenFolder.style.display = "none";
            this.elements.btnCloseFolder.style.display = "block";

            // Update chat context
            Chat.updateContextInfo();

            // Render file tree
            Utils.loading.update("Rendering file tree...");
            this.renderFileTree();

            Utils.loading.hide();
        } catch (err) {
            Utils.loading.hide();
            console.error("Failed to open folder:", err);
            Utils.toast.error("Failed to open folder: " + err.message);
        }
    }

    closeFolder() {
        // Confirm if there's chat history in current session
        if (Chat && Chat.messageContainer) {
            const messageCount = Chat.messageContainer.querySelectorAll(".message.user").length;
            if (messageCount > 0) {
                if (!confirm(`You have ${messageCount} message(s) in this session. Close folder and lose context?`)) {
                    return;
                }
            }
        }

        FileSystem.close();

        // Update UI
        this.elements.folderInfo.style.display = "none";
        this.elements.btnOpenFolder.style.display = "block";
        this.elements.btnCloseFolder.style.display = "none";
        this.elements.fileTree.innerHTML = `
            <div class="empty-state">
                <p>📂 No folder opened</p>
                <p class="hint">Click "Open Folder" to start</p>
            </div>
        `;
        this.elements.filePreview.innerHTML = `
            <div class="empty-state">
                <p>📄 No file selected</p>
                <p class="hint">Click a file in the tree to preview</p>
            </div>
        `;

        // Update chat context
        Chat.updateContextInfo();

        Utils.toast.info("Folder closed");
    }

    renderFileTree() {
        const tree = FileSystem.buildTree();
        this.elements.fileTree.innerHTML = "";

        // Performance optimization: Collapse large directories by default
        const shouldCollapseByDefault = FileSystem.files.length > 100;

        const renderNode = (node, parentEl, level = 0) => {
            if (node.type === "directory") {
                const folderEl = document.createElement("div");
                folderEl.className = "tree-folder";

                const isCollapsed = shouldCollapseByDefault && level > 0;

                const folderHeader = document.createElement("div");
                folderHeader.className = "tree-item tree-folder-header";
                folderHeader.style.paddingLeft = `${level * 1.5}rem`;
                folderHeader.innerHTML = `
                    <span class="icon">${isCollapsed ? "📁" : "📂"}</span>
                    <span>${node.name}</span>
                `;

                // Toggle collapse on click
                folderHeader.addEventListener("click", () => {
                    const isCurrentlyCollapsed = folderHeader.querySelector(".icon").textContent === "📁";
                    folderHeader.querySelector(".icon").textContent = isCurrentlyCollapsed ? "📂" : "📁";
                    childrenContainer.style.display = isCurrentlyCollapsed ? "block" : "none";
                });

                folderEl.appendChild(folderHeader);

                const childrenContainer = document.createElement("div");
                childrenContainer.className = "tree-children";
                childrenContainer.style.display = isCollapsed ? "none" : "block";

                if (node.children) {
                    node.children.forEach(child => renderNode(child, childrenContainer, level + 1));
                }

                folderEl.appendChild(childrenContainer);
                parentEl.appendChild(folderEl);
            } else {
                const fileEl = document.createElement("div");
                fileEl.className = "tree-item";
                fileEl.style.paddingLeft = `${level * 1.5}rem`;
                fileEl.dataset.path = node.path; // Add data attribute for identification
                fileEl.innerHTML = `
                    <span class="icon">📄</span>
                    <span>${node.name}</span>
                `;

                fileEl.addEventListener("click", e => {
                    // Highlight active file properly
                    document.querySelectorAll(".tree-item").forEach(el => el.classList.remove("active"));
                    fileEl.classList.add("active");
                    this.previewFile(node.path);

                    // Mobile UX: Close sidebar automatically after file selection
                    if (window.innerWidth <= 900) {
                        const sidebarLeft = document.getElementById("sidebar-left");
                        const overlay = document.getElementById("sidebar-overlay");
                        sidebarLeft.classList.remove("visible");
                        overlay.classList.remove("active");
                        document.getElementById("btn-toggle-left").classList.remove("active");
                    }
                });

                parentEl.appendChild(fileEl);
            }
        };

        if (tree.children) {
            tree.children.forEach(child => renderNode(child, this.elements.fileTree));
        }
    }

    async previewFile(path) {
        try {
            const fileEntry = FileSystem.getFileByPath(path);
            if (!fileEntry) return;

            // Highlight active file IMMEDIATELY (before loading) for instant feedback
            document.querySelectorAll(".tree-item").forEach(el => el.classList.remove("active"));
            // Find and highlight the clicked item by path (not name - multiple files can have same name!)
            const activeItem = document.querySelector(`.tree-item[data-path="${CSS.escape(fileEntry.path)}"]`);
            if (activeItem) activeItem.classList.add("active");

            this.state.currentFile = fileEntry;

            // Show loading indicator for large files (>100KB)
            if (fileEntry.size > 100 * 1024) {
                this.elements.filePreview.innerHTML = '<div class="empty-state"><p>📄 Loading file...</p></div>';
            }

            // Read file content
            const content = await FileSystem.readFile(fileEntry);

            // Render preview
            const language = fileEntry.language;
            const escapedContent = Utils.escapeHtml(content);
            const escapedPath = Utils.escapeHtml(fileEntry.path);
            const escapedName = Utils.escapeHtml(fileEntry.name);

            // Check if file can be shown as artifact
            const canShowArtifact = ["html", "htm"].includes(fileEntry.extension);

            this.elements.filePreview.innerHTML = `
                <div class="preview-header">
                    <span class="preview-filename">${escapedPath}</span>
                    <div class="preview-actions">
                        <button class="btn-icon" onclick="app.copyFileContent()" title="Copy">📋</button>
                        <button class="btn-icon" onclick="app.viewFileFullscreen()" title="View Fullscreen">🔍</button>
                        ${canShowArtifact ? '<button class="btn-icon" onclick="app.viewAsArtifact()" title="Preview as Artifact">✨</button>' : ""}
                    </div>
                </div>
                <pre><code class="language-${language}">${escapedContent}</code></pre>
            `;

            // Apply syntax highlighting
            if (this.state.syntaxHighlighting && window.Prism) {
                const codeBlock = this.elements.filePreview.querySelector("code");
                Prism.highlightElement(codeBlock);
            }
        } catch (err) {
            console.error("Failed to preview file:", err);
            Utils.toast.error("Failed to preview file");
        }
    }

    async copyFileContent() {
        if (!this.state.currentFile) return;

        try {
            const content = await FileSystem.readFile(this.state.currentFile);
            await Utils.copyToClipboard(content);
        } catch (err) {
            console.error("Failed to copy:", err);
            Utils.toast.error("Failed to copy file content");
        }
    }

    searchFiles(query) {
        if (!query) {
            this.renderFileTree();
            return;
        }

        const results = FileSystem.searchFiles(query);
        this.elements.fileTree.innerHTML = "";

        if (results.length === 0) {
            this.elements.fileTree.innerHTML = `
                <div class="empty-state">
                    <p>No files found</p>
                </div>
            `;
            return;
        }

        results.forEach(file => {
            const fileEl = document.createElement("div");
            fileEl.className = "tree-item";
            fileEl.dataset.path = file.path;
            fileEl.innerHTML = `
                <span class="icon">📄</span>
                <span>${file.path}</span>
            `;
            fileEl.addEventListener("click", e => {
                document.querySelectorAll(".tree-item").forEach(el => el.classList.remove("active"));
                fileEl.classList.add("active");
                this.previewFile(file.path);

                // Mobile UX: Close sidebar automatically after file selection
                if (window.innerWidth <= 900) {
                    const sidebarLeft = document.getElementById("sidebar-left");
                    const overlay = document.getElementById("sidebar-overlay");
                    sidebarLeft.classList.remove("visible");
                    overlay.classList.remove("active");
                    document.getElementById("btn-toggle-left").classList.remove("active");
                }
            });
            this.elements.fileTree.appendChild(fileEl);
        });
    }

    async loadHistory() {
        const chats = await DB.getChats(20);
        const historyList = document.getElementById("history-list");

        if (chats.length === 0) {
            historyList.innerHTML = `<p class="empty-state">No chat history yet</p>`;
            return;
        }

        // Add read-only notice at the top
        let html = `<p style="padding: 0.75rem 1rem; background: var(--bg-tertiary); color: var(--text-secondary); font-size: 0.85rem; margin: 0; border-bottom: 1px solid var(--border-color);">
            📖 Read-only history — Start a new chat to continue coding!
        </p>`;

        html += chats
            .map(chat => {
                const date = new Date(chat.timestamp);
                // Escape ALL user-controlled content to prevent XSS
                const escapedModel = Utils.escapeHtml(chat.model || "unknown");
                const escapedUserMsg = Utils.escapeHtml(Utils.truncate(chat.userMessage, 100));
                const escapedAssistantMsg = Utils.escapeHtml(Utils.truncate(chat.assistantMessage, 150));
                const escapedDate = Utils.escapeHtml(date.toLocaleString());
                const escapedFolderName = Utils.escapeHtml(chat.folderName || "Unknown");
                return `
                <div class="history-item" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        ${escapedDate} • ${escapedModel} • ${escapedFolderName}
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        <strong>You:</strong> ${escapedUserMsg}
                    </div>
                    <div>
                        <strong>Assistant:</strong> ${escapedAssistantMsg}
                    </div>
                </div>
            `;
            })
            .join("");

        historyList.innerHTML = html;
    }

    // Navigate file tree with keyboard
    navigateFileTree(direction) {
        const items = Array.from(document.querySelectorAll(".tree-item[data-path]"));
        if (items.length === 0) return;

        const currentIndex = items.findIndex(el => el.classList.contains("active"));
        let newIndex = currentIndex + direction;

        // Wrap around
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;

        // Update active state
        items.forEach(el => el.classList.remove("active"));
        items[newIndex].classList.add("active");
        items[newIndex].focus();
        items[newIndex].scrollIntoView({ block: "nearest" });
    }

    // Fullscreen Code Viewer
    async viewFileFullscreen() {
        if (!this.state.currentFile) return;

        try {
            const content = await FileSystem.readFile(this.state.currentFile);
            const language = this.state.currentFile.language;
            const escapedContent = Utils.escapeHtml(content);

            // Update modal content
            document.getElementById("viewer-filename").textContent = `📄 ${this.state.currentFile.name}`;
            document.getElementById("viewer-file-info").textContent =
                `${this.state.currentFile.extension} • ${Utils.formatFileSize(this.state.currentFile.size)}`;

            const viewerContent = document.getElementById("viewer-content");
            viewerContent.innerHTML = `<pre><code class="language-${language}">${escapedContent}</code></pre>`;

            // Apply syntax highlighting
            if (this.state.syntaxHighlighting && window.Prism) {
                const codeBlock = viewerContent.querySelector("code");
                Prism.highlightElement(codeBlock);
            }

            // Show/hide artifact button
            const artifactBtn = document.getElementById("btn-viewer-artifact");
            const canShowArtifact = ["html", "htm"].includes(this.state.currentFile.extension);
            artifactBtn.style.display = canShowArtifact ? "block" : "none";

            // Setup buttons
            document.getElementById("btn-viewer-copy").onclick = () => this.copyFileContent();
            document.getElementById("btn-viewer-artifact").onclick = () => {
                Utils.modal.close("modal-code-viewer");
                this.viewAsArtifact();
            };

            // Open modal
            Utils.modal.open("modal-code-viewer");
        } catch (err) {
            console.error("Failed to view file:", err);
            Utils.toast.error("Failed to open file viewer");
        }
    }

    // Artifact Preview (HTML Live Preview)
    async viewAsArtifact() {
        if (!this.state.currentFile) return;

        try {
            const content = await FileSystem.readFile(this.state.currentFile);

            // Update modal
            document.getElementById("artifact-filename").textContent = this.state.currentFile.name;

            // Resolve dependencies (CSS/JS in same folder)
            const processedContent = await this.resolveArtifactDependencies(content);

            // Load into iframe
            const iframe = document.getElementById("artifact-iframe");

            // Security: sandbox restricts capabilities
            // allow-scripts: needed for JS in artifacts
            // allow-forms: needed for form submission preview
            // NOTE: allow-same-origin removed for security (prevents parent access)
            iframe.setAttribute("sandbox", "allow-scripts allow-forms");

            iframe.srcdoc = processedContent;

            // Setup buttons
            document.getElementById("btn-artifact-refresh").onclick = () => {
                iframe.srcdoc = processedContent;
                Utils.toast.success("Artifact refreshed");
            };

            document.getElementById("btn-artifact-code").onclick = () => {
                Utils.modal.close("modal-artifact");
                this.viewFileFullscreen();
            };

            // Open modal
            Utils.modal.open("modal-artifact");
        } catch (err) {
            console.error("Failed to view artifact:", err);
            Utils.toast.error("Failed to preview artifact");
        }
    }

    // Resolve CSS/JS dependencies in HTML
    async resolveArtifactDependencies(htmlContent) {
        // Get current file's directory
        const currentPath = this.state.currentFile.path;
        const dirPath = currentPath.substring(0, currentPath.lastIndexOf("/"));

        // Find all local references (href/src with relative paths)
        let processed = htmlContent;

        // Match CSS links
        const cssRegex = /<link[^>]+href=["'](?!http|https|\/\/)([^"']+)["'][^>]*>/gi;
        const cssMatches = [...htmlContent.matchAll(cssRegex)];

        for (const match of cssMatches) {
            const relativePath = match[1];
            const fullPath = dirPath ? `${dirPath}/${relativePath}` : relativePath;
            const cssFile = FileSystem.getFileByPath(fullPath);

            if (cssFile) {
                try {
                    const cssContent = await FileSystem.readFile(cssFile);
                    // Replace link tag with inline style
                    processed = processed.replace(match[0], `<style>${cssContent}</style>`);
                } catch (err) {
                    console.warn(`Could not load CSS: ${fullPath}`);
                }
            }
        }

        // Match JS scripts
        const jsRegex = /<script[^>]+src=["'](?!http|https|\/\/)([^"']+)["'][^>]*><\/script>/gi;
        const jsMatches = [...htmlContent.matchAll(jsRegex)];

        for (const match of jsMatches) {
            const relativePath = match[1];
            const fullPath = dirPath ? `${dirPath}/${relativePath}` : relativePath;
            const jsFile = FileSystem.getFileByPath(fullPath);

            if (jsFile) {
                try {
                    const jsContent = await FileSystem.readFile(jsFile);
                    // Replace script tag with inline script
                    processed = processed.replace(match[0], `<script>${jsContent}</script>`);
                } catch (err) {
                    console.warn(`Could not load JS: ${fullPath}`);
                }
            }
        }

        return processed;
    }
}

// Create global app instance
const app = new App();

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    app.init();
});

// Export for window access (for inline onclick handlers)
window.app = app;

export default app;
