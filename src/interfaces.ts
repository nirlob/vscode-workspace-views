import { Uri } from "vscode";

export interface FolderView {
	name: string;
	uri: Uri;
	tabs?: Tab[];
}

export interface Tab {
	label: string;
	uri: Uri;
	active: boolean;
}