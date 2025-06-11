import {
  Editor,
  getLinkpath,
  MarkdownView,
  Notice,
  Plugin,
  SuggestModal,
  Vault,
  DataAdapter,
  TFile,
} from "obsidian";
import MomentDateRegex from "./moment-date-regex";
import { NoteRefactorSettingsTab } from "./settings-tab";
import { NoteRefactorSettings } from "./settings";
import NRFile from "./file";
import ObsidianFile from "./obsidian-file";
import NRDoc, { ReplaceMode } from "./doc";
import NoteRefactorModal from "./note-modal";
import ModalNoteCreation from "./modal-note-creation";
import { BULLET_POINT_REGEX } from "./constants";

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
    this.settings = Object.assign(
      new NoteRefactorSettings(),
      await this.loadData(),
    );
    this.momentDateRegex = new MomentDateRegex();
    this.vault = this.app.vault;
    this.vaultAdapter = this.vault.adapter;
    this.obsFile = new ObsidianFile(this.settings, this.app);
    this.file = new NRFile(this.settings);
    this.NRDoc = new NRDoc(this.settings, this.app.vault, this.app.fileManager);

    this.addCommand({
      id: "app:extract-selection-first-line",
      name: "Extract selection to new note - first line as file name",
      callback: () =>
        this.editModeGuard(
          async () => await this.extractSelectionFirstLine("replace-selection"),
        ),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "n",
        },
      ],
    });

    this.addCommand({
      id: "app:extract-selection-content-only",
      name: "Extract selection to new note - content only",
      callback: () =>
        this.editModeGuard(() =>
          this.extractSelectionContentOnly("replace-selection"),
        ),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "c",
        },
      ],
    });

    this.addCommand({
      id: "app:extract-selection-autogenerate-name",
      name: "Extract selection to new note - only prefix as file name",
      callback: () =>
        this.editModeGuard(() =>
          this.extractSelectionAutogenerate("replace-selection"),
        ),
    });

    this.addCommand({
      id: "app:split-note-first-line",
      name: "Split note here - first line as file name",
      callback: () =>
        this.editModeGuard(() => this.extractSelectionFirstLine("split")),
    });

    this.addCommand({
      id: "app:split-note-content-only",
      name: "Split note here - content only",
      callback: () =>
        this.editModeGuard(() => this.extractSelectionContentOnly("split")),
    });

    this.addCommand({
      id: "app:split-note-by-heading-h1",
      name: "Split note by headings - H1",
      callback: () => this.editModeGuard(() => this.splitOnHeading(1)),
    });

    this.addCommand({
      id: "app:split-note-by-heading-h2",
      name: "Split note by headings - H2",
      callback: () => this.editModeGuard(() => this.splitOnHeading(2)),
    });

    this.addCommand({
      id: "app:split-note-by-heading-h3",
      name: "Split note by headings - H3",
      callback: () => this.editModeGuard(() => this.splitOnHeading(3)),
    });

    this.addCommand({
      id: "app:split-selected-bullet-points",
      name: "Split selected bullet points - first line as file name",
      callback: () =>
        this.editModeGuard(async () => await this.splitSelectedBulletPoints()),
    });

    this.addCommand({
      id: "app:split-selected-bullet-points-prefix",
      name: "Split selected bullet points - prefix as file name",
      callback: () =>
        this.editModeGuard(
          async () => await this.splitSelectedBulletPointsUsingPrefix(),
        ),
    });

    this.addCommand({
      id: "app:split-selected-bullet-points-content-only",
      name: "Split selected bullet points - content only",
      callback: () =>
        this.editModeGuard(
          async () => await this.splitSelectedBulletPointsContentOnly(),
        ),
    });

    this.addSettingTab(new NoteRefactorSettingsTab(this.app, this));
  }

  async splitSelectedBulletPoints(): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      new Notice("No active Markdown view.");
      return;
    }
    const editor = mdView.editor;

    const bulletNotes = this.getValidatedBulletPointSelection(mdView);
    if (!bulletNotes) {
      return;
    }

    const dedupedFileNames = this.file.ensureUniqueFileNames(bulletNotes);

    for (let i = 0; i < bulletNotes.length; i++) {
      const noteLines = bulletNotes[i];
      await this.createNoteWithFirstLineAsFileName(
        dedupedFileNames[i],
        noteLines,
        mdView,
        editor,
        "replace-selection",
        true,
      );
    }

    new Notice(
      `Successfully split ${bulletNotes.length} notes from bullet points.`,
    );
  }

  // Refactored method using the new helper
  async splitSelectedBulletPointsUsingPrefix(): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      new Notice("No active Markdown view.");
      return;
    }

    const bulletNotes = this.getValidatedBulletPointSelection(mdView);
    if (!bulletNotes) {
      return;
    }

    const basePrefix = this.file.fileNamePrefix();

    const dedupedFileNames = this.generatePrefixedFileNames(
      bulletNotes,
      basePrefix,
    );
    if (dedupedFileNames.length === 0) {
      return;
    }

    const createdCount = await this.createNotesFromBulletsAndReplaceLinks(
      mdView,
      bulletNotes,
      dedupedFileNames,
      false, // isContentOnly for _createNoteFromBulletItem
    );

    if (createdCount > 0) {
      new Notice(
        `Successfully split and created ${createdCount} notes using prefix "${basePrefix}".`,
      );
    }
  }

  // Refactored method using the new helper
  async splitSelectedBulletPointsContentOnly(): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      new Notice("No active Markdown view.");
      return;
    }

    const bulletNotes = this.getValidatedBulletPointSelection(mdView);
    if (!bulletNotes) {
      return;
    }

    const basePrefix = this.file.fileNamePrefix();

    const dedupedFileNames = this.generatePrefixedFileNames(
      bulletNotes,
      basePrefix,
    );
    if (dedupedFileNames.length === 0) {
      return;
    }

    const createdCount = await this.createNotesFromBulletsAndReplaceLinks(
      mdView,
      bulletNotes,
      dedupedFileNames,
      true, // isContentOnly for _createNoteFromBulletItem
    );

    if (createdCount > 0) {
      new Notice(
        `Successfully split and created ${createdCount} notes (content only) using prefix "${basePrefix}".`,
      );
    }
  }

  private getValidatedBulletPointSelection(
    mdView: MarkdownView,
  ): string[][] | null {
    if (!mdView) {
      new Notice("No active Markdown view provided.");
      return null;
    }

    const editor = mdView.editor;
    const selectedLines = this.NRDoc.selectedContent(editor);
    if (selectedLines.length === 0) {
      new Notice("No text selected.");
      return null;
    }

    const bulletNotes = this.NRDoc.splitSelectedBulletPoints(
      selectedLines,
      BULLET_POINT_REGEX,
    );

    if (bulletNotes.length === 0) {
      new Notice("No bullet points found in the selection to split.");
      return null;
    }
    return bulletNotes;
  }

  private generatePrefixedFileNames(
    bulletNotes: string[][],
    basePrefix: string,
  ): string[] {
    if (!basePrefix && basePrefix !== "") {
      new Notice("File name prefix is not properly configured in settings.");
      return [];
    }

    const fileNameCandidates: string[] = [];
    for (let i = 0; i < bulletNotes.length; i++) {
      if (basePrefix) {
        if (i > 0) {
          fileNameCandidates.push(
            this.file.sanitisedFileName(`${basePrefix}-${i + 1}`),
          );
        } else {
          fileNameCandidates.push(this.file.sanitisedFileName(`${basePrefix}`));
        }
      } else {
        // If basePrefix is an empty string, name files "1", "2", ...
        fileNameCandidates.push(this.file.sanitisedFileName(`${i + 1}`));
      }
    }

    const dummyNotesForNaming: string[][] = fileNameCandidates.map((name) => [
      name,
    ]);
    return this.file.ensureUniqueFileNames(dummyNotesForNaming);
  }

  private async createNotesFromBulletsAndReplaceLinks(
    mdView: MarkdownView,
    bulletNotes: string[][],
    dedupedFileNames: string[],
    isContentOnly: boolean, // isContentOnly for _createNoteFromBulletItem
  ): Promise<number> {
    let createdCount = 0;
    const editor = mdView.editor;

    for (let i = 0; i < bulletNotes.length; i++) {
      const noteLines = bulletNotes[i];
      const currentFilename = dedupedFileNames[i];
      const filePath = await this._createNoteFromBulletItem(
        currentFilename,
        noteLines,
        mdView,
        isContentOnly,
      );

      if (filePath && this.settings.openNewNote) {
        const leaf = this.app.workspace.getLeaf("split", "vertical");
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          await leaf.openFile(file);
        }
      }
      if (filePath) {
        createdCount++;
      }
    }

    if (createdCount > 0) {
      // Replace the original selection with links to all created notes
      const createdLinks = await Promise.all(
        dedupedFileNames.slice(0, createdCount).map(async (fileName, index) => {
          const filePath = this.obsFile.filePathAndFileName(fileName, mdView);
          if (filePath) {
            const link = await this.NRDoc.markdownLink(filePath);
            return this.NRDoc.templatedContent(
              link,
              this.settings.noteLinkTemplate,
              mdView.file.basename,
              await this.NRDoc.markdownLink(mdView.file.path),
              fileName,
              link,
              filePath,
              bulletNotes[index].join("\n"),
            );
          }
          return "";
        }),
      );

      const replacementText = createdLinks.filter((link) => link).join("\n");
      if (replacementText) {
        editor.replaceSelection(replacementText);
      }
    }
    return createdCount;
  }

  private async _createNoteFromBulletItem(
    fileName: string,
    noteItemLines: string[],
    mdView: MarkdownView,
    isContentOnly: boolean,
  ): Promise<string | null> {
    const header = noteItemLines[0] || "";
    const contentArr = noteItemLines.slice(1);
    const originalNote = this.NRDoc.noteContent(
      header,
      contentArr,
      isContentOnly,
    );
    let noteContent = originalNote;

    try {
      const filePath = await this.obsFile.createOrAppendFile(fileName, "");
      if (!filePath) {
        new Notice(`Failed to create file for: ${fileName}`);
        return null;
      }

      if (
        this.settings.refactoredNoteTemplate !== undefined &&
        this.settings.refactoredNoteTemplate !== ""
      ) {
        const link = await this.app.fileManager.generateMarkdownLink(
          mdView.file,
          "",
          "",
          "",
        );
        const newNoteLink = await this.NRDoc.markdownLink(filePath);
        noteContent = this.NRDoc.templatedContent(
          noteContent,
          this.settings.refactoredNoteTemplate,
          mdView.file.basename,
          link,
          fileName,
          newNoteLink,
          filePath,
          noteContent,
        );
      }

      await this.vault.adapter.write(filePath, noteContent);
      return filePath;
    } catch (error) {
      console.error(
        `Error creating note from bullet item "${fileName}":`,
        error,
      );
      new Notice(`Error creating note: ${fileName}`);
      return null;
    }
  }

  onunload() {
    console.log("Unloading Note Refactor plugin");
  }

  editModeGuard(command: () => any): void {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView || mdView.getMode() !== "source") {
      new Notice("Please use Note Refactor plugin in edit mode");
      return;
    } else {
      command();
    }
  }

  async splitOnHeading(headingLevel: number) {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    const doc = mdView.editor;
    const headingNotes = this.NRDoc.contentSplitByHeading(doc, headingLevel);
    const dedupedFileNames = this.file.ensureUniqueFileNames(headingNotes);
    for (let i = 0; i < headingNotes.length; i++) {
      await this.createNoteWithFirstLineAsFileName(
        dedupedFileNames[i],
        headingNotes[i],
        mdView,
        doc,
        "replace-headings",
        true,
      );
    }
  }

  async extractSelectionFirstLine(mode: ReplaceMode): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    const doc = mdView.editor;
    if (!mdView) {
      return;
    }

    const selectedContent =
      mode === "split"
        ? this.NRDoc.noteRemainder(doc)
        : this.NRDoc.selectedContent(doc);
    if (selectedContent.length === 0) {
      new Notice("No content selected to extract.");
      return;
    }
    await this.createNoteWithFirstLineAsFileName(
      selectedContent[0],
      selectedContent,
      mdView,
      doc,
      mode,
      false,
    );
  }

  async extractSelectionAutogenerate(mode: ReplaceMode): Promise<void> {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    const doc = mdView.editor;
    if (!mdView) {
      return;
    }

    const selectedContent =
      mode === "split"
        ? this.NRDoc.noteRemainder(doc)
        : this.NRDoc.selectedContent(doc);
    if (selectedContent.length === 0) {
      new Notice("No content selected to extract.");
      return;
    }
    await this.createAutogeneratedNote(
      selectedContent,
      mdView,
      doc,
      mode,
      true,
    );
  }

  private async createAutogeneratedNote(
    selectedContent: string[],
    mdView: MarkdownView,
    doc: Editor,
    mode: ReplaceMode,
    isMultiple: boolean,
  ) {
    const header = selectedContent[0] || "";
    const contentArr = selectedContent.slice(1);

    const fileName = this.file.sanitisedFileName(this.file.fileNamePrefix());
    const originalNote = this.NRDoc.noteContent(header, contentArr);
    let note = originalNote;
    const filePath = await this.obsFile.createOrAppendFile(fileName, "");

    if (
      this.settings.refactoredNoteTemplate !== undefined &&
      this.settings.refactoredNoteTemplate !== ""
    ) {
      const link = await this.app.fileManager.generateMarkdownLink(
        mdView.file,
        "",
        "",
        "",
      );
      const newNoteLink = await this.NRDoc.markdownLink(filePath);
      note = this.NRDoc.templatedContent(
        note,
        this.settings.refactoredNoteTemplate,
        mdView.file.basename,
        link,
        fileName,
        newNoteLink,
        filePath,
        note,
      );
    }

    await this.vault.adapter.write(filePath, note);
    await this.NRDoc.replaceContent(
      fileName,
      filePath,
      doc,
      mdView.file,
      note,
      originalNote,
      mode,
    );
    if (!isMultiple && this.settings.openNewNote) {
      const leaf = this.app.workspace.getLeaf("split", "vertical");
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await leaf.openFile(file);
      }
    }
  }

  private async createNoteWithFirstLineAsFileName(
    dedupedFileName: string,
    selectedContent: string[],
    mdView: MarkdownView,
    doc: Editor,
    mode: ReplaceMode,
    isMultiple: boolean,
  ) {
    const originalHeader = selectedContent[0] || "";
    const contentArr = selectedContent.slice(1);

    const fileName = dedupedFileName;
    const originalNote = this.NRDoc.noteContent(originalHeader, contentArr);
    let note = originalNote;
    const filePath = await this.obsFile.createOrAppendFile(fileName, "");

    if (
      this.settings.refactoredNoteTemplate !== undefined &&
      this.settings.refactoredNoteTemplate !== ""
    ) {
      const link = await this.app.fileManager.generateMarkdownLink(
        mdView.file,
        "",
        "",
        "",
      );
      const newNoteLink = await this.NRDoc.markdownLink(filePath);
      note = this.NRDoc.templatedContent(
        note,
        this.settings.refactoredNoteTemplate,
        mdView.file.basename,
        link,
        fileName,
        newNoteLink,
        filePath,
        note,
      );
    }

    await this.vault.adapter.write(filePath, note);
    await this.NRDoc.replaceContent(
      fileName,
      filePath,
      doc,
      mdView.file,
      note,
      originalNote,
      mode,
    );
    if (!isMultiple && this.settings.openNewNote) {
      const leaf = this.app.workspace.getLeaf("split", "vertical");
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await leaf.openFile(file);
      }
    }
  }

  extractSelectionContentOnly(mode: ReplaceMode): void {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    if (!mdView) {
      return;
    }
    const doc = mdView.editor;

    const contentArr =
      mode === "split"
        ? this.NRDoc.noteRemainder(doc)
        : this.NRDoc.selectedContent(doc);
    if (contentArr.length === 0) {
      new Notice("No content selected to extract.");
      return;
    }
    this.loadModal(contentArr, doc, mode);
  }

  loadModal(contentArr: string[], doc: Editor, mode: ReplaceMode): void {
    const firstLine = contentArr[0] || "";
    const restOfLines = contentArr.slice(1);
    let note = this.NRDoc.noteContent(firstLine, restOfLines, true);
    const modalCreation = new ModalNoteCreation(
      this.app,
      this.settings,
      this.NRDoc,
      this.file,
      this.obsFile,
      note,
      doc,
      mode,
    );
    new NoteRefactorModal(this.app, modalCreation).open();
  }
}
