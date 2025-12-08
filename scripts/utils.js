/*
   ELYSIA CODE COMPANION v1.2.2 - Utility Functions
   Toast, modals, storage, validation
*/

const Utils = {
    // Toast Notifications
    toast: {
        show(message, type = "info", duration = 3000) {
            const container = document.getElementById("toast-container");
            const toast = document.createElement("div");
            toast.className = `toast ${type}`;

            const icons = {
                success: "✅",
                error: "❌",
                warning: "⚠️",
                info: "ℹ️"
            };

            toast.innerHTML = `
                <span class="toast-icon">${icons[type]}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close">×</button>
            `;

            container.appendChild(toast);

            const close = () => {
                toast.style.animation = "slideOut 0.3s ease";
                setTimeout(() => toast.remove(), 300);
            };

            toast.querySelector(".toast-close").onclick = close;
            if (duration > 0) setTimeout(close, duration);

            return toast;
        },

        success: (msg, duration) => Utils.toast.show(msg, "success", duration),
        error: (msg, duration) => Utils.toast.show(msg, "error", duration),
        warning: (msg, duration) => Utils.toast.show(msg, "warning", duration),
        info: (msg, duration) => Utils.toast.show(msg, "info", duration)
    },

    // Modal Management
    modal: {
        _initialized: false, // Flag to prevent memory leaks from duplicate listeners

        open(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add("active");
                document.body.style.overflow = "hidden";
            }
        },

        close(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove("active");
                document.body.style.overflow = "";
            }
        },

        init() {
            // Prevent duplicate listeners (memory leak)
            if (this._initialized) return;
            this._initialized = true;

            // Close on click outside
            document.querySelectorAll(".modal").forEach(modal => {
                modal.addEventListener("click", e => {
                    if (e.target === modal) {
                        Utils.modal.close(modal.id);
                    }
                });
            });

            // Close buttons
            document.querySelectorAll(".modal-close, [data-modal]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const modalId = btn.getAttribute("data-modal");
                    if (modalId) Utils.modal.close(modalId);
                });
            });
        }
    },

    // Local Storage Wrapper
    storage: {
        get(key, defaultValue = null) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch {
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },

        remove(key) {
            localStorage.removeItem(key);
        },

        clear() {
            localStorage.clear();
        }
    },

    // API Key Validation
    validateApiKey(key) {
        if (!key) {
            return { valid: false, error: "API key is required" };
        }

        if (!key.startsWith("sk-or-")) {
            return { valid: false, error: "Invalid OpenRouter API key format (must start with 'sk-or-')" };
        }

        if (key.length < 20) {
            return { valid: false, error: "API key too short" };
        }

        return { valid: true };
    },

    // File Size Formatter
    formatFileSize(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },

    // Get File Extension
    getFileExtension(filename) {
        const parts = filename.split(".");
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
    },

    // Get Language from Extension
    getLanguageFromExtension(ext) {
        const map = {
            js: "javascript",
            jsx: "javascript",
            ts: "typescript",
            tsx: "typescript",
            py: "python",
            rb: "ruby",
            java: "java",
            cpp: "cpp",
            c: "c",
            h: "c",
            hpp: "cpp",
            cs: "csharp",
            go: "go",
            rs: "rust",
            php: "php",
            html: "html",
            htm: "html",
            css: "css",
            scss: "scss",
            less: "less",
            sass: "sass",
            json: "json",
            xml: "xml",
            md: "markdown",
            sql: "sql",
            sh: "bash",
            bash: "bash",
            zsh: "bash",
            yml: "yaml",
            yaml: "yaml",
            toml: "toml",
            vue: "markup",
            svelte: "markup",
            astro: "markup",
            swift: "swift",
            kt: "kotlin",
            kts: "kotlin",
            dart: "dart",
            lua: "lua",
            r: "r",
            scala: "scala",
            groovy: "groovy",
            txt: "none",
            log: "none",
            env: "bash",
            dockerfile: "docker",
            makefile: "makefile"
        };
        return map[ext] || "none";
    },

    // Debounce Function
    debounce(func, wait) {
        let timeout;
        const debounced = function executedFunction(...args) {
            const later = () => {
                timeout = null;
                func(...args);
            };
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
        // Cleanup method for when component unmounts
        debounced.cancel = () => {
            if (timeout) clearTimeout(timeout);
        };
        return debounced;
    },

    // Copy to Clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.toast.success("Copied to clipboard!");
            return true;
        } catch (err) {
            Utils.toast.error("Failed to copy to clipboard");
            return false;
        }
    },

    // Format Date/Time
    formatDateTime(date) {
        const d = new Date(date);
        const pad = n => n.toString().padStart(2, "0");
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    },

    // Truncate Text
    truncate(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    },

    // Check if File is Text
    isTextFile(filename) {
        const textExtensions = [
            "txt",
            "md",
            "js",
            "jsx",
            "ts",
            "tsx",
            "json",
            "html",
            "css",
            "scss",
            "less",
            "sass",
            "py",
            "rb",
            "java",
            "cpp",
            "c",
            "h",
            "hpp",
            "cs",
            "go",
            "rs",
            "php",
            "xml",
            "yml",
            "yaml",
            "toml",
            "sql",
            "sh",
            "bash",
            "zsh",
            "bat",
            "ps1",
            "vue",
            "svelte",
            "astro",
            "swift",
            "kt",
            "kts",
            "dart",
            "lua",
            "r",
            "scala",
            "groovy",
            "dockerfile",
            "makefile",
            "cmake",
            "env",
            "gitignore",
            "editorconfig"
        ];
        const ext = Utils.getFileExtension(filename);
        // Also check for files without extensions like Dockerfile, Makefile
        const baseName = filename.toLowerCase();
        return (
            textExtensions.includes(ext) ||
            ["dockerfile", "makefile", "gemfile", "rakefile", "procfile"].includes(baseName)
        );
    },

    // Check if File is Code
    isCodeFile(filename) {
        const codeExtensions = [
            "js",
            "jsx",
            "ts",
            "tsx",
            "py",
            "rb",
            "java",
            "cpp",
            "c",
            "cs",
            "go",
            "rs",
            "php",
            "vue",
            "svelte"
        ];
        const ext = Utils.getFileExtension(filename);
        return codeExtensions.includes(ext);
    },

    // Loading Overlay
    loading: {
        show(text = "Processing...") {
            const overlay = document.getElementById("loading-overlay");
            const loadingText = document.getElementById("loading-text");
            if (overlay && loadingText) {
                loadingText.textContent = text;
                overlay.style.display = "flex";
            }
        },

        hide() {
            const overlay = document.getElementById("loading-overlay");
            if (overlay) {
                overlay.style.display = "none";
            }
        },

        update(text) {
            const loadingText = document.getElementById("loading-text");
            if (loadingText) {
                loadingText.textContent = text;
            }
        }
    }
};

// Initialize modals on load
document.addEventListener("DOMContentLoaded", () => {
    Utils.modal.init();
});

export default Utils;
