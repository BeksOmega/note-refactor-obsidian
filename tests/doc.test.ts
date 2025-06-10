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
        doc = new NRDoc(settings, undefined, undefined);
    });

    it("Basic splitting", () => {
        const inputLines = [
            "- Item 1",
            "- Item 2",
            "- Item 3"
        ];
        const expectedOutput = [['- Item 1'], ['- Item 2'], ['- Item 3']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Splitting with mixed bullet point types", () => {
        const inputLines = [
            "* Item A",
            "+ Item B",
            "- Item C"
        ];
        const expectedOutput = [['* Item A'], ['+ Item B'], ['- Item C']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Splitting with sub-items (indented lines)", () => {
        const inputLines = [
            "- Item 1",
            "  - Sub-item 1.1",
            "  - Sub-item 1.2",
            "- Item 2",
            "  Continuation of item 2"
        ];
        const expectedOutput = [['- Item 1', '  - Sub-item 1.1', '  - Sub-item 1.2'], ['- Item 2', '  Continuation of item 2']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("No bullet points", () => {
        const inputLines = [
            "Line 1",
            "Line 2"
        ];
        const expectedOutput: string[][] = [];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Bullet points with leading/trailing whitespace", () => {
        const inputLines = [
            "  - Item X  ",
            "*   Item Y"
        ];
        // Assuming getIndentation counts spaces for baseIndentation, then regex matches the rest.
        // The original lines are preserved.
        const expectedOutput = [['  - Item X  '], ['*   Item Y']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Empty input", () => {
        const inputLines: string[] = [];
        const expectedOutput: string[][] = [];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Deeper indentation levels", () => {
        const inputLines = [
            "- Parent",
            "  - Child",
            "    - Grandchild",
            "    Continuation of Grandchild",
            "  Continuation of Child",
            "- Next Parent"
        ];
        const expectedOutput = [['- Parent', '  - Child', '    - Grandchild', '    Continuation of Grandchild', '  Continuation of Child'], ['- Next Parent']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Mixed indentation (outdent then indent)", () => {
        const inputLines = [
            "- P1",
            "  - C1",
            "- P2",
            "    - C2.1 (more indented)", // Child of P2
            "  - C2.2 (less indented than C2.1, but still sub of P2)" // Child of P2
        ];
        const expectedOutput = [['- P1', '  - C1'], ['- P2', '    - C2.1 (more indented)', '  - C2.2 (less indented than C2.1, but still sub of P2)']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("List starting with an indented bullet", () => {
        const inputLines = [
            "  - Indented Start 1",
            "    - Sub IS1",
            "  - Indented Start 2"
        ];
        const expectedOutput = [['  - Indented Start 1', '    - Sub IS1'], ['  - Indented Start 2']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Outdented item resets baseIndentation and starts new note", () => {
        const inputLines = [
            "- P1", // baseIndentation = 0
            "  - C1",
            "- P2", // baseIndentation = 0, new note
            "  - P3", // baseIndentation = 2 (relative to P2 if P2 had text, but P2 is a new note here), new note
            "    - C3.1"
        ];
        // Logic: P1 starts note1. P2 starts note2.
        // "  - P3" is a bullet. Its indentation (2) is > P2's (0). So it's part of P2's note.
        const expectedOutput = [
            ['- P1', '  - C1'],
            ['- P2', '  - P3', '    - C3.1']
        ];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    // Corrected version of "Outdented item resets baseIndentation" based on code logic:
    // An outdented item *does* reset baseIndentation and starts a new note.
    it("Outdented item resets baseIndentation (Corrected)", () => {
        const inputLines = [
            "  - P1 (baseIndentation = 2)",
            "    - C1",
            "- P2 (outdented, baseIndentation = 0, new note)",
            "  - C2.1"
        ];
        const expectedOutput = [
            ['  - P1 (baseIndentation = 2)', '    - C1'],
            ['- P2 (outdented, baseIndentation = 0, new note)', '  - C2.1']
        ];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });


    it("Non-bullet text and blank lines between items", () => {
        const inputLines = [
            "- Item A",
            "  Some text for A.",
            "", // Blank line
            "  More text for A.",
            "- Item B"
        ];
        const expectedOutput = [['- Item A', '  Some text for A.', '', '  More text for A.'], ['- Item B']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
        expect(result).toEqual(expectedOutput);
    });

    it("Bullet points with only spaces between marker and text", () => {
        const inputLines = [
            "-   Item With Spaces"
        ];
        const expectedOutput = [['-   Item With Spaces']];
        const result = doc.splitSelectedBulletPoints(inputLines, BULLET_POINT_REGEX);
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
