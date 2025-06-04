export interface FolderView {
	name: string;
	path: string;
	tabs: Tab[];
}

export interface Tab {
	label: string;
	path: string;
}