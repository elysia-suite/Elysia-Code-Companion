/*
   ELYSIA CODE COMPANION v1.2.2 - Chat Interface
   Real-time chat with Elysia AI
*/

import API from "./api.js";
import Utils from "./utils.js";
import DB from "./db.js";
import FileSystem from "./filesystem.js";
import Analyzer from "./analyzer.js";

const Chat = {
    messageContainer: null,
    inputField: null,
    sendButton: null,
    cancelButton: null,
    contextInfo: null,
    isProcessing: false, // Prevent concurrent API calls
    lastRequestTime: 0,
    minRequestInterval: 1000, // 1 second between requests
    currentAbortController: null, // For request cancellation
    markdownUpdateThrottle: 100, // ms between markdown re-renders
    conversationHistory: [], // Store conversation history for context
    maxHistoryMessages: 20, // Max messages to keep in context (loaded from settings)

    init() {
        this.messageContainer = document.getElementById("chat-messages");
        this.inputField = document.getElementById("chat-input");
        this.sendButton = document.getElementById("btn-send");
        this.cancelButton = document.getElementById("btn-cancel");
        this.contextInfo = document.getElementById("context-info");

        // Load maxHistoryMessages from settings
        this.maxHistoryMessages = Utils.storage.get("maxHistoryMessages", 20);

        // Make Chat globally accessible for settings updates
        window.Chat = this;

        // Event Listeners
        this.sendButton.addEventListener("click", () => this.sendMessage());

        // Cancel button
        if (this.cancelButton) {
            this.cancelButton.addEventListener("click", () => this.cancelRequest());
        }

        this.inputField.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.inputField.addEventListener("input", () => {
            this.updateSendButtonState();
        });
    },

    // Clear conversation history (for new chat)
    clearHistory() {
        this.conversationHistory = [];
        console.log("💬 Conversation history cleared");
    },

    updateSendButtonState() {
        const charCount = document.getElementById("char-count");
        const len = this.inputField.value.length;
        charCount.textContent = `${len} / 10000`;

        // Enable/disable send button - also check if processing
        this.sendButton.disabled = len === 0 || len > 10000 || this.isProcessing;
    },

    updateContextInfo() {
        if (FileSystem.folderName) {
            this.contextInfo.textContent = `📂 ${FileSystem.folderName} (${FileSystem.files.length} files)`;
        } else {
            this.contextInfo.textContent = "No folder opened";
        }
    },

    async sendMessage() {
        const input = this.inputField.value.trim();
        if (!input) return;

        // Rate limiting
        const now = Date.now();
        if (this.isProcessing) {
            Utils.toast.warning("Please wait for the current request to complete");
            return;
        }
        if (now - this.lastRequestTime < this.minRequestInterval) {
            Utils.toast.warning("Please wait a moment between requests");
            return;
        }

        this.isProcessing = true;
        this.lastRequestTime = now;

        // Clear input
        this.inputField.value = "";
        this.sendButton.disabled = true;

        // Parse input
        const parsed = Analyzer.parseCommand(input);

        // Add user message to UI
        this.addMessage(input, "user");

        // Handle commands
        if (parsed.type === "command") {
            try {
                await this.handleCommand(parsed.command, parsed.args);
            } catch (err) {
                console.error("Command failed:", err);
                this.addMessage(`Command error: ${err.message}`, "error");
            } finally {
                this.isProcessing = false;
                this.sendButton.disabled = false;
            }
            return;
        }

        // Handle regular message - call Elysia
        try {
            await this.callElysia(input);
        } catch (err) {
            console.error("Failed to send message:", err);
            this.addMessage(`Error: ${err.message}`, "error");
        } finally {
            this.isProcessing = false;
            this.sendButton.disabled = false;
        }
    },

    async handleCommand(command, args) {
        try {
            switch (command) {
                case "scan":
                    await this.commandScan();
                    break;

                case "analyze":
                    await this.commandAnalyze(args);
                    break;

                case "tree":
                    await this.commandTree();
                    break;

                case "stats":
                    await this.commandStats();
                    break;

                case "help":
                    this.commandHelp();
                    break;

                case "export":
                    await this.commandExport(args);
                    break;

                default:
                    this.addMessage(`Unknown command: /${command}. Type /help for available commands.`, "error");
            }
        } catch (err) {
            console.error("Command execution error:", err);
            this.addMessage(`Command error: ${err.message}`, "error");
            throw err; // Re-throw to ensure isProcessing reset in sendMessage
        }
    },

    async commandScan() {
        if (FileSystem.files.length === 0) {
            this.addMessage("No folder opened. Open a folder first!", "error");
            return;
        }

        this.addMessage("🔍 Scanning project... (this may take a moment)", "system");

        try {
            const analysis = Analyzer.analyzeProject();

            let response = `## 📊 Project Analysis: ${analysis.summary.name}\n\n`;
            response += `**Total Files:** ${analysis.summary.totalFiles}\n`;
            response += `**Total Size:** ${analysis.summary.totalSize}\n\n`;

            response += `**Languages:**\n`;
            Object.entries(analysis.summary.languages).forEach(([lang, count]) => {
                response += `- ${lang}: ${count} file(s)\n`;
            });

            if (analysis.insights.length > 0) {
                response += `\n**Insights:**\n`;
                analysis.insights.forEach(insight => {
                    const icon = insight.type === "success" ? "✅" : insight.type === "warning" ? "⚠️" : "ℹ️";
                    response += `${icon} ${insight.message}\n`;
                });
            }

            // Ask Elysia to analyze further
            response += `\n\nAsking Elysia to provide deeper insights...\n`;
            this.addMessage(response, "system");

            await this.callElysia(`Analyze this project. Here's the summary:\n${JSON.stringify(analysis, null, 2)}`);
        } catch (err) {
            console.error("Scan failed:", err);
            this.addMessage(`Scan failed: ${err.message}`, "error");
        }
    },

    async commandAnalyze(filename) {
        if (!filename) {
            this.addMessage("Usage: /analyze <filename>", "error");
            return;
        }

        if (FileSystem.files.length === 0) {
            this.addMessage("No folder opened. Open a folder first!", "error");
            return;
        }

        const file = FileSystem.files.find(
            f =>
                f.name.toLowerCase() === filename.toLowerCase() || f.path.toLowerCase().includes(filename.toLowerCase())
        );

        if (!file) {
            this.addMessage(`File not found: ${filename}`, "error");
            return;
        }

        try {
            this.addMessage(`🔍 Analyzing ${file.path}...`, "system");
            const analysis = await Analyzer.analyzeFile(file.path);

            let response = `## 📄 File Analysis: ${analysis.name}\n\n`;
            response += `**Path:** ${analysis.path}\n`;
            response += `**Size:** ${analysis.size}\n`;
            response += `**Language:** ${analysis.language}\n`;
            response += `**Lines:** ${analysis.lines}\n`;
            if (analysis.linesOfCode) {
                response += `**Code Lines:** ${analysis.linesOfCode}\n`;
            }

            if (analysis.insights.length > 0) {
                response += `\n**Quick Insights:**\n`;
                analysis.insights.forEach(insight => {
                    const icon = insight.type === "warning" ? "⚠️" : "ℹ️";
                    response += `${icon} ${insight.message}\n`;
                });
            }

            response += `\n\nAsking Elysia for detailed analysis...\n`;
            this.addMessage(response, "system");

            // Ask Elysia to analyze the code
            const contextFiles = [
                {
                    name: analysis.name,
                    path: analysis.path,
                    language: analysis.language,
                    content: analysis.content
                }
            ];

            await this.callElysia(
                `Please analyze this file in detail. Look for bugs, code smells, performance issues, and suggest improvements.`,
                contextFiles
            );
        } catch (err) {
            console.error("Analysis failed:", err);
            this.addMessage(`Analysis failed: ${err.message}`, "error");
        }
    },

    async commandTree() {
        if (FileSystem.files.length === 0) {
            this.addMessage("No folder opened. Open a folder first!", "error");
            return;
        }

        const tree = FileSystem.buildTree();
        const treeText = Analyzer.generateTreeText(tree);

        const response = `## 🌳 Project Structure\n\n\`\`\`\n${treeText}\`\`\``;
        this.addMessage(response, "system");
    },

    async commandStats() {
        if (FileSystem.files.length === 0) {
            this.addMessage("No folder opened. Open a folder first!", "error");
            return;
        }

        const stats = FileSystem.getStats();

        let response = `## 📊 Project Statistics\n\n`;
        response += `**Total Files:** ${stats.totalFiles}\n`;
        response += `**Total Size:** ${Utils.formatFileSize(stats.totalSize)}\n\n`;

        response += `**Languages:**\n`;
        Object.entries(stats.languages)
            .sort((a, b) => b[1] - a[1])
            .forEach(([lang, count]) => {
                response += `- ${lang}: ${count} file(s)\n`;
            });

        response += `\n**File Types:**\n`;
        Object.entries(stats.fileTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([ext, count]) => {
                response += `- .${ext}: ${count} file(s)\n`;
            });

        this.addMessage(response, "system");
    },

    commandHelp() {
        const helpText = `## 🎯 Available Commands

**/scan** - Analyze entire project structure
**/analyze <filename>** - Deep analysis of specific file
**/tree** - Show project file tree
**/stats** - Project statistics (files, languages, etc.)
**/export [format]** - Export conversation (markdown/json/txt)
**/help** - Show this help message

**💡 Tips:**
- Just chat naturally! Ask me about your code, and I'll help.
- Mention specific files in your questions, and I'll include them in context.
- I can explain complex code, suggest improvements, find bugs, and more!

**Examples:**
- "What does app.js do?"
- "Find bugs in utils.ts"
- "How can I improve the performance of this component?"
- "Explain the architecture of this project"`;

        this.addMessage(helpText, "system");
    },

    async commandExport(format = "markdown") {
        const validFormats = ["markdown", "md", "json", "txt"];
        // CRITICAL: Lowercase BEFORE validation to prevent crash
        const exportFormat = (format || "markdown").toLowerCase();

        if (!validFormats.includes(exportFormat)) {
            this.addMessage(`Invalid format. Use: /export [markdown|json|txt]`, "error");
            return;
        }

        try {
            Utils.loading.show("Exporting conversation...");

            // Get all messages from current session
            const messages = Array.from(this.messageContainer.querySelectorAll(".message"));

            let exportContent = "";
            const exportData = [];

            messages.forEach(msg => {
                const type = msg.classList.contains("user")
                    ? "user"
                    : msg.classList.contains("assistant")
                      ? "assistant"
                      : "system";
                const author = msg.querySelector(".message-author")?.textContent || type;
                const time = msg.querySelector(".message-time")?.textContent || "";
                const content = msg.querySelector(".message-content")?.textContent || "";

                exportData.push({ type, author, time, content });
            });

            // Generate export based on format
            if (exportFormat === "json") {
                exportContent = JSON.stringify(
                    {
                        exported: new Date().toISOString(),
                        project: FileSystem.folderName || "No project",
                        messages: exportData
                    },
                    null,
                    2
                );
            } else if (exportFormat === "txt") {
                exportContent = `Elysia Code Companion - Conversation Export\n`;
                exportContent += `Exported: ${new Date().toLocaleString()}\n`;
                exportContent += `Project: ${FileSystem.folderName || "No project"}\n`;
                exportContent += `${"=".repeat(60)}\n\n`;

                exportData.forEach(msg => {
                    exportContent += `[${msg.time}] ${msg.author}:\n${msg.content}\n\n`;
                });
            } else {
                // Markdown (default)
                exportContent = `# 💎 Elysia Code Companion - Conversation\n\n`;
                exportContent += `**Exported:** ${new Date().toLocaleString()}\n`;
                exportContent += `**Project:** ${FileSystem.folderName || "No project"}\n\n`;
                exportContent += `---\n\n`;

                exportData.forEach(msg => {
                    exportContent += `## ${msg.author} (${msg.time})\n\n`;
                    exportContent += `${msg.content}\n\n`;
                    exportContent += `---\n\n`;
                });
            }

            // Download file
            const blob = new Blob([exportContent], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
            const extension = exportFormat === "json" ? "json" : exportFormat === "txt" ? "txt" : "md";
            a.href = url;
            a.download = `elysia-conversation-${timestamp}.${extension}`;
            a.click();
            URL.revokeObjectURL(url);

            Utils.loading.hide();
            Utils.toast.success(`Conversation exported as ${extension.toUpperCase()}`);
            this.addMessage(
                `✅ Conversation exported successfully as **${extension.toUpperCase()}** format.`,
                "system"
            );
        } catch (err) {
            Utils.loading.hide();
            console.error("Export failed:", err);
            this.addMessage(`Export failed: ${err.message}`, "error");
        }
    },

    async callElysia(userMessage, contextFiles = null) {
        // Get context files if not provided
        if (!contextFiles && FileSystem.files.length > 0) {
            contextFiles = await Analyzer.getContextFiles(userMessage, 3);
        }

        // Build system prompt
        const systemPrompt = API.getSystemPrompt({
            folderName: FileSystem.folderName,
            fileCount: FileSystem.files.length,
            files: contextFiles
        });

        // Add user message to conversation history
        this.conversationHistory.push({ role: "user", content: userMessage });

        // Trim history if too long (keep last N messages)
        while (this.conversationHistory.length > this.maxHistoryMessages) {
            this.conversationHistory.shift();
        }

        // Build messages array with full history
        const messages = [{ role: "system", content: systemPrompt }, ...this.conversationHistory];

        // Create message element for streaming
        const messageEl = this.addMessage("", "assistant", true);
        const contentEl = messageEl.querySelector(".message-content");

        // Show cancel button, hide send
        this.showCancelButton(true);

        try {
            // Create abort controller for cancellation
            this.currentAbortController = new AbortController();

            // Throttle markdown rendering for performance
            let lastRenderTime = 0;
            let pendingContent = "";
            let renderTimeoutId = null;

            const renderMarkdown = content => {
                contentEl.innerHTML = marked.parse(content);
                // Syntax highlighting
                contentEl.querySelectorAll("pre code").forEach(block => {
                    if (window.Prism) {
                        Prism.highlightElement(block);
                    }
                });
                // Scroll to bottom
                this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
            };

            // Stream response
            const fullContent = await API.stream(
                messages,
                (chunk, full) => {
                    const now = Date.now();
                    pendingContent = full;

                    // Throttle rendering to every 100ms for performance
                    if (now - lastRenderTime >= this.markdownUpdateThrottle) {
                        renderMarkdown(full);
                        lastRenderTime = now;
                    } else if (!renderTimeoutId) {
                        // Schedule final render
                        renderTimeoutId = setTimeout(() => {
                            renderMarkdown(pendingContent);
                            renderTimeoutId = null;
                        }, this.markdownUpdateThrottle);
                    }
                },
                { signal: this.currentAbortController.signal }
            );

            // Final render to ensure complete content
            if (renderTimeoutId) clearTimeout(renderTimeoutId);
            renderMarkdown(fullContent);

            // Add assistant response to conversation history
            this.conversationHistory.push({ role: "assistant", content: fullContent });

            // Save to database
            await DB.saveChat(userMessage, fullContent, {
                model: Utils.storage.get("model"),
                folderName: FileSystem.folderName,
                fileCount: FileSystem.files.length
            });
        } catch (err) {
            const escapedError = Utils.escapeHtml(err.message);

            // Check if request was cancelled (not an actual error)
            if (err.name === "AbortError" || err.message.includes("cancelled")) {
                contentEl.innerHTML = `<p style="color: var(--text-secondary);">⏹️ Request cancelled</p>`;
                Utils.toast.info("Request cancelled");
            } else {
                contentEl.innerHTML = `<p class="error">❌ Error: ${escapedError}</p>`;
                console.error("Elysia call failed:", err);
                Utils.toast.error("Failed to get response from Elysia");
            }

            // Remove the failed user message from history (but not if cancelled)
            if (err.name !== "AbortError" && !err.message.includes("cancelled")) {
                this.conversationHistory.pop();
            }
        } finally {
            // CRITICAL: Reset state even if aborted to prevent race condition
            this.currentAbortController = null;
            this.isProcessing = false;
            this.showCancelButton(false);
            this.updateSendButtonState();
        }
    },

    // Cancel ongoing request
    cancelRequest() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            Utils.toast.info("Request cancelled");
        }
    },

    // Toggle between send and cancel buttons
    showCancelButton(show) {
        if (this.cancelButton && this.sendButton) {
            this.cancelButton.style.display = show ? "flex" : "none";
            this.sendButton.style.display = show ? "none" : "flex";
        }
    },

    addMessage(content, type = "assistant", isStreaming = false) {
        const messageEl = document.createElement("div");
        messageEl.className = `message ${type}`;

        const timestamp = Utils.formatDateTime(new Date());
        const author = type === "user" ? "You" : type === "assistant" ? "💎 Elysia" : "System";

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-author">${author}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content"></div>
        `;

        const contentEl = messageEl.querySelector(".message-content");

        if (!isStreaming) {
            // Render markdown
            contentEl.innerHTML = marked.parse(content);

            // Syntax highlighting
            contentEl.querySelectorAll("pre code").forEach(block => {
                if (window.Prism) {
                    Prism.highlightElement(block);
                }
            });

            // Add copy buttons to code blocks
            contentEl.querySelectorAll("pre").forEach(pre => {
                const copyBtn = document.createElement("button");
                copyBtn.className = "code-copy-btn";
                copyBtn.textContent = "📋 Copy";
                copyBtn.style.cssText =
                    "position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.25rem 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 0.8rem;";
                copyBtn.onclick = async () => {
                    const code = pre.querySelector("code");
                    if (code) {
                        await Utils.copyToClipboard(code.textContent);
                        copyBtn.textContent = "✅ Copied!";
                        setTimeout(() => (copyBtn.textContent = "📋 Copy"), 2000);
                    }
                };
                pre.style.position = "relative";
                pre.appendChild(copyBtn);
            });
        }

        this.messageContainer.appendChild(messageEl);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;

        return messageEl;
    }
};

export default Chat;
