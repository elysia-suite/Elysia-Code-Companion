/*
   ELYSIA CODE COMPANION v1.2.2 - Code Analyzer
   Static analysis tools for code insights
*/

import FileSystem from "./filesystem.js";
import Utils from "./utils.js";

const Analyzer = {
    // Analyze Entire Project
    analyzeProject() {
        const stats = FileSystem.getStats();
        const tree = FileSystem.buildTree();

        const analysis = {
            summary: {
                name: FileSystem.folderName,
                totalFiles: stats.totalFiles,
                totalSize: Utils.formatFileSize(stats.totalSize),
                languages: stats.languages,
                fileTypes: stats.fileTypes
            },
            structure: tree,
            insights: []
        };

        // Generate insights
        if (stats.totalFiles === 0) {
            analysis.insights.push({
                type: "warning",
                message: "No files found in this folder"
            });
        }

        if (stats.totalFiles > 500) {
            analysis.insights.push({
                type: "info",
                message: `Large project detected (${stats.totalFiles} files). Consider analyzing specific files instead of the whole project.`
            });
        }

        // Check for common patterns
        const hasPackageJson = FileSystem.files.some(f => f.name === "package.json");
        const hasRequirementsTxt = FileSystem.files.some(f => f.name === "requirements.txt");
        const hasCargoToml = FileSystem.files.some(f => f.name === "Cargo.toml");

        if (hasPackageJson) {
            analysis.insights.push({
                type: "success",
                message: "JavaScript/Node.js project detected (package.json found)"
            });
        }

        if (hasRequirementsTxt) {
            analysis.insights.push({
                type: "success",
                message: "Python project detected (requirements.txt found)"
            });
        }

        if (hasCargoToml) {
            analysis.insights.push({
                type: "success",
                message: "Rust project detected (Cargo.toml found)"
            });
        }

        return analysis;
    },

    // Analyze Single File
    async analyzeFile(filePath) {
        const fileEntry = FileSystem.getFileByPath(filePath);
        if (!fileEntry) {
            throw new Error("File not found");
        }

        const content = await FileSystem.readFile(fileEntry);

        const analysis = {
            name: fileEntry.name,
            path: filePath,
            size: Utils.formatFileSize(fileEntry.size),
            extension: fileEntry.extension,
            language: fileEntry.language,
            lines: content.split("\n").length,
            content,
            insights: []
        };

        // Code-specific analysis
        if (Utils.isCodeFile(fileEntry.name)) {
            // Count lines of code (non-empty, non-comment)
            const codeLines = content.split("\n").filter(line => {
                const trimmed = line.trim();
                return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("#");
            });
            analysis.linesOfCode = codeLines.length;

            // Detect TODO/FIXME comments (optimized regex)
            const todoRegex = /(?:TODO|FIXME|HACK|XXX|NOTE):/gi;
            const todos = content.match(todoRegex);
            if (todos && todos.length > 0) {
                analysis.insights.push({
                    type: "info",
                    message: `Found ${todos.length} TODO/FIXME comment(s)`
                });
            }

            // Check file size
            if (fileEntry.size > 1024 * 100) {
                // 100KB
                analysis.insights.push({
                    type: "warning",
                    message: "Large file detected - consider splitting into smaller modules"
                });
            }

            // Check for very long lines
            const longLines = content.split("\n").filter(line => line.length > 120);
            if (longLines.length > 5) {
                analysis.insights.push({
                    type: "info",
                    message: `${longLines.length} lines exceed 120 characters - consider refactoring for readability`
                });
            }
        }

        return analysis;
    },

    // Generate Project Tree (Text Format)
    generateTreeText(tree, indent = "", isRoot = true) {
        let text = "";

        // Only show root node name
        if (isRoot && tree.name) {
            const icon = tree.type === "directory" ? "📁" : "📄";
            text += `${icon} ${tree.name}\n`;
        }

        if (tree.children) {
            tree.children.forEach((child, index) => {
                const isLast = index === tree.children.length - 1;
                const prefix = indent + (isLast ? "└─ " : "├─ ");
                const childIndent = indent + (isLast ? "   " : "│  ");

                const icon = child.type === "directory" ? "📁" : "📄";
                text += `${prefix}${icon} ${child.name}\n`;

                // Recursively process children
                if (child.children && child.children.length > 0) {
                    text += this.generateTreeText(child, childIndent, false);
                }
            });
        }

        return text;
    },

    // Get Files for AI Context (smart selection)
    async getContextFiles(query = "", maxFiles = 5) {
        const mentionedFiles = [];
        const configFiles = [];

        // PRIORITY 1: Files explicitly mentioned in query (highest relevance)
        if (query) {
            const mentioned = FileSystem.files.filter(
                f =>
                    query.toLowerCase().includes(f.name.toLowerCase()) ||
                    query.toLowerCase().includes(f.path.toLowerCase())
            );
            mentionedFiles.push(...mentioned);
        }

        // PRIORITY 2: Important config files (context)
        const configs = FileSystem.files.filter(f =>
            [
                "package.json",
                "tsconfig.json",
                "requirements.txt",
                "Cargo.toml",
                "README.md",
                ".env.example",
                "docker-compose.yml"
            ].includes(f.name)
        );
        configFiles.push(...configs);

        // Merge with priority: mentioned files FIRST, then config files
        const relevantFilesMap = new Map();
        mentionedFiles.forEach(f => relevantFilesMap.set(f.path, f)); // Priority 1
        configFiles.forEach(f => {
            if (!relevantFilesMap.has(f.path)) {
                // Don't add duplicates
                relevantFilesMap.set(f.path, f); // Priority 2
            }
        });

        // Convert Map to array and limit
        const relevantFiles = Array.from(relevantFilesMap.values());
        const selectedFiles = relevantFiles.slice(0, maxFiles);
        const filesWithContent = await Promise.all(
            selectedFiles.map(async file => {
                try {
                    const content = await FileSystem.readFile(file);
                    return {
                        name: file.name,
                        path: file.path,
                        language: file.language,
                        content: content.substring(0, 5000) // Limit to 5000 chars per file
                    };
                } catch (err) {
                    console.error(`Failed to read ${file.path}:`, err);
                    return null;
                }
            })
        );

        return filesWithContent.filter(f => f !== null);
    },

    // Parse Command from User Input
    parseCommand(input) {
        const trimmed = input.trim();

        if (!trimmed.startsWith("/")) {
            return { type: "message", content: trimmed };
        }

        const parts = trimmed.substring(1).split(" ");
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(" ");

        return { type: "command", command, args };
    }
};

export default Analyzer;
