/*
   ELYSIA CODE COMPANION v1.2.2 - API Layer
   OpenRouter integration for Elysia AI
*/

import Utils from "./utils.js";

const API = {
    baseURL: "https://openrouter.ai/api/v1/chat/completions",

    // Call Elysia via OpenRouter
    async call(messages, options = {}) {
        const apiKey = options.apiKey || Utils.storage.get("apiKey");
        const model = options.model || Utils.storage.get("model", "x-ai/grok-3-fast");

        // Validate API key
        const validation = Utils.validateApiKey(apiKey);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        let timeoutId = null;
        const timeoutMs = options.timeout || 30000; // 30s default

        timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        try {
            const response = await fetch(this.baseURL, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "Elysia Code Companion"
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || Utils.storage.get("maxResponseTokens", 4000),
                    stream: options.stream || false
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            if (options.stream) {
                return response; // Return response for streaming
            }

            const data = await response.json();
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            return {
                content: data.choices[0].message.content,
                model: data.model,
                usage: data.usage
            };
        } catch (err) {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            console.error("API call failed:", err);
            // Provide helpful error messages
            if (err.message.includes("Failed to fetch")) {
                throw new Error("Network error. Check your internet connection.");
            } else if (err.message.includes("401") || err.message.includes("403")) {
                throw new Error("Invalid API key. Please check your settings.");
            } else if (err.message.includes("429")) {
                throw new Error("Rate limit exceeded. Please wait and try again.");
            }
            throw err;
        }
    },

    // Stream Chat (for real-time responses)
    async stream(messages, onChunk, options = {}) {
        const apiKey = options.apiKey || Utils.storage.get("apiKey");
        const model = options.model || Utils.storage.get("model", "x-ai/grok-3-fast");

        const validation = Utils.validateApiKey(apiKey);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Create abort controller for timeout and cancellation
        const controller = options.signal ? null : new AbortController();
        const signal = options.signal || controller?.signal;
        const timeoutMs = options.timeout || 120000; // 2 min default for streaming
        let timeoutId = null;

        if (controller) {
            timeoutId = setTimeout(() => {
                controller.abort();
            }, timeoutMs);
        }

        try {
            const response = await fetch(this.baseURL, {
                method: "POST",
                signal,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "Elysia Code Companion"
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || Utils.storage.get("maxResponseTokens", 4000),
                    stream: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n").filter(line => line.trim() !== "");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || "";
                            if (content) {
                                fullContent += content;
                                onChunk(content, fullContent);
                            }
                        } catch (err) {
                            console.warn("Failed to parse chunk:", err);
                        }
                    }
                }
            }

            if (timeoutId) clearTimeout(timeoutId);
            return fullContent;
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            console.error("Streaming failed:", err);

            // Handle abort/cancellation
            if (err.name === "AbortError") {
                throw new Error("Request cancelled or timed out.");
            }
            // Provide user-friendly error messages
            if (err.message.includes("API key")) {
                throw new Error("Invalid API key. Please check your settings.");
            } else if (err.message.includes("rate limit")) {
                throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            } else if (err.message.includes("network")) {
                throw new Error("Network error. Please check your internet connection.");
            }
            throw new Error(`API Error: ${err.message}`);
        }
    },

    // Build System Prompt for Code Companion
    getSystemPrompt(context = {}) {
        const { folderName, fileCount, files } = context;

        let prompt = `You are Code Companion, an AI assistant specialized in code analysis and development help.

**Your Role:**
- Analyze code structure, find bugs, and suggest improvements
- Explain complex code in simple, clear terms
- Provide actionable insights with examples
- Be concise, helpful, and professional

**Current Context:**`;

        if (folderName) {
            prompt += `\n- Project: ${folderName}`;
            prompt += `\n- Files available: ${fileCount || 0}`;
        } else {
            prompt += `\n- No folder opened yet`;
        }

        if (files && files.length > 0) {
            prompt += `\n\n**Files in context:**\n`;
            files.forEach(file => {
                prompt += `\n### ${file.name}\n\`\`\`${file.language || ""}\n${file.content}\n\`\`\`\n`;
            });
        }

        prompt += `\n\n**Response Guidelines:**
- Be concise and direct
- Use code examples when helpful
- Highlight critical issues with 🚨
- Suggest improvements with 💡
- Mark good practices with ✅
- Focus on practical, actionable advice`;

        return prompt;
    }
};

export default API;
