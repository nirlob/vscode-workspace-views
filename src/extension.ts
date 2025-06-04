/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ExtensionContext, StatusBarAlignment, StatusBarItem, window, workspace, commands, QuickPickOptions, TabInputText, Uri, WorkspaceFoldersChangeEvent } from 'vscode';
import { FolderView, Tab } from './interfaces';

let actualFolderView: string;
let statusBarItem: StatusBarItem;

export function activate(context: ExtensionContext) {
	actualFolderView = getLastFolderView(context);

	// Create a status bar item
	const status = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
	status.command = 'workspace-views.onClick';
	context.subscriptions.push(status);
	statusBarItem = status;

	// Click extension
	context.subscriptions.push(commands.registerCommand('workspace-views.onClick', () => {
		showSelectFolder(context);
	}));

	// Detect changes in workspace folders
	context.subscriptions.push(workspace.onDidChangeWorkspaceFolders((event) => changedWorkspaceFolders(event, context)));

	updateStatusBarItem();
	loadActualFolderView(context);
}

function showSelectFolder(context: ExtensionContext) {
	const options: QuickPickOptions = {placeHolder: 'Select wowkspace folder'};
	const items: string[] = getWorkspaceFolders().filter(folder => folder !== actualFolderView);

	if(items.length) {
		window.showQuickPick(items, options).then(selectedFolder => {
			if(selectedFolder){
				window.showInformationMessage(selectedFolder);
				saveActualFolderView(context);
				actualFolderView = selectedFolder;
				context.workspaceState.update('last-folder-view', actualFolderView);
				loadActualFolderView(context);
			}
		});
	}
}

function getWorkspaceFolders(): string[] {
	if (!workspace.workspaceFolders || workspace.workspaceFolders.length < 2) {
		return [];
	} else {
		return workspace.workspaceFolders.map(folder => folder.name);
	}
}

function saveActualFolderView(context: ExtensionContext) {
	const foldersViews: FolderView[] = getFoldersViews(context);
	let folderView: FolderView | undefined = foldersViews.find(folderView => folderView.name === actualFolderView);

	if(!folderView) {
		folderView = {name: actualFolderView, tabs: getOpenTabs()};
		foldersViews.push(folderView);
	} else {
		folderView.tabs = getOpenTabs();
	}

	context.workspaceState.update('folders-views', JSON.stringify(foldersViews));
}

function getOpenTabs(): Tab[] {
	return window.tabGroups.all.flatMap(group =>
		group.tabs
			.map(tab => {
				if (tab.input instanceof TabInputText) {
					return { label: tab.label, uri: (tab.input as TabInputText).uri.path } as Tab;
				}
				return undefined;
			})
			.filter((value): value is Tab => value !== undefined)
	);
}

function getLastFolderView(context: ExtensionContext): string {
	const foldersViews: FolderView[] = getFoldersViews(context);

	return context.workspaceState.get('last-folder-view') || 
		(foldersViews.length ? foldersViews[0].name : undefined) ||
		getWorkspaceFolders()[0]; 
}

function getFoldersViews(context: ExtensionContext): FolderView[] {
	return JSON.parse(context.workspaceState.get('folders-views') || '[]');
}

function loadActualFolderView(context: ExtensionContext) {
	const folderView: FolderView = getFoldersViews(context).find(folderView => folderView.name === actualFolderView)!;

	commands.executeCommand('workbench.action.closeAllEditors');

	if (folderView) {
		folderView.tabs.forEach(tab => {
			const uri = Uri.file(tab.uri);
			commands.executeCommand('vscode.open', uri);
		});
	}
}

function changedWorkspaceFolders(event: WorkspaceFoldersChangeEvent, context: ExtensionContext) {
	if(event.removed.length) {
		const foldersViews: FolderView[] = getFoldersViews(context).filter(folderView => folderView.name !== event.removed[0].name);
		context.workspaceState.update('folders-views', JSON.stringify(foldersViews));

		if(getWorkspaceFolders().length < 2) {
			updateStatusBarItem();
		} else {
			actualFolderView = foldersViews[0].name;
			loadActualFolderView(context);
		}
	} else {
		if(getWorkspaceFolders().length > 1) {
			saveActualFolderView(context);
			actualFolderView = event.added[0].name;
			updateStatusBarItem();
			loadActualFolderView(context);
		}
	}
}

function updateStatusBarItem() {
	if (getWorkspaceFolders().length > 1) {
		const multiRootConfigForResource = workspace.getConfiguration('workspaceViews');

		statusBarItem.color = multiRootConfigForResource.get('statusColor') || '#F00';
		statusBarItem.text = `$(file-submodule) ${actualFolderView}`;
		statusBarItem.show();
	} else {
		statusBarItem.hide();
	}
}

