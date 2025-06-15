import { Editor, FileManager, TFile, Vault } from "obsidian";
import { HEADING_REGEX } from "./constants";
import MomentDateRegex from "./moment-date-regex";
import { NotePlaceholders } from "./placeholder";
import { NoteRefactorSettings } from "./settings";
export type ReplaceMode = "split" | "replace-selection" | "replace-headings";

export default class NRDoc {
  private settings: NoteRefactorSettings;
  private templatePlaceholders: NotePlaceholders;
  private momentRegex: MomentDateRegex;
  private vault: Vault;
  private fileManager: FileManager;

  constructor(
    settings: NoteRefactorSettings,
    vault: Vault,
    fileManager: FileManager
  ) {
    this.settings = settings;
    this.vault = vault;
    this.fileManager = fileManager;
    this.templatePlaceholders = new NotePlaceholders();
    this.momentRegex = new MomentDateRegex();
  }

  removeNoteRemainder(doc: Editor, text: string): void {
    const currentLine = doc.getCursor();
    const endPosition = doc.offsetToPos(doc.getValue().length);
    doc.replaceRange(text, currentLine, endPosition);
  }

  async replaceContent(
    fileName: string,
    filePath: string,
    doc: Editor,
    currentNote: TFile,
    content: string,
    originalContent: string,
    mode: ReplaceMode
  ): Promise<void> {
    const transclude = this.settings.transcludeByDefault ? "!" : "";
    const link = await this.markdownLink(filePath);
    const currentNoteLink = await this.markdownLink(currentNote.path);
    let contentToInsert = transclude + link;

    contentToInsert = this.templatedContent(
      contentToInsert,
      this.settings.noteLinkTemplate,
      currentNote.basename,
      currentNoteLink,
      fileName,
      link,
      "",
      content
    );

    if (mode === "split") {
      this.removeNoteRemainder(doc, contentToInsert);
    } else if (mode === "replace-selection") {
      doc.replaceSelection(contentToInsert);
    } else if (mode === "replace-headings") {
      doc.setValue(doc.getValue().replace(originalContent, contentToInsert));
    }
  }

  async markdownLink(filePath: string) {
    const file = await this.vault
      .getMarkdownFiles()
      .filter((f) => f.path === filePath)[0];
    const link = await this.fileManager.generateMarkdownLink(file, "", "", "");
    return link;
  }

  templatedContent(
    input: string,
    template: string,
    currentNoteTitle: string,
    currentNoteLink: string,
    newNoteTitle: string,
    newNoteLink: string,
    newNotePath: string,
    newNoteContent: string
  ): string {
    if (template === undefined || template === "") {
      return input;
    }
    //test
    let output = template;
    output = this.momentRegex.replace(output);
    output = this.templatePlaceholders.title.replace(output, currentNoteTitle);
    output = this.templatePlaceholders.link.replace(output, currentNoteLink);
    output = this.templatePlaceholders.newNoteTitle.replace(
      output,
      newNoteTitle
    );
    output = this.templatePlaceholders.newNoteLink.replace(output, newNoteLink);
    output = this.templatePlaceholders.newNoteContent.replace(
      output,
      newNoteContent
    );
    output = this.templatePlaceholders.newNotePath.replace(output, newNotePath);
    return output;
  }

  selectedContent(doc: Editor): string[] {
    const selectedText = doc.getSelection();
    // Splitting by newline from the start to preserve original indentation.
    // trim() might remove intentional leading/trailing empty lines if not careful,
    // but for selectedContent, usually we want the lines that have actual content.
    // If selection is empty, selectedText is '', selectedText.split('\n') is [''].
    // If selection has content, .trim() is good to remove accidental whitespace around the block.
    if (selectedText === "") return [];
    return selectedText.split("\n");
  }

  noteRemainder(doc: Editor): string[] {
    doc.setCursor(doc.getCursor().line, 0);
    const currentLine = doc.getCursor();
    const endPosition = doc.offsetToPos(doc.getValue().length);
    const content = doc.getRange(currentLine, endPosition);
    const trimmedContent = content.trim();
    if (trimmedContent === "") return [];
    return trimmedContent.split("\n");
  }

