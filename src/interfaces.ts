export interface FolderView {
	name: string;
	tabs: Tab[];
}

export interface Tab {
	label: string;
	uri: string;
}