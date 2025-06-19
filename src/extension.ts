import { ExtensionContext } from 'vscode';
import { ViewsManager } from './views-manager';

let viewsManager: ViewsManager;

export function activate(context: ExtensionContext) {
  viewsManager = new ViewsManager(context);
}

export function deactivate() {
  viewsManager.dispose();
}