  contentSplitByHeading(doc: Editor, headingLevel: number): string[][] {
    const content = doc.getValue().split("\n");
    const parentHeading = new Array(headingLevel).join("#") + " ";
    const heading = new Array(headingLevel + 1).join("#") + " ";
    const matches: string[][] = [];
    let headingMatch: string[] = [];
    content.forEach((line, i) => {
      if (line.startsWith(heading)) {
        if (headingMatch.length > 0) {
          matches.push(headingMatch);
        }
        headingMatch = [line]; // Start new match
      } else if (headingMatch.length > 0 && !line.startsWith(parentHeading)) {
        headingMatch.push(line);
      } else if (headingMatch.length > 0) {
        // Line is a parent heading or unrelated, and we have a match
        matches.push(headingMatch);
        headingMatch = []; // Reset
      }
      //Making sure the last headingMatch array is added to the matches
      if (i === content.length - 1 && headingMatch.length > 0) {
        matches.push(headingMatch);
      }
    });
    return matches;
  }

  private getIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    // If match is null (shouldn't happen with this regex unless line is null/undefined, which TS should prevent)
    // or if match[1] is undefined, return 0. Otherwise, return the length of the captured spaces.
    return match && match[1] ? match[1].length : 0;
  }

  splitSelectedBulletPoints(
    selectedLines: string[],
    bulletPointRegex: RegExp
  ): string[][] {
    console.log("selectedLines", selectedLines);
    const notes: string[][] = [];
    if (selectedLines.length === 0) {
      return notes;
    }

    // Map selected lines to objects containing line, index, indentation, and whether it's a bullet
    // Filter out lines that are not bullet points for determining minIndentation
    const selectedBulletPointsInfo = selectedLines
      .map((line, index) => ({
        // Keep original index for potential later use if needed
        line,
        originalIndex: index, // Keep original index from selectedLines
        indentation: this.getIndentation(line),
        isBullet: bulletPointRegex.test(line),
      }))
      .filter((item) => item.isBullet);

    // If no bullet points are selected, return empty notes
    if (selectedBulletPointsInfo.length === 0) {
      return notes;
    }

    // Determine the minimum indentation among selected bullet points
    const minIndentation = Math.min(
      ...selectedBulletPointsInfo.map((item) => item.indentation)
    );

    let currentNote: string[] = [];
    for (let i = 0; i < selectedLines.length; i++) {
      const line = selectedLines[i];
      const isBullet = bulletPointRegex.test(line);
      const currentIndentation = this.getIndentation(line);

      if (isBullet && currentIndentation === minIndentation) {
        // This is a highest-level selected bullet, start of a new note
        if (currentNote.length > 0) {
          notes.push([...currentNote]); // Save the previous note
        }
        currentNote = [line]; // Start a new note
      } else if (currentNote.length > 0) {
        // This line is either a sub-bullet or a continuation line.
        // It should only be added if currentNote has been initialized by a minIndentation bullet.
        // We also need to ensure this line was actually part of the user's *selection*.
        // The loop is already iterating through `selectedLines`, so all lines considered are selected.
        currentNote.push(line);
      }
      // Lines before the first minIndentation bullet that are not bullets themselves,
      // or bullets that are more indented than any minIndentation bullet (not possible due to minIndentation logic),
      // will be correctly ignored as currentNote would be empty.
    }

    // Add the last accumulated note if it exists
    if (currentNote.length > 0) {
      notes.push([...currentNote]);
    }
    return notes.map((note) => note.map((line) => line.slice(2)));
  }

  noteContent(
    firstLine: string,
    contentArr: string[],
    contentOnly?: boolean
  ): string {
    if (this.settings.includeFirstLineAsNoteHeading) {
      const headingBaseline = firstLine.replace(HEADING_REGEX, "");
      contentArr.unshift(
        `${this.settings.headingFormat} ${headingBaseline}`.trim()
      );
    } else if (!this.settings.excludeFirstLineInNote || contentOnly) {
      contentArr.unshift(firstLine);
    }
    if (this.settings.normalizeHeaderLevels) {
      contentArr = this.normalizeHeadingLevels(contentArr);
    }
    return contentArr.join("\n").trim();
  }

  normalizeHeadingLevels(contentArr: string[]): string[] {
    const minHeadingLevel = Math.min(
      ...contentArr
        .map((line) => this.headingLevel(line))
        .filter((level) => level > 0)
    );
    if (minHeadingLevel > 1) {
      contentArr.forEach((line, i) => {
        const level = this.headingLevel(line);
        if (level > 0) {
          contentArr[i] = line.substr(minHeadingLevel - 1);
        }
      });
    }
    return contentArr;
  }

  headingLevel(line: string): number {
    let headingLevel = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "#") {
        headingLevel++;
      } else if (line[i] === " ") {
        break;
      } else {
        headingLevel = 0;
        break;
      }
    }
    return headingLevel;
  }
}
