import {
  commands,
  ExtensionContext,
  QuickPickOptions,
  StatusBarAlignment,
  StatusBarItem,
  TabInputText,
  TextDocumentChangeEvent,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration,
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
} from 'vscode';
import { FolderView, Tab } from './interfaces';
import { consts } from './consts';

export class ViewsManager {
  actualFolderView!: FolderView | undefined;
  statusBarItem!: StatusBarItem;
  context!: ExtensionContext;
  config!: WorkspaceConfiguration;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.actualFolderView = this.getLastFolderView();
    this.config = workspace.getConfiguration(consts.CONFIG_SECTION);

    // Create a status bar item.......
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
    this.statusBarItem.command = consts.STATUS_BAR_COMMAND_CLICK;
    context.subscriptions.push(this.statusBarItem);

    // Click extension
    context.subscriptions.push(
      commands.registerCommand(consts.STATUS_BAR_COMMAND_CLICK, () => {
        this.showSelectFolder();
      })
    );

    // Detect changes in workspace folders
    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(event => this.changedfolderWorkspaces(event)));

    // Detect changes in settings
    context.subscriptions.push(
      workspace.onDidChangeConfiguration(configuration => {
        if (configuration.affectsConfiguration(consts.CONFIG_SECTION + '.' + consts.CONFIG_STATUSBAR_ITEM_COLOR)) {
          this.updateStatusBarItem();
        }
      })
    );

    // context.subscriptions.push(workspace.onDidChangeTextDocument((event: TextDocumentChangeEvent) => this.changeViewOnClick(event)));

    if (this.actualFolderView) {
      this.updateStatusBarItem();
      this.loadActualFolderView();
    }
  }

  public dispose() {
    this.saveActualFolderView();
  }

  private showSelectFolder() {
    const options: QuickPickOptions = { placeHolder: 'Select wowkspace folder' };
    const workspaceFoldersNames: string[] =
      workspace.workspaceFolders && this.actualFolderView && this.actualFolderView.name
        ? workspace.workspaceFolders.filter(folder => folder.name !== this.actualFolderView!.name).map(folder => folder.name)
        : [];

    if (workspaceFoldersNames.length) {
      window.showQuickPick(workspaceFoldersNames, options).then(selectedFolder => {
        if (selectedFolder) {
          this.saveActualFolderView();
          this.actualFolderView = this.workspaceFolderToFolderView(this.getWorkspaceFolderByName(selectedFolder)!);
          this.context.workspaceState.update(consts.CONFIG_LAST_FOLDER_VIEW, this.actualFolderView);
          this.loadActualFolderView();
          this.updateStatusBarItem();
        }
      });
    }
  }

  private saveActualFolderView() {
    const foldersViews: FolderView[] = this.getFoldersViews();
    let folderView: FolderView | undefined = foldersViews.find(folderView => folderView.name === this.actualFolderView!.name);

    if (!folderView) {
      const workspaceFolder = this.getWorkspaceFolderByName(this.actualFolderView!.name);

      if (workspaceFolder) {
        folderView = { name: this.actualFolderView!.name, uri: workspaceFolder.uri, tabs: this.getOpenTabs() };
        foldersViews.push(folderView);
      }
    } else {
      folderView.tabs = this.getOpenTabs();
    }

    this.context.workspaceState.update(consts.CONFIG_FOLDER_VIEWS, JSON.stringify(foldersViews));
  }

  private getWorkspaceFolderByName(folderName: string): WorkspaceFolder | undefined {
    return workspace.workspaceFolders!.find(workspaceFolder => workspaceFolder.name === folderName);
  }

  private getOpenTabs(): Tab[] {
    let openTabs: Tab[] = [];
    const saveTabsOfOtherFolders: boolean = this.config.get(consts.CONFIG_SAVE_TABS_OF_OTHER_FOLDERS) || true;

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

  private getLastFolderView(): FolderView | undefined {
    const foldersViews: FolderView[] = this.getFoldersViews();
    const folderView: FolderView | undefined = workspace.workspaceFolders ? this.workspaceFolderToFolderView(workspace.workspaceFolders[0]) : undefined;

    return this.context.workspaceState.get(consts.CONFIG_LAST_FOLDER_VIEW) || (foldersViews.length ? foldersViews[0] : undefined) || folderView;
  }

  private workspaceFolderToFolderView(workspaceFolder: WorkspaceFolder): FolderView {
    return { name: workspaceFolder.name, uri: workspaceFolder.uri };
  }

  private getFoldersViews(): FolderView[] {
    return JSON.parse(this.context.workspaceState.get(consts.CONFIG_FOLDER_VIEWS) || '[]');
  }

  private loadActualFolderView() {
    if (workspace.workspaceFolders) {
      const folderView: FolderView = this.getFoldersViews().find(folderView => folderView.name === this.actualFolderView!.name)!;

      if (workspace.workspaceFolders.length > 1) {
        this.executeLoadCommands(this.getWorkspaceFolderByName(this.actualFolderView!.name));
      }

      if (folderView && folderView.tabs) {
        folderView.tabs.forEach(tab => {
          const uri = Uri.file(tab.uri.path);
          commands.executeCommand('vscode.open', uri);
        });
      }
    }
  }

  private executeLoadCommands(workspaceFolder: WorkspaceFolder | undefined) {
    // Close all tabs
    commands.executeCommand('workbench.action.closeAllEditors');

    if (this.config.get(consts.CONFIG_COLLAPSE_FOLDERS_ON_CHANGE)) {
      commands.executeCommand('workbench.files.action.collapseExplorerFolders');
    }

    if (workspaceFolder) {
      commands.executeCommand('revealInExplorer', workspaceFolder.uri);
      commands.executeCommand('list.expand');
    }
  }

  private changedfolderWorkspaces(event: WorkspaceFoldersChangeEvent) {
    if (event.removed.length) {
      const foldersViews: FolderView[] = this.getFoldersViews().filter(folderView => folderView.name !== event.removed[0].name);
      this.context.workspaceState.update(consts.CONFIG_FOLDER_VIEWS, JSON.stringify(foldersViews));

      if (workspace.workspaceFolders) {
        this.actualFolderView = foldersViews[0];
        this.loadActualFolderView();
      } else {
        this.config.update(consts.CONFIG_FOLDER_VIEWS, undefined);
      }
    } else {
      if (workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
        this.saveActualFolderView();
        this.actualFolderView = this.workspaceFolderToFolderView(event.added[0]);
        //        this.executeLoadCommands(event.added[0]);
        //        this.loadActualFolderView();
      }
    }

    this.updateStatusBarItem();
  }

  private updateStatusBarItem() {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 1) {
      this.statusBarItem.color = this.config.get(consts.CONFIG_STATUSBAR_ITEM_COLOR);
      this.statusBarItem.text = `$(file-submodule) ${this.actualFolderView?.name}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  // TO-DO: Change view if click file of other folder
  private changeViewOnClick(file: TextDocumentChangeEvent) {
    const changeViewWhenClickFileOfOtherFolder: boolean = this.config.get(consts.CONFIG_CHANGE_VIEW_WHEN_CLICK_FILE_OF_OTHER_FOLDER) || true;

    if (changeViewWhenClickFileOfOtherFolder) {
      if (file.document.uri.scheme === 'file') {
        console.log('file', file);
      }
    }
  }
}
