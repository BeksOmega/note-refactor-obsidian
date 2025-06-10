import { Editor, FileManager, TFile, Vault } from 'obsidian';
import { HEADING_REGEX } from './constants';
import MomentDateRegex from './moment-date-regex';
import { NotePlaceholders } from './placeholder';
import { NoteRefactorSettings } from './settings';
export type ReplaceMode = 'split' | 'replace-selection' | 'replace-headings';

export default class NRDoc {
    private settings: NoteRefactorSettings;
    private templatePlaceholders: NotePlaceholders;
    private momentRegex: MomentDateRegex;
    private vault: Vault;
    private fileManager: FileManager;
    
    constructor(settings: NoteRefactorSettings, vault: Vault, fileManager: FileManager){
        this.settings = settings;
        this.vault = vault;
        this.fileManager = fileManager;
        this.templatePlaceholders = new NotePlaceholders();
        this.momentRegex = new MomentDateRegex();
    }

    removeNoteRemainder(doc:Editor, text:string): void {
        const currentLine = doc.getCursor();
        const endPosition = doc.offsetToPos(doc.getValue().length);
        doc.replaceRange(text, currentLine, endPosition);
    }

    async replaceContent(fileName: string, filePath: string, doc:Editor, currentNote: TFile, content: string, originalContent: string, mode: ReplaceMode): Promise<void> {
        const transclude = this.settings.transcludeByDefault ? '!' : '';
        const link = await this.markdownLink(filePath);
        const currentNoteLink = await this.markdownLink(currentNote.path);
        let contentToInsert = transclude + link;
        
        contentToInsert = this.templatedContent(contentToInsert, this.settings.noteLinkTemplate, currentNote.basename, currentNoteLink, fileName, link, '', content);

        if(mode === 'split'){ 
            this.removeNoteRemainder(doc, contentToInsert);
        } else if(mode === 'replace-selection') {
            doc.replaceSelection(contentToInsert);
        } else if(mode === 'replace-headings'){
          doc.setValue(doc.getValue().replace(originalContent, contentToInsert));
        }
    }

    async markdownLink(filePath: string){
      const file = await this.vault.getMarkdownFiles().filter(f => f.path === filePath)[0];
      const link = await this.fileManager.generateMarkdownLink(file, '', '', '');
      return link;
    }

    templatedContent(input: string, template: string, currentNoteTitle: string, currentNoteLink: string, newNoteTitle: string, newNoteLink: string, newNotePath: string, newNoteContent: string): string {
      if(template === undefined || template === ''){
        return input;
      }
      let output = template;
      output = this.momentRegex.replace(output);
      output = this.templatePlaceholders.title.replace(output, currentNoteTitle);
      output = this.templatePlaceholders.link.replace(output, currentNoteLink);
      output = this.templatePlaceholders.newNoteTitle.replace(output, newNoteTitle);
      output = this.templatePlaceholders.newNoteLink.replace(output, newNoteLink);
      output = this.templatePlaceholders.newNoteContent.replace(output, newNoteContent);
      output = this.templatePlaceholders.newNotePath.replace(output, newNotePath);
      return output;
    }

    selectedContent(doc:Editor): string[] {
      const selectedText = doc.getSelection()
      // Splitting by newline from the start to preserve original indentation.
      // trim() might remove intentional leading/trailing empty lines if not careful,
      // but for selectedContent, usually we want the lines that have actual content.
      // If selection is empty, selectedText is '', selectedText.split('\n') is [''].
      // If selection has content, .trim() is good to remove accidental whitespace around the block.
      const trimmedSelection = selectedText.trim();
      if (trimmedSelection === '') return [];
      return trimmedSelection.split('\n');
    }
  
    noteRemainder(doc:Editor): string[] {
      doc.setCursor(doc.getCursor().line, 0);
      const currentLine = doc.getCursor();
      const endPosition = doc.offsetToPos(doc.getValue().length);
      const content = doc.getRange(currentLine, endPosition);
      const trimmedContent = content.trim();
      if (trimmedContent === '') return [];
      return trimmedContent.split('\n');
    }

