import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('lwc-css-helper.addCssFile', async (uri: vscode.Uri) => {
    try {
      if (!uri) {
        vscode.window.showErrorMessage('No folder selected');
        return;
      }

      const folderPath = uri.fsPath;
      const folderName = path.basename(folderPath);
      
      // Check if the CSS file already exists
      const cssFilePath = path.join(folderPath, `${folderName}.css`);
      
      if (fs.existsSync(cssFilePath)) {
        const openFile = await vscode.window.showInformationMessage(
          `CSS file already exists for ${folderName}. Would you like to open it?`,
          'Yes', 'No'
        );
        
        if (openFile === 'Yes') {
          const document = await vscode.workspace.openTextDocument(cssFilePath);
          vscode.window.showTextDocument(document);
        }
        return;
      }
      
      // Create the CSS file
      fs.writeFileSync(cssFilePath, '/* Add your CSS styles here */\n');
      
      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(cssFilePath);
      vscode.window.showTextDocument(document);
      
      vscode.window.showInformationMessage(`CSS file created for ${folderName}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating CSS file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}