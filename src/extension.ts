import { ExtensionContext } from 'vscode';
import { ViewsManager } from './views-manager';

let viewsManager: ViewsManager;

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extensio "vscode-views" is now active!');
  viewsManager = new ViewsManager(context);
}

export function deactivate() {
  viewsManager.dispose();
}
