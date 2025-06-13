import { commands, ExtensionContext, QuickPickOptions, StatusBarAlignment, StatusBarItem, TabInputText, TextDocumentChangeEvent, Uri, window, workspace, WorkspaceConfiguration, WorkspaceFoldersChangeEvent } from 'vscode';
import { FolderWorkspace, FolderView, Tab } from './interfaces';

export class ViewsManager {
  actualFolderView!: string;
  statusBarItem!: StatusBarItem;
  context!: ExtensionContext;
  config!: WorkspaceConfiguration;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.actualFolderView = this.getLastFolderViewName();
    this.config = workspace.getConfiguration('workspaceViews');

    // Create a status bar item
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
    this.statusBarItem.command = 'workspace-views.onClick';
    context.subscriptions.push(this.statusBarItem);

    // Click extension
    context.subscriptions.push(
      commands.registerCommand('workspace-views.onClick', () => {
        this.showSelectFolder();
      })
    );

    // Detect changes in workspace folders
    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(event => this.changedWorkspaceFolders(event)));

    // Detect changes in settings
    context.subscriptions.push(
      workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('workspaceViews.statusColor')) {
          this.updateStatusBarItem();
        }
      })
    );

    context.subscriptions.push(workspace.onDidChangeTextDocument((event: TextDocumentChangeEvent) => this.changeViewOnClick(event)));

    this.updateStatusBarItem();
    this.loadActualFolderView();
  }

  public dispose() {
    this.saveActualFolderView();
  }

  private getWorkspaceFolders(): FolderWorkspace[] {
    return workspace.workspaceFolders
      ? workspace.workspaceFolders.map(workspaceFolder => {
          return { name: workspaceFolder.name, uri: workspaceFolder.uri };
        })
      : [];
  }

  private showSelectFolder() {
    const options: QuickPickOptions = { placeHolder: 'Select wowkspace folder' };
    const workspaceFoldersNames: string[] = workspace.workspaceFolders
      ? workspace.workspaceFolders.filter(folder => folder.name !== this.actualFolderView).map(folder => folder.name)
      : [];

    if (workspaceFoldersNames.length) {
      window.showQuickPick(workspaceFoldersNames, options).then(selectedFolder => {
        if (selectedFolder) {
          this.saveActualFolderView();
          this.actualFolderView = selectedFolder;
          this.context.workspaceState.update('last-folder-view', this.actualFolderView);
          this.loadActualFolderView();
          this.updateStatusBarItem();
        }
      });
    }
  }

  private saveActualFolderView() {
    const foldersViews: FolderView[] = this.getFoldersViews();
    let folderView: FolderView | undefined = foldersViews.find(folderView => folderView.name === this.actualFolderView);

    if (!folderView) {
      const workspaceFolder = this.getWorkspaceFolderByName(this.actualFolderView);

      if (workspaceFolder) {
        folderView = { name: this.actualFolderView, uri: workspaceFolder.uri, tabs: this.getOpenTabs() };
        foldersViews.push(folderView);
      }
    } else {
      folderView.tabs = this.getOpenTabs();
    }

    this.context.workspaceState.update('folders-views', JSON.stringify(foldersViews));
  }

  private getWorkspaceFolderByName(folderName: string): FolderWorkspace | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    let result!: FolderWorkspace | undefined;

    if (workspaceFolders) {
      const workspaceFolder = workspaceFolders.find(workspaceFolder => workspaceFolder.name === folderName);

      if (workspaceFolder) {
        result = { name: workspaceFolder.name, uri: workspaceFolder.uri };
      }
    }

    return result;
  }

  private getOpenTabs(): Tab[] {
    let openTabs: Tab[] = [];
    const saveTabsOfOtherFolders: boolean = this.config.get('saveTabsOfOtherFolders') || true;

    openTabs = window.tabGroups.all.flatMap(group =>
      group.tabs
        .map(tab => {
          if (saveTabsOfOtherFolders) {
            console.log(tab);
          }

          if (tab.input instanceof TabInputText) {
            return { label: tab.label, uri: (tab.input as TabInputText).uri } as Tab;
          }
          return undefined;
        })
        .filter((value): value is Tab => value !== undefined)
    );

    return openTabs;
  }

  private getLastFolderViewName(): string {
    const foldersViews: FolderView[] = this.getFoldersViews();
    const workspaceFolderName: string = this.getWorkspaceFolders().length ? this.getWorkspaceFolders()[0].name : '';

    return this.context.workspaceState.get('last-folder-view') || (foldersViews.length ? foldersViews[0].name : undefined) || workspaceFolderName;
  }

  private getFoldersViews(): FolderView[] {
    return JSON.parse(this.context.workspaceState.get('folders-views') || '[]');
  }

  private loadActualFolderView() {
    const folderView: FolderView = this.getFoldersViews().find(folderView => folderView.name === this.actualFolderView)!;

    this.executeLoadCommands(folderView);

    if (folderView) {
      folderView.tabs.forEach(tab => {
        const uri = Uri.file(tab.uri.path);
        commands.executeCommand('vscode.open', uri);
      });
    }
  }

  private executeLoadCommands(folderView: FolderView) {
    const uri = folderView ? folderView.uri : workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.name === this.actualFolderView)?.uri;

    // Close all tabs
    commands.executeCommand('workbench.action.closeAllEditors');

    if (this.config.get('collapseFoldersOnChange')) {
      commands.executeCommand('workbench.files.action.collapseExplorerFolders');
    }

    if (uri) {
      commands.executeCommand('revealInExplorer', uri);
      commands.executeCommand('list.expand');
    }
  }

  private changedWorkspaceFolders(event: WorkspaceFoldersChangeEvent) {
    if (event.removed.length) {
      const foldersViews: FolderView[] = this.getFoldersViews().filter(folderView => folderView.name !== event.removed[0].name);
      this.context.workspaceState.update('folders-views', JSON.stringify(foldersViews));

      if (this.getWorkspaceFolders().length < 2) {
        this.updateStatusBarItem();
      } else {
        this.actualFolderView = foldersViews[0].name;
        this.loadActualFolderView();
      }
    } else {
      if (this.getWorkspaceFolders().length > 1) {
        this.saveActualFolderView();
        this.actualFolderView = event.added[0].name;
        this.updateStatusBarItem();
        this.loadActualFolderView();
      }
    }
  }

  private updateStatusBarItem() {
    if (this.getWorkspaceFolders().length > 1) {
      this.statusBarItem.color = this.config.get('statusColor');
      this.statusBarItem.text = `$(file-submodule) ${this.actualFolderView}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  private changeViewOnClick(file: TextDocumentChangeEvent) {
    const changeViewWhenClickFileOfOtherFolder: boolean = this.config.get('changeViewWhenClickFileOfOtherFolder') || true;

    if (changeViewWhenClickFileOfOtherFolder) {
      if (file.document.uri.scheme === 'file') {
        console.log('file', file);
      }
    }
  }
}