    contentSplitByHeading(doc:Editor, headingLevel: number): string[][] {
      const content = doc.getValue().split('\n');
      const parentHeading = new Array(headingLevel).join('#') + ' ';
      const heading = new Array(headingLevel + 1).join('#') + ' ';
      const matches: string[][] = [];
      let headingMatch: string[] = [];
      content.forEach((line, i) => {
        if(line.startsWith(heading)){
          if(headingMatch.length > 0) {
            matches.push(headingMatch);
          }
          headingMatch = [line]; // Start new match
        } else if(headingMatch.length > 0 && !line.startsWith(parentHeading)  ){
          headingMatch.push(line);
        } else if(headingMatch.length > 0) { // Line is a parent heading or unrelated, and we have a match
          matches.push(headingMatch);
          headingMatch = []; // Reset
        }
        //Making sure the last headingMatch array is added to the matches
        if(i === content.length - 1 && headingMatch.length > 0){
          matches.push(headingMatch);
        }
      });
      return matches;
    }

    private getIndentation(line: string): number {
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') {
          count++;
        } else {
          break;
        }
      }
      return count;
    }
  
    splitSelectedBulletPoints(selectedLines: string[], bulletPointRegex: RegExp): string[][] {
      const notes: string[][] = [];
      let currentNote: string[] = [];
      let baseIndentation: number = -1;

      for (const line of selectedLines) {
        if (bulletPointRegex.test(line)) {
          const currentIndentation = this.getIndentation(line);

          if (baseIndentation === -1) {
            baseIndentation = currentIndentation;
          }

          if (currentIndentation < baseIndentation) { // New list, less indented
            if (currentNote.length > 0) {
              notes.push([...currentNote]);
            }
            currentNote = [line];
            baseIndentation = currentIndentation; // Reset base indentation
          } else if (currentIndentation === baseIndentation) { // New item at same primary level
            if (currentNote.length > 0) {
              notes.push([...currentNote]);
            }
            currentNote = [line];
          } else { // currentIndentation > baseIndentation (sub-item)
            if (currentNote.length > 0) { // Must belong to an existing note
              currentNote.push(line);
            }
            // If currentNote is empty and this is a sub-item, it's ignored if no baseIndentation has been set.
            // Or, if baseIndentation is set, it implies it's a sub-item of a non-existent prior base-level item.
            // This case might need refinement if lists can validly start with deeper indentations
            // without a preceding base level item within the selection.
            // For now, this logic correctly attaches to an active currentNote.
          }
        } else { // Not a bullet point line (continuation text)
          if (currentNote.length > 0) {
            currentNote.push(line);
          }
          // If currentNote is empty, this non-bullet line is ignored (e.g. leading non-bullet lines in selection)
        }
      }

      if (currentNote.length > 0) {
        notes.push([...currentNote]);
      }
      return notes;
    }
    
    noteContent(firstLine:string, contentArr:string[], contentOnly?:boolean): string {
      if(this.settings.includeFirstLineAsNoteHeading){
        const headingBaseline = firstLine.replace(HEADING_REGEX, '');
        contentArr.unshift(`${this.settings.headingFormat} ${headingBaseline}`.trim());
      } else if(!this.settings.excludeFirstLineInNote || contentOnly){
        contentArr.unshift(firstLine);
      }
      if(this.settings.normalizeHeaderLevels){
        contentArr = this.normalizeHeadingLevels(contentArr);
      }
      return contentArr.join('\n').trim();
    }

    normalizeHeadingLevels(contentArr:string[]): string[] {
      const minHeadingLevel = Math.min(...contentArr.map(line => this.headingLevel(line)).filter(level => level > 0));
      if(minHeadingLevel > 1) {
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
        if (line[i] === '#') {
          headingLevel++;
        } else if(line[i] === ' '){
          break;
        } else {
          headingLevel = 0;
          break;
        }
      }
      return headingLevel;
    }
}