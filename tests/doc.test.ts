import {describe, expect, beforeAll} from '@jest/globals';
import NRDoc from '../src/doc';
import { NoteRefactorSettings } from '../src/settings';
import { promises as fs } from 'fs';
import { BULLET_POINT_REGEX } from '../src/constants'; // Added import

const newLocal = './tests/files/test-note.md';
let doc: NRDoc = null;
let fileContents:string = '';
let content: string[] = [];

describe("Note content - Content Only", () => {

    beforeAll(async () => {
        fileContents = await loadTestFile();
        content = toArray(fileContents, 0, 15);
        doc = new NRDoc(new NoteRefactorSettings(), undefined, undefined);
    });

    it("First line content", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(firstLine(noteContent)).toBe("Hi there! I'm a note in your vault.");
    });

    it("Last line content", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(lastLine(noteContent)).toBe("- How to [[Working with multiple notes|open multiple files side by side]]");
    });

    it("Character count", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(noteContent.length).toBe(746);
    });

});

describe("Note content - Content Only - Normalize header levels", () => {

    beforeAll(async () => {
        fileContents = await loadTestFile();
        content = toArray(fileContents, 42, 51);
        const settings = new NoteRefactorSettings();
        settings.normalizeHeaderLevels = true;
        doc = new NRDoc(settings, undefined, undefined);
    });

    it("First line content", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(firstLine(noteContent)).toBe("# I have questions.");
    });

    it("Header 3 content", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(toArray(noteContent)[4]).toBe("## Header 3");
    });

    it("Last line content", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(lastLine(noteContent)).toBe("This is for testing normalizing header levels.");
    });

    it("Character count", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1), true);
        expect(noteContent.length).toBe(232);
    });

});

describe("Note content - First Line as File Name, exclude first line", () => {

    beforeAll(async () => {
        fileContents = await loadTestFile();
        const settings = new NoteRefactorSettings();
        settings.excludeFirstLineInNote = true;
        doc = new NRDoc(settings, undefined, undefined);
        content = toArray(fileContents, 0, 15);
    });
    
    it("First Line text", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(firstLine(noteContent)).toBe("At the same time, I'm also just a Markdown file sitting on your hard disk. It's all in plain text, so you don't need to worry about losing me in case [[Obsidian]] disappears one day.");
    });

    it("Last line text", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(lastLine(noteContent)).toBe("- How to [[Working with multiple notes|open multiple files side by side]]");
    });

    it("External links preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[9]).toBe('- How to use [Markdown](https://www.markdownguide.org) to [[Format your notes]]');
    });
    
    it("Embeds preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[7]).toBe('- How to ![[Create notes|create new notes]].');
    });

    it("Character count", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(noteContent.length).toBe(709);
    });

});

describe("Note content - First Line as File Name, first line as heading", () => {
    let fileContents:string = '';
    let content: string[] = [];

    beforeAll(async () => {
        fileContents = await loadTestFile();
        const settings = new NoteRefactorSettings();
        settings.includeFirstLineAsNoteHeading = true;
        settings.headingFormat = '#';
        doc = new NRDoc(settings, undefined, undefined);
        content = toArray(fileContents, 0, 15);
    });
    
    it("First Line text", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(firstLine(noteContent)).toBe("# Hi there! I'm a note in your vault.");
    });

    it("Last line text", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(lastLine(noteContent)).toBe("- How to [[Working with multiple notes|open multiple files side by side]]");
    });

    it("External links preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[11]).toBe('- How to use [Markdown](https://www.markdownguide.org) to [[Format your notes]]');
    });
    
    it("Embeds preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[9]).toBe('- How to ![[Create notes|create new notes]].');
    });

    it("Character count", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(noteContent.length).toBe(748);
    });

});

describe("Note content - First Line as File Name, first line as heading (modified heading)", () => {

    beforeAll(async () => {
        fileContents = await loadTestFile();
        const settings = new NoteRefactorSettings();
        settings.includeFirstLineAsNoteHeading = true;
        settings.headingFormat = '#';
        doc = new NRDoc(settings, undefined, undefined);
        content = toArray(fileContents, 4, 28);
    });
    
    it("First Line text", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(firstLine(noteContent)).toBe("# Quick Start");
    });

    it("Last line text", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(lastLine(noteContent)).toBe("## Workflows");
    });
    
    it("Internal links preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[9]).toBe('- [[Keyboard shortcuts]]');
    });
    
    it("External links preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[18]).toBe('If you are a [Catalyst supporter](https://obsidian.md/pricing), and want to turn on Insider Builds, see [[Insider builds]].');
    });
    
    it("Embeds preserved", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(toArray(noteContent)[20]).toBe('![Obsidian.md](https://obsidian.md/images/screenshot.png)');
    });

    it("Character count", () => {
        const noteContent = doc.noteContent(content[0], content.slice(1));
        expect(noteContent.length).toBe(1105);
    });

});

