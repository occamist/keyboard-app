import { defaultWindowIcon } from "@tauri-apps/api/app";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { exit } from "@tauri-apps/plugin-process";
import {
    BACKSPACE,
    ENTER,
    KEYBOARD_LAYOUTS,
    type LanguageCode,
    type LayoutKey,
    NOOP,
    ORIGINAL_LAYOUT,
    SHIFT,
    SPACE,
} from "./keyboard.ts";
import { composeKorean } from "./korean-composer.ts";

type KeyData = {
    key: string; // Store button's data-key
    element: HTMLButtonElement; // Store button
    originalText: string; // Store button's original text
};

class KeyboardApp {
    private textInput: HTMLTextAreaElement;
    private keyButtons: KeyData[];
    private currentLanguage: LanguageCode;
    private isShifted: boolean;

    private undoHistory: string[] = [];
    private undoIndex: number = -1;
    private maxUndoSteps: number = 50;

    constructor() {
        this.textInput = document.getElementById("textInput") as HTMLTextAreaElement;
        this.currentLanguage = "TH";
        this.isShifted = false;

        this.undoHistory = [this.textInput.value];
        this.undoIndex = 0;

        this.keyButtons = Array.from(document.querySelectorAll(".key-button[data-key]")).map((button) => {
            const element = button as HTMLButtonElement;
            const key = element.dataset.key;
            if (!key) throw new Error("data-key attribute missing despite selector");

            const originalText = element.textContent;
            if (!originalText) throw new Error("button is missing text content");

            return { key, element, originalText };
        });

        this.initializeSpans();
        this.initializeEventListeners();
        this.updateKeyboardDisplay();
        this.updateFonts(this.currentLanguage);
    }

    private saveState(): void {
        const currentValue = this.textInput.value;

        // Don't save if it's the same as the last state
        if (this.undoHistory[this.undoIndex] === currentValue) {
            return;
        }

        // Remove any redo history when making a new change
        this.undoHistory = this.undoHistory.slice(0, this.undoIndex + 1);

        // Add current state
        this.undoHistory.push(currentValue);

        // Limit history size
        if (this.undoHistory.length > this.maxUndoSteps) {
            this.undoHistory.shift();
        }

        this.undoIndex = this.undoHistory.length - 1;
    }

    private undo(): void {
        // Save current state if it's not already saved
        const currentValue = this.textInput.value;
        if (this.undoHistory[this.undoIndex] !== currentValue) {
            this.saveState();
        }

        if (this.undoIndex > 0) {
            this.undoIndex--;
            const previousValue = this.undoHistory[this.undoIndex];
            this.textInput.value = previousValue;
            this.textInput.focus();
            this.textInput.setSelectionRange(previousValue.length, previousValue.length);
        }
    }

    private redo(): void {
        if (this.undoIndex < this.undoHistory.length - 1) {
            this.undoIndex++;
            const nextValue = this.undoHistory[this.undoIndex];
            this.textInput.value = nextValue;
            this.textInput.focus();
            this.textInput.setSelectionRange(nextValue.length, nextValue.length);
        }
    }

    private initializeSpans(): void {
        this.keyButtons.forEach(({ element, originalText, key }) => {
            // Skip special keys that shouldn't show dual characters
            if ([SHIFT, ENTER, BACKSPACE, SPACE].includes(key)) {
                return;
            }

            // Inject dual characters display
            element.innerHTML = `
				<span class="key-original">${originalText}</span>
				<span class="key-mapped"></span>
			`;
            element.style.position = "relative";
            element.style.display = "flex";
            element.style.justifyContent = "space-between";
            element.style.alignItems = "center";
        });
    }

