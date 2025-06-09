import { ExtensionContext, StatusBarAlignment, StatusBarItem, window, workspace, commands, QuickPickOptions, Uri, WorkspaceFoldersChangeEvent, TabInputText } from 'vscode';
import { FolderView, FolderWorkspace, Tab } from './interfaces';

let actualFolderView: string;
let statusBarItem: StatusBarItem;
const config = workspace.getConfiguration('workspaceViews');

export function activate(context: ExtensionContext) {
  actualFolderView = getLastFolderViewName(context);

  // Create a status bar item
  const status = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
  status.command = 'workspace-views.onClick';
  context.subscriptions.push(status);
  statusBarItem = status;

  // Click extension
  context.subscriptions.push(
    commands.registerCommand('workspace-views.onClick', () => {
      showSelectFolder(context);
    })
  );

  // Detect changes in workspace folders
  context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(event => changedWorkspaceFolders(event, context)));

  // Detect changes in settings
  context.subscriptions.push(
    workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('workspaceViews.statusColor')) {
        updateStatusBarItem();
      }
    })
  );

  updateStatusBarItem();
  loadActualFolderView(context);
}

export function deactivate() {}

function getWorkspaceFolders(): FolderWorkspace[] {
  return workspace.workspaceFolders
    ? workspace.workspaceFolders.map(workspaceFolder => {
        return { name: workspaceFolder.name, uri: workspaceFolder.uri };
      })
    : [];
}

function showSelectFolder(context: ExtensionContext) {
  const options: QuickPickOptions = { placeHolder: 'Select wowkspace folder' };
  const workspaceFoldersNames: string[] = workspace.workspaceFolders
    ? workspace.workspaceFolders.filter(folder => folder.name !== actualFolderView).map(folder => folder.name)
    : [];

  if (workspaceFoldersNames.length) {
    window.showQuickPick(workspaceFoldersNames, options).then(selectedFolder => {
      if (selectedFolder) {
        saveActualFolderView(context);
        actualFolderView = selectedFolder;
        context.workspaceState.update('last-folder-view', actualFolderView);
        loadActualFolderView(context);
        updateStatusBarItem();
      }
    });
  }
}

function saveActualFolderView(context: ExtensionContext) {
  const foldersViews: FolderView[] = getFoldersViews(context);
  let folderView: FolderView | undefined = foldersViews.find(folderView => folderView.name === actualFolderView);

  if (!folderView) {
    const workspaceFolder = getWorkspaceFolderByName(actualFolderView);

    if (workspaceFolder) {
      folderView = { name: actualFolderView, uri: workspaceFolder.uri, tabs: getOpenTabs() };
      foldersViews.push(folderView);
    }
  } else {
    folderView.tabs = getOpenTabs();
  }

  context.workspaceState.update('folders-views', JSON.stringify(foldersViews));
}

function getWorkspaceFolderByName(folderName: string): FolderWorkspace | undefined {
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

function getOpenTabs(): Tab[] {
  let openTabs: Tab[] = [];
  const saveTabsOfOtherFolders: boolean = config.get('saveTabsOfOtherFolders') || true;

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

function getLastFolderViewName(context: ExtensionContext): string {
  const foldersViews: FolderView[] = getFoldersViews(context);
  const workspaceFolderName: string = getWorkspaceFolders().length ? getWorkspaceFolders()[0].name : '';

  return context.workspaceState.get('last-folder-view') || (foldersViews.length ? foldersViews[0].name : undefined) || workspaceFolderName;
}

function getFoldersViews(context: ExtensionContext): FolderView[] {
  return JSON.parse(context.workspaceState.get('folders-views') || '[]');
}

function loadActualFolderView(context: ExtensionContext) {
  const folderView: FolderView = getFoldersViews(context).find(folderView => folderView.name === actualFolderView)!;

  executeLoadCommands(folderView);

  if (folderView) {
    folderView.tabs.forEach(tab => {
      const uri = Uri.file(tab.uri.path);
      commands.executeCommand('vscode.open', uri);
    });
  }
}

function executeLoadCommands(folderView: FolderView) {
  const uri = folderView ? folderView.uri : workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.name === actualFolderView)?.uri;

  // Close all tabs
  commands.executeCommand('workbench.action.closeAllEditors');

  if (config.get('collapseFoldersOnChange')) {
    commands.executeCommand('workbench.files.action.collapseExplorerFolders');
  }

  if (uri) {
    commands.executeCommand('revealInExplorer', uri);
    commands.executeCommand('list.expand');
  }
}

function changedWorkspaceFolders(event: WorkspaceFoldersChangeEvent, context: ExtensionContext) {
  if (event.removed.length) {
    const foldersViews: FolderView[] = getFoldersViews(context).filter(folderView => folderView.name !== event.removed[0].name);
    context.workspaceState.update('folders-views', JSON.stringify(foldersViews));

    if (getWorkspaceFolders().length < 2) {
      updateStatusBarItem();
    } else {
      actualFolderView = foldersViews[0].name;
      loadActualFolderView(context);
    }
  } else {
    if (getWorkspaceFolders().length > 1) {
      saveActualFolderView(context);
      actualFolderView = event.added[0].name;
      updateStatusBarItem();
      loadActualFolderView(context);
    }
  }
}

function updateStatusBarItem() {
  if (getWorkspaceFolders().length > 1) {
    statusBarItem.color = config.get('statusColor');
    statusBarItem.text = `$(file-submodule) ${actualFolderView}`;
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}