describe("splitSelectedBulletPoints", () => {
    let doc: NRDoc;
    const settings = new NoteRefactorSettings(); // Use default settings

    beforeAll(() => {
        // doc needs to be initialized here, or in each test if settings change
        // For these tests, default settings are fine.
        doc = new NRDoc(settings, undefined, undefined);
    });

    // Removed original tests for brevity in this prompt, will be replaced by new ones below

    it("User Case 1: Select range of nested and same-level bullets", () => {
        const inputLines = [
            "* Test a", // Not selected
            "  * Test b", // Selected, minIndent for selection = 2
            "    * Test c", // Selected, child of b
            "    * Test d", // Selected, child of b
            "  * Test e", // Selected, minIndent for selection = 2
            "* Test f" // Not selected
        ];
        // Only lines 1-4 (0-indexed) are "selected" for the purpose of the test input
        const selectedLines = inputLines.slice(1, 5);
        const expectedOutput = [
            ["  * Test b", "    * Test c", "    * Test d"],
            ["  * Test e"]
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("User Case 2: Select only deeply nested bullets", () => {
        const inputLines = [
            "* Test a",
            "  * Test b",
            "    * Test c", // Selected, minIndent for selection = 4
            "    * Test d", // Selected, minIndent for selection = 4
            "  * Test e",
            "* Test f"
        ];
        // Only lines 2-3 are "selected"
        const selectedLines = inputLines.slice(2, 4);
        const expectedOutput = [
            ["    * Test c"],
            ["    * Test d"]
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Selection includes non-bullet lines and varying indentations", () => {
        const selectedLines = [
            "Some introductory text (not a bullet)",
            "  * Bullet 1 (minIndent for selection = 2)",
            "    Continuation for Bullet 1",
            "    * Sub-bullet 1.1",
            "  * Bullet 2 (minIndent for selection = 2)",
            "Another line (not a bullet, but part of Bullet 2's note)",
            "      * Deep Bullet (child of Bullet 2)"
        ];
        const expectedOutput = [
            ["  * Bullet 1 (minIndent for selection = 2)", "    Continuation for Bullet 1", "    * Sub-bullet 1.1"],
            ["  * Bullet 2 (minIndent for selection = 2)", "Another line (not a bullet, but part of Bullet 2's note)", "      * Deep Bullet (child of Bullet 2)"]
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Selection is a single deeply nested bullet", () => {
        const selectedLines = [
            "    * Deeply Nested Single Bullet"
        ];
        const expectedOutput = [
            ["    * Deeply Nested Single Bullet"]
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Selection starts with non-bullet, then bullets", () => {
        const selectedLines = [
            "Not a bullet",
            "  * Bullet A", // minIndent = 2
            "    * Bullet A.1",
            "  * Bullet B"  // minIndent = 2
        ];
        const expectedOutput = [
            ["  * Bullet A", "    * Bullet A.1"],
            ["  * Bullet B"]
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Selection includes parent and some, but not all, of its children", () => {
        const selectedLines = [
            "  * Parent", // minIndent = 2
            "    * Child 1 (selected)",
            // Child 2 would be here, but not selected
            "    * Child 3 (selected)"
        ];
        // Child 2 is not in selectedLines, so it won't be in the output.
        const expectedOutput = [
            ["  * Parent", "    * Child 1 (selected)", "    * Child 3 (selected)"]
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Selection with only non-bullet lines", () => {
        const selectedLines = [
            "This is line 1",
            "This is line 2",
            "  And line 3"
        ];
        const expectedOutput: string[][] = [];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Selection is empty", () => {
        const selectedLines: string[] = [];
        const expectedOutput: string[][] = [];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Basic splitting (original test, adapted)", () => {
        const selectedLines = [
            "- Item 1",
            "- Item 2",
            "- Item 3"
        ];
        const expectedOutput = [['- Item 1'], ['- Item 2'], ['- Item 3']];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Splitting with mixed bullet point types (original test, adapted)", () => {
        const selectedLines = [
            "* Item A",
            "+ Item B",
            "- Item C"
        ];
        const expectedOutput = [['* Item A'], ['+ Item B'], ['- Item C']];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    // This test needs to be re-evaluated against the new logic.
    // The new logic bases minIndentation on the selection.
    // If "- Item 1" is indent 0, and "  - Sub-item 1.1" is indent 2,
    // and both are selected, minIndentation becomes 0.
    // "  - Sub-item 1.1" becomes a child of "- Item 1".
    it("Splitting with sub-items (original test, re-evaluated)", () => {
        const selectedLines = [
            "- Item 1", // Indent 0
            "  - Sub-item 1.1", // Indent 2
            "  - Sub-item 1.2", // Indent 2
            "- Item 2", // Indent 0
            "  Continuation of item 2" // Indent 2 (non-bullet)
        ];
        // Min Indentation within selection is 0
        const expectedOutput = [
            ['- Item 1', '  - Sub-item 1.1', '  - Sub-item 1.2'],
            ['- Item 2', '  Continuation of item 2']
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });


    it("List starting with an indented bullet (original test, re-evaluated)", () => {
        const selectedLines = [
            "  - Indented Start 1", // Indent 2
            "    - Sub IS1", // Indent 4
            "  - Indented Start 2"  // Indent 2
        ];
        // Min Indentation within selection is 2
        const expectedOutput = [
            ['  - Indented Start 1', '    - Sub IS1'],
            ['  - Indented Start 2']
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });


    it("Non-bullet text and blank lines between items (original test, adapted)", () => {
        const selectedLines = [
            "- Item A", // Indent 0
            "  Some text for A.", // Indent 2 (non-bullet)
            "", // Blank line (non-bullet)
            "  More text for A.", // Indent 2 (non-bullet)
            "- Item B" // Indent 0
        ];
        // Min Indentation is 0
        const expectedOutput = [
            ['- Item A', '  Some text for A.', '', '  More text for A.'],
            ['- Item B']
        ];
        const result = doc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

});

async function loadTestFile(): Promise<string> {
    return await fs.readFile(newLocal, 'utf8');
}

function toArray(input:string, start?:number, end?:number): string[] {
    const output = input.split('\n');
    return output.slice(start, end);
}

function firstLine(input:string): string {
    const items = input.split('\n');
    return items[0];
}

function lastLine(input:string): string {
    const items = input.split('\n');
    return items[items.length - 1];
}