    private initializeEventListeners(): void {
        // Mouse listener
        this.keyButtons.forEach(({ key, element }) => {
            element.addEventListener("click", (e: MouseEvent) => {
                e.preventDefault();

                if (key === BACKSPACE) {
                    this.handleBackspace();
                } else if (key === SHIFT) {
                    this.handleShift();
                } else if (key === ENTER) {
                    this.handleEnter();
                } else if (key === SPACE) {
                    this.handleSpace();
                } else {
                    const character = this.getMappedChar(key);
                    if (character) {
                        this.appendToInput(character);
                    }
                }

                this.animateButton(element);
                element.blur();
            });
        });

        // Keyboard listener
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            const allowedKeys = [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
                "PageUp",
                "PageDown",
                "Escape",
                "Tab",
            ];

            // Allow Ctrl/Cmd combinations (like Ctrl+C, Ctrl+V)
            if (e.ctrlKey || e.metaKey) {
                if (e.key === "z" && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                    return;
                }
                if (e.key === "y" && !e.shiftKey) {
                    e.preventDefault();
                    this.redo();
                    return;
                }

                return;
            }

            if (!allowedKeys.includes(e.key)) {
                e.preventDefault();
            }

            this.handleKeyPress(e.key);
        });

        // Text area Listener
        this.textInput.addEventListener("paste", () => {
            this.saveState();
        });
    }

    private handleKeyPress(pressed_key: string): void {
        pressed_key = pressed_key.toLowerCase();
        if (pressed_key === "shift") {
            this.handleShift();
            const btn = this.keyButtons.find((btn) => btn.key === SHIFT);
            if (btn) this.animateButton(btn.element);
            return;
        }

        if (pressed_key === "backspace") {
            this.handleBackspace();
            const btn = this.keyButtons.find((btn) => btn.key === BACKSPACE);
            if (btn) this.animateButton(btn.element);
            return;
        }

        if (pressed_key === "enter") {
            this.handleEnter();
            const btn = this.keyButtons.find((btn) => btn.key === ENTER);
            if (btn) this.animateButton(btn.element);
            return;
        }

        if (pressed_key === " ") {
            this.handleSpace();
            const btn = this.keyButtons.find((btn) => btn.key === SPACE);
            if (btn) this.animateButton(btn.element);
            return;
        }

        const btn = this.keyButtons.find((btn) => btn.key === pressed_key);
        if (btn) {
            this.animateButton(btn.element);
            const char = this.getMappedChar(pressed_key);
            if (char) {
                this.appendToInput(char);
            }
        }
    }

    private getMappedChar(originalKey: string): string {
        const currentLayout = this.currentLayout();

        for (let i = 0; i < ORIGINAL_LAYOUT.length; i++) {
            const j = ORIGINAL_LAYOUT[i].indexOf(originalKey);
            if (j !== -1) {
                if (currentLayout[i]?.[j]) {
                    return currentLayout[i][j];
                }
            }
        }
        return "";
    }

    private currentLayout(): string[][] {
        const key: LayoutKey = this.isShifted ? (`${this.currentLanguage}_` as LayoutKey) : this.currentLanguage;
        return KEYBOARD_LAYOUTS[key];
    }

    private updateFonts(lang: string): void {
        const fontClasses: string[] = Object.keys(KEYBOARD_LAYOUTS)
            .filter((code) => !code.includes("_"))
            .map((code) => `font-${code}`);

        const elems = document.querySelectorAll(".key-mapped");
        elems.forEach((e) => {
            e.classList.remove(...fontClasses);
            e.classList.add(`font-${lang}`);
        });

        const elem = document.querySelector("#textInput");
        if (elem) {
            elem.classList.remove(...fontClasses);
            elem.classList.add(`font-${lang}`);
        }
    }

    private updateKeyboardDisplay(): void {
        const currentLayout: string[][] = this.currentLayout();

        for (let i = 0; i < ORIGINAL_LAYOUT.length; i++) {
            for (let j = 0; j < ORIGINAL_LAYOUT[i].length; j++) {
                const originalKey = ORIGINAL_LAYOUT[i][j];
                const buttons = this.keyButtons.filter((btn) => btn.key === originalKey);
                buttons.forEach((b) => {
                    const mappedChar: string = currentLayout[i]?.[j];
                    const mappedSpan: HTMLSpanElement = b.element.querySelector(".key-mapped") as HTMLSpanElement;
                    if (mappedChar && mappedSpan) {
                        if (mappedChar !== NOOP) {
                            mappedSpan.textContent = mappedChar;
                        } else {
                            mappedSpan.textContent = "";
                        }
                    }
                });
            }
        }
    }

    private handleShift(): void {
        this.isShifted = !this.isShifted;
        this.updateKeyboardDisplay();
    }

    private handleEnter(): void {
        this.appendToInput("\n");
    }

    private handleSpace(): void {
        this.appendToInput(" ");
    }

    private appendToInput(character: string): void {
        if (character === NOOP) {
            return;
        }

        this.saveState();

        const start = this.textInput.selectionStart || 0;
        const end = this.textInput.selectionEnd || 0;
        const textBefore = this.textInput.value.substring(0, start);
        const textAfter = this.textInput.value.substring(end);

        if (this.currentLanguage === "KR") {
            const { text, cursorPos } = composeKorean(textBefore, character);
            this.textInput.value = text + textAfter;
            this.textInput.setSelectionRange(cursorPos, cursorPos);
        } else {
            this.textInput.value = textBefore + character + textAfter;
            const cursorPos = start + character.length;
            this.textInput.setSelectionRange(cursorPos, cursorPos);
        }

        this.textInput.focus();
    }

    private handleBackspace(): void {
        const start = this.textInput.selectionStart || 0;
        const end = this.textInput.selectionEnd || 0;

        // Only save state if we're actually going to make a change
        if (start !== end || start > 0) {
            this.saveState();
        }

        if (start !== end) {
            // multiple selection
            const textBefore = this.textInput.value.substring(0, start);
            const textAfter = this.textInput.value.substring(end);

            this.textInput.value = textBefore + textAfter;
            this.textInput.setSelectionRange(start, start);
        } else if (start > 0) {
            // no selection
            const textBefore = this.textInput.value.substring(0, start - 1);
            const textAfter = this.textInput.value.substring(start);

            this.textInput.value = textBefore + textAfter;
            this.textInput.setSelectionRange(start - 1, start - 1); // Move cursor back one position
        }

        this.textInput.focus();
    }

    private animateButton(btn: HTMLButtonElement): void {
        btn.classList.add("active");

        setTimeout(() => {
            btn.classList.remove("active");
        }, 150);
    }

    resetText() {
        this.textInput.value = "";
    }

    async copyText(): Promise<void> {
        if (this.textInput.value) {
            await writeText(this.textInput.value);
        }
    }

    async pasteText(): Promise<void> {
        const text = await readText();
        if (text) {
            this.appendToInput(text);
        }
    }

    setLanguage(lc: LanguageCode): void {
        this.currentLanguage = lc;
        this.isShifted = false; // Reset shift when changing language
        this.updateKeyboardDisplay();
        this.updateFonts(this.currentLanguage);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const app = new KeyboardApp();

    const languagesSubmenu = await Submenu.new({
        text: "Languages",
        items: [
            await MenuItem.new({
                id: "german",
                text: "Select German",
                action: () => {
                    app.setLanguage("DE");
                },
            }),
            await MenuItem.new({
                id: "italian",
                text: "Select Italian",
                action: () => {
                    app.setLanguage("IT");
                },
            }),
            await MenuItem.new({
                id: "korean",
                text: "Select Korean",
                action: () => {
                    app.setLanguage("KR");
                },
            }),
            await MenuItem.new({
                id: "lao",
                text: "Select Lao",
                action: () => {
                    app.setLanguage("LO");
                },
            }),
            await MenuItem.new({
                id: "thai",
                text: "Select Thai",
                action: () => {
                    app.setLanguage("TH");
                },
            }),
            await MenuItem.new({
                id: "turkish",
                text: "Select Turkish",
                action: () => {
                    app.setLanguage("TR");
                },
            }),
            await MenuItem.new({
                id: "vietnamese",
                text: "Select Vietnamese",
                action: () => {
                    app.setLanguage("VI");
                },
            }),
        ],
    });

    const actionsSubmenu = await Submenu.new({
        text: "Actions",
        items: [
            await MenuItem.new({
                id: "copy",
                text: "Copy",
                action: () => {
                    app.copyText();
                },
            }),
            await MenuItem.new({
                id: "paste",
                text: "Paste",
                action: () => {
                    app.pasteText();
                },
            }),
            await MenuItem.new({
                id: "clear",
                text: "Clear",
                action: () => {
                    app.resetText();
                },
            }),
        ],
    });

    const menu = await Menu.new({
        items: [languagesSubmenu, actionsSubmenu],
    });
    menu.setAsAppMenu();

    const separator = await PredefinedMenuItem.new({
        text: "separator-text",
        item: "Separator",
    });
    const quitItem = await MenuItem.new({
        id: "quit",
        text: "Quit",
        action: async () => await exit(0),
    });

    const trayMenu = await Menu.new({
        items: [languagesSubmenu, actionsSubmenu, separator, quitItem],
    });
    const icon = await defaultWindowIcon();
    if (!icon) {
        throw new Error("Failed to load default window icon");
    }
    await TrayIcon.new({ icon: icon, tooltip: "Keyboard App", menu: trayMenu });

    requestAnimationFrame(() => {
        const height = document.documentElement.scrollHeight;
        getCurrentWindow().setSize(new LogicalSize(1200, height));
    });
});
