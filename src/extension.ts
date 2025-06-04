/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { basename } from 'path';
import { ExtensionContext, StatusBarAlignment, StatusBarItem, window, workspace, commands, QuickPickOptions, TabInputText } from 'vscode';
import { FolderView, Tab } from './folder-view';

export function activate(context: ExtensionContext) {
	let actualFolderView = getLastFolderView(context);
	console.log('actualFolderView', actualFolderView);

	// commands.getCommands().then(value => console.log(value));
	commands.executeCommand('workbench.action.closeAllEditors');

	// Create a status bar item
	const status = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
	status.command = 'basic-multi-root-sample.showInfo';
	context.subscriptions.push(status);

	// Click extension
	context.subscriptions.push(commands.registerCommand('basic-multi-root-sample.showInfo', () => {
		const options: QuickPickOptions = {placeHolder: 'Select option'};
		const items: string[] = getWorkspaceFolders().filter(folder => folder !== actualFolderView);

		if(items.length) {
			window.showQuickPick(items, options).then(selection => {
				if(selection){
					window.showInformationMessage(selection);
					saveActualFolderView(context, actualFolderView);
					actualFolderView = selection;
					context.workspaceState.update('actualView', actualFolderView);
				}
			});
		}
	}));

	// Update status bar item based on events for multi root folder changes
	context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => updateStatus(status)));

	// Update status bar item based on events for configuration
	context.subscriptions.push(workspace.onDidChangeConfiguration(() => updateStatus(status)));

	// Update status bar item based on events around the active editor
	context.subscriptions.push(window.onDidChangeActiveTextEditor(() => updateStatus(status)));
	context.subscriptions.push(window.onDidChangeTextEditorViewColumn(() => updateStatus(status)));
	context.subscriptions.push(workspace.onDidOpenTextDocument(() => updateStatus(status)));
	context.subscriptions.push(workspace.onDidCloseTextDocument(() => updateStatus(status)));

	updateStatus(status);
	loadFolderView(context, actualFolderView);
}

function getWorkspaceFolders(): string[] {
	if (!workspace.workspaceFolders || workspace.workspaceFolders.length < 2) {
		return [];
	} else {
		return workspace.workspaceFolders.map(folder => folder.name);
	}
}

function updateStatus(status: StatusBarItem): void {
	const info = getEditorInfo();
	status.text = info ? info.text || '' : '';
	status.tooltip = info ? info.tooltip : undefined;
	status.color = info ? info.color : undefined;

	if (info) {
		status.show();
	} else {
		status.hide();
	}
}

function getEditorInfo(): { text?: string; tooltip?: string; color?: string; } | null {
	const editor = window.activeTextEditor;

	// If no workspace is opened or just a single folder, we return without any status label
	// because our extension only works when more than one folder is opened in a workspace.
	if (!editor || !workspace.workspaceFolders || workspace.workspaceFolders.length < 2) {
		return null;
	}

	let text: string | undefined;
	let tooltip: string | undefined;
	let color: string | undefined;

	// If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
	// the status accordingly.
	const resource = editor.document.uri;
	if (resource.scheme === 'file') {
		const folder = workspace.getWorkspaceFolder(resource);
		if (!folder) {
			text = `$(alert) <outside workspace> → ${basename(resource.fsPath)}`;
		} else {
			text = `$(file-submodule) ${basename(folder.uri.fsPath)} (${folder.index + 1} of ${workspace.workspaceFolders.length}) → $(file-code) ${basename(resource.fsPath)}`;
			tooltip = resource.fsPath;

			const multiRootConfigForResource = workspace.getConfiguration('multiRootSample', resource);
			color = multiRootConfigForResource.get('statusColor');
		}
	}

	return { text, tooltip, color };
}

function saveActualFolderView(context: ExtensionContext, actualFolderView: string) {
	const foldersViews: FolderView[] = JSON.parse(context.workspaceState.get('views') || '[]');
	let folderView: FolderView | undefined = foldersViews.find(folderView => folderView.name === actualFolderView);

	if(!folderView) {
		folderView = {name: actualFolderView, tabs: getOpenTabs()};
		foldersViews.push(folderView);
	} else {
		folderView.tabs = getOpenTabs();
	}

	context.workspaceState.update('views', JSON.stringify(foldersViews));

	console.log('keys', context.workspaceState.keys());
	console.log('views', context.workspaceState.get('views'));
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
	const foldersViews: FolderView[] = JSON.parse(context.workspaceState.get('views') || '[]');

	return context.workspaceState.get('actualView') || 
		(foldersViews.length ? foldersViews[0].name : undefined) ||
		getWorkspaceFolders()[0]; 
}

async function loadFolderView(context: ExtensionContext, actualFolderView: string) {
	const foldersViews: FolderView[] = JSON.parse(context.workspaceState.get('views') || '[]');
	// const folderView: FolderView = foldersViews.find(folderView => folderView.name === actualFolderView);

	const filteredTextDocuments = window.visibleNotebookEditors;
	//const filteredTextDocuments = workspace.textDocuments.filter(td => td.fileName === 'scratchFileName');
	console.log('filteredTextDocuments', filteredTextDocuments);
	for (const td of filteredTextDocuments) {
		console.log('td =', td)
  //  	await window.showTextDocument(td, { preview: true, preserveFocus: false });
    //	await commands.executeCommand('workbench.action.closeActiveEditor');
//    	await workspace.fs.delete(td.uri);
	}
}

