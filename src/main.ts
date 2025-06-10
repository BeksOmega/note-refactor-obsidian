import {
  Editor,
  getLinkpath,
  MarkdownView,
  Notice,
  Plugin,
  SuggestModal,
  Vault,
  DataAdapter
} from 'obsidian';
import MomentDateRegex from './moment-date-regex';
import { NoteRefactorSettingsTab } from './settings-tab';
import { NoteRefactorSettings } from './settings';
import NRFile from './file';
import ObsidianFile from './obsidian-file';
import NRDoc, { ReplaceMode } from './doc';
import NoteRefactorModal from './note-modal';
import ModalNoteCreation from './modal-note-creation';
import { BULLET_POINT_REGEX } from './constants';

export default class NoteRefactor extends Plugin {
  settings: NoteRefactorSettings;
  momentDateRegex: MomentDateRegex;
  obsFile: ObsidianFile;
  file: NRFile;
  NRDoc: NRDoc;
  vault: Vault;
  vaultAdapter: DataAdapter;

  onInit() {}

  async onload() {
    console.log("Loading Note Refactor plugin");
    this.settings = Object.assign(new NoteRefactorSettings(), await this.loadData());
    this.momentDateRegex = new MomentDateRegex();
    this.obsFile = new ObsidianFile(this.settings, this.app);
    this.file = new NRFile(this.settings);
    this.NRDoc = new NRDoc(this.settings, this.app.vault, this.app.fileManager);

    this.addCommand({
      id: 'app:extract-selection-first-line',
      name: 'Extract selection to new note - first line as file name',
      callback: () => this.editModeGuard(async () => await this.extractSelectionFirstLine('replace-selection')),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "n",
        },
      ],
    });

    this.addCommand({
      id: 'app:extract-selection-content-only',
      name: 'Extract selection to new note - content only',
      callback: () => this.editModeGuard(() => this.extractSelectionContentOnly('replace-selection')),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "c",
        },
      ],
    });

    this.addCommand({
      id: 'app:extract-selection-autogenerate-name',
      name: 'Extract selection to new note - only prefix as file name',
      callback: () => this.editModeGuard(() => this.extractSelectionAutogenerate('replace-selection'))
    });

    this.addCommand({
      id: 'app:split-note-first-line',
      name: 'Split note here - first line as file name',
      callback: () => this.editModeGuard(() => this.extractSelectionFirstLine('split')),
    });

    this.addCommand({
      id: 'app:split-note-content-only',
      name: 'Split note here - content only',
      callback: () => this.editModeGuard(() => this.extractSelectionContentOnly('split')),
    });

    this.addCommand({
      id: 'app:split-note-by-heading-h1',
      name: 'Split note by headings - H1',
      callback: () => this.editModeGuard(() => this.splitOnHeading(1)),
    });

    this.addCommand({
      id: 'app:split-note-by-heading-h2',
      name: 'Split note by headings - H2',
      callback: () => this.editModeGuard(() => this.splitOnHeading(2)),
    });

    this.addCommand({
      id: 'app:split-note-by-heading-h3',
      name: 'Split note by headings - H3',
      callback: () => this.editModeGuard(() => this.splitOnHeading(3)),
    });

    this.addCommand({
      id: 'app:split-selected-bullet-points',
      name: 'Split selected bullet points - first line as file name',
      callback: () => this.editModeGuard(async () => await this.splitSelectedBulletPoints()),
    });

    this.addCommand({
      id: 'app:split-selected-bullet-points-prefix',
      name: 'Split selected bullet points - prefix as file name',
      callback: () => this.editModeGuard(async () => await this.splitSelectedBulletPointsUsingPrefix()),
    });

    this.addCommand({
      id: 'app:split-selected-bullet-points-content-only',
      name: 'Split selected bullet points - content only',
      callback: () => this.editModeGuard(async () => await this.splitSelectedBulletPointsContentOnly()),
    });

    this.addSettingTab(new NoteRefactorSettingsTab(this.app, this));
  }

  async splitSelectedBulletPoints(): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      new Notice('No active Markdown view.');
      return;
    }
    const doc = mdView.editor;

    const selectedLines = this.NRDoc.selectedContent(doc);
    if (selectedLines.length === 0) {
      new Notice('No text selected.');
      return;
    }

    const bulletNotes = this.NRDoc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);

    if (bulletNotes.length === 0) {
      new Notice('No bullet points found in the selection to split.');
      return;
    }

    const dedupedFileNames = this.file.ensureUniqueFileNames(bulletNotes);

    for (let i = 0; i < bulletNotes.length; i++) {
      const noteLines = bulletNotes[i];
      await this.createNoteWithFirstLineAsFileName(dedupedFileNames[i], noteLines, mdView, doc, 'replace-selection', true);
    }

    new Notice(`Successfully split ${bulletNotes.length} notes from bullet points.`);
  }

  // Refactored method using the new helper
  async splitSelectedBulletPointsUsingPrefix(): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      new Notice('No active Markdown view.');
      return;
    }
    // const doc = mdView.editor; // doc is not directly used here anymore for content replacement

    const selectedLines = this.NRDoc.selectedContent(mdView.editor);
    if (selectedLines.length === 0) {
      new Notice('No text selected.');
      return;
    }

    const bulletNotes = this.NRDoc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
    if (bulletNotes.length === 0) {
      new Notice('No bullet points found in the selection to split.');
      return;
    }

    const basePrefix = this.file.fileNamePrefix();
    if (!basePrefix && basePrefix !== "") {
        new Notice('File name prefix is not properly configured in settings.');
        return;
    }

    const fileNameCandidates: string[] = [];
    for (let i = 0; i < bulletNotes.length; i++) {
        fileNameCandidates.push(this.file.sanitisedFileName(`${basePrefix}${basePrefix ? '-' : ''}${i + 1}`));
    }

    const dummyNotesForNaming: string[][] = fileNameCandidates.map(name => [name]);
    const dedupedFileNames = this.file.ensureUniqueFileNames(dummyNotesForNaming);
    let createdCount = 0;

    for (let i = 0; i < bulletNotes.length; i++) {
      const noteLines = bulletNotes[i];
      const currentFilename = dedupedFileNames[i];
      const filePath = await this._createNoteFromBulletItem(currentFilename, noteLines, mdView, false); // isContentOnly = false

      if (filePath && this.settings.openNewNote && i === 0) { // Open only the first successfully created note
        await this.app.workspace.openLinkText(currentFilename, getLinkpath(filePath), true);
      }
      if (filePath) {
        createdCount++;
      }
    }
    // TODO: Define how content replacement should work for multi-note splits from a single selection.
    // For now, original selection is not modified by this specific command variant.
    new Notice(`Successfully split and created ${createdCount} notes using prefix "${basePrefix}". Original selection not modified.`);
  }

  // Refactored method using the new helper
  async splitSelectedBulletPointsContentOnly(): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      new Notice('No active Markdown view.');
      return;
    }
    // const doc = mdView.editor; // doc is not directly used here anymore

    const selectedLines = this.NRDoc.selectedContent(mdView.editor);
    if (selectedLines.length === 0) {
      new Notice('No text selected.');
      return;
    }

    const bulletNotes = this.NRDoc.splitSelectedBulletPoints(selectedLines, BULLET_POINT_REGEX);
    if (bulletNotes.length === 0) {
      new Notice('No bullet points found in the selection to split.');
      return;
    }

    const basePrefix = this.file.fileNamePrefix();
    if (!basePrefix && basePrefix !== "") {
        new Notice('File name prefix is not properly configured in settings.');
        return;
    }

    const fileNameCandidates: string[] = [];
    for (let i = 0; i < bulletNotes.length; i++) {
        fileNameCandidates.push(this.file.sanitisedFileName(`${basePrefix}${basePrefix ? '-' : ''}${i + 1}`));
    }

    const dummyNotesForNaming: string[][] = fileNameCandidates.map(name => [name]);
    const dedupedFileNames = this.file.ensureUniqueFileNames(dummyNotesForNaming);
    let createdCount = 0;

    for (let i = 0; i < bulletNotes.length; i++) {
      const noteLines = bulletNotes[i];
      const currentFilename = dedupedFileNames[i];
      const filePath = await this._createNoteFromBulletItem(currentFilename, noteLines, mdView, true); // isContentOnly = true

      if (filePath && this.settings.openNewNote && i === 0) {
        await this.app.workspace.openLinkText(currentFilename, getLinkpath(filePath), true);
      }
      if (filePath) {
        createdCount++;
      }
    }
    new Notice(`Successfully split and created ${createdCount} notes (content only) using prefix "${basePrefix}". Original selection not modified.`);
  }

  private async _createNoteFromBulletItem(fileName: string, noteItemLines: string[], mdView: MarkdownView, isContentOnly: boolean): Promise<string | null> {
    const header = noteItemLines[0] || '';
    const contentArr = noteItemLines.slice(1);
    const originalNote = this.NRDoc.noteContent(header, contentArr, isContentOnly);
    let noteContent = originalNote;

    try {
        const filePath = await this.obsFile.createOrAppendFile(fileName, '');
        if (!filePath) {
            new Notice(`Failed to create file for: ${fileName}`);
            return null;
        }

        if (this.settings.refactoredNoteTemplate !== undefined && this.settings.refactoredNoteTemplate !== '') {
            const link = await this.app.fileManager.generateMarkdownLink(mdView.file, '', '', '');
            const newNoteLink = await this.NRDoc.markdownLink(filePath);
            noteContent = this.NRDoc.templatedContent(noteContent, this.settings.refactoredNoteTemplate, mdView.file.basename, link, fileName, newNoteLink, filePath, noteContent);
        }

        await this.vault.adapter.write(filePath, noteContent);
        return filePath;
    } catch (error) {
        console.error(`Error creating note from bullet item "${fileName}":`, error);
        new Notice(`Error creating note: ${fileName}`);
        return null;
    }
  }

  onunload() {
    console.log("Unloading Note Refactor plugin");
  }

  editModeGuard(command: () => any): void {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if(!mdView || mdView.getMode() !== 'source') {
      new Notice('Please use Note Refactor plugin in edit mode');
      return;
    } else {
      command();
    }
  }

  async splitOnHeading(headingLevel: number){
      const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
      const doc = mdView.editor;
      const headingNotes = this.NRDoc.contentSplitByHeading(doc, headingLevel);
      const dedupedFileNames = this.file.ensureUniqueFileNames(headingNotes);
      for (let i = 0; i < headingNotes.length; i++) {
        await this.createNoteWithFirstLineAsFileName(dedupedFileNames[i], headingNotes[i], mdView, doc, 'replace-headings', true);
      }
  }

  async extractSelectionFirstLine(mode: ReplaceMode): Promise<void> {
      const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
      const doc = mdView.editor;
      if(!mdView) {return}

      const selectedContent = mode === 'split' ? this.NRDoc.noteRemainder(doc) : this.NRDoc.selectedContent(doc);
      if(selectedContent.length === 0) {
        new Notice('No content selected to extract.');
        return;
      }
      const dedupedFileName = this.file.ensureUniqueFileNames([selectedContent[0]])[0];
      await this.createNoteWithFirstLineAsFileName(dedupedFileName, selectedContent, mdView, doc, mode, false);
  }

  async extractSelectionAutogenerate(mode: ReplaceMode): Promise<void> {
      const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
      const doc = mdView.editor;
      if(!mdView) {return}

      const selectedContent = mode === 'split' ? this.NRDoc.noteRemainder(doc) : this.NRDoc.selectedContent(doc);
      if(selectedContent.length === 0) {
        new Notice('No content selected to extract.');
        return;
      }
      await this.createAutogeneratedNote(selectedContent, mdView, doc, mode, true);
  }

  private async createAutogeneratedNote(selectedContent: string[], mdView: MarkdownView, doc: Editor, mode: ReplaceMode, isMultiple: boolean) {
    const header = selectedContent[0] || '';
    const contentArr = selectedContent.slice(1);

    const fileNameAttempt = this.file.fileNamePrefix();
    const fileName = this.file.ensureUniqueFileNames([fileNameAttempt])[0];
    const originalNote = this.NRDoc.noteContent(header, contentArr);
    let note = originalNote;
    const filePath = await this.obsFile.createOrAppendFile(fileName, '');

    if (this.settings.refactoredNoteTemplate !== undefined && this.settings.refactoredNoteTemplate !== '') {
      const link = await this.app.fileManager.generateMarkdownLink(mdView.file, '', '', '');
      const newNoteLink = await this.NRDoc.markdownLink(filePath);
      note = this.NRDoc.templatedContent(note, this.settings.refactoredNoteTemplate, mdView.file.basename, link, fileName, newNoteLink, filePath, note);
    }

    await this.vault.adapter.write(filePath, note);
    await this.NRDoc.replaceContent(fileName, filePath, doc, mdView.file, note, originalNote, mode);
    if(!isMultiple && this.settings.openNewNote) {
        await this.app.workspace.openLinkText(fileName, getLinkpath(filePath), true);
    }
  }

  private async createNoteWithFirstLineAsFileName(dedupedFileName: string, selectedContent: string[], mdView: MarkdownView, doc: Editor, mode: ReplaceMode, isMultiple: boolean) {
    const originalHeader = selectedContent[0] || '';
    const contentArr = selectedContent.slice(1);

    const fileName = dedupedFileName;
    const originalNote = this.NRDoc.noteContent(originalHeader, contentArr);
    let note = originalNote;
    const filePath = await this.obsFile.createOrAppendFile(fileName, '');

    if (this.settings.refactoredNoteTemplate !== undefined && this.settings.refactoredNoteTemplate !== '') {
      const link = await this.app.fileManager.generateMarkdownLink(mdView.file, '', '', '');
      const newNoteLink = await this.NRDoc.markdownLink(filePath);
      note = this.NRDoc.templatedContent(note, this.settings.refactoredNoteTemplate, mdView.file.basename, link, fileName, newNoteLink, filePath, note);
    }

    await this.vault.adapter.write(filePath, note);
    await this.NRDoc.replaceContent(fileName, filePath, doc, mdView.file, note, originalNote, mode);
    if(!isMultiple && this.settings.openNewNote) {
        await this.app.workspace.openLinkText(fileName, getLinkpath(filePath), true);
    }
  }

  extractSelectionContentOnly(mode:ReplaceMode): void {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if(!mdView) {return}
    const doc = mdView.editor;

    const contentArr = mode === 'split' ? this.NRDoc.noteRemainder(doc): this.NRDoc.selectedContent(doc);
    if(contentArr.length === 0) {
      new Notice('No content selected to extract.');
      return;
    }
    this.loadModal(contentArr, doc, mode);
  }

  loadModal(contentArr:string[], doc:Editor, mode:ReplaceMode): void {
    const firstLine = contentArr[0] || '';
    const restOfLines = contentArr.slice(1);
    let note = this.NRDoc.noteContent(firstLine, restOfLines, true);
    const modalCreation = new ModalNoteCreation(this.app, this.settings, this.NRDoc, this.file, this.obsFile, note, doc, mode);
    new NoteRefactorModal(this.app, modalCreation).open();
  }
}
