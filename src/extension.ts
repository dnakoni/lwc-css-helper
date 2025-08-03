import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to get LWC folder from a file path
function getLwcFolderFromFile(filePath: string): string | null {
  const dir = path.dirname(filePath);
  // Check if this directory is an LWC component folder
  if (/.*force-app.*lwc\/[^\/]+$/.test(dir) && !dir.includes('__tests__')) {
    return dir;
  }
  return null;
}

// Function to update command palette availability based on active editor
function updateCommandPaletteContext() {
  const activeEditor = vscode.window.activeTextEditor;
  let shouldEnableCommand = false;
  
  if (activeEditor) {
    const filePath = activeEditor.document.uri.fsPath;
    const lwcFolder = getLwcFolderFromFile(filePath);
    
    if (lwcFolder) {
      const folderName = path.basename(lwcFolder);
      const cssFilePath = path.join(lwcFolder, `${folderName}.css`);
      shouldEnableCommand = !fs.existsSync(cssFilePath);
    }
  }
  
  vscode.commands.executeCommand('setContext', 'lwc-css-helper.canAddCssFromEditor', shouldEnableCommand);
}

export function activate(context: vscode.ExtensionContext) {
  // Initialize command palette context
  updateCommandPaletteContext();
  
  // Update context when active editor changes
  let onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(() => {
    updateCommandPaletteContext();
  });
  
  // Update context when files are saved (in case new CSS files are created outside the extension)
  let onDidSaveDocument = vscode.workspace.onDidSaveTextDocument(() => {
    updateCommandPaletteContext();
  });
  
  // Shared function for CSS file creation logic
  const createCssFile = async (uri: vscode.Uri | undefined) => {
    try {
      if (!uri) {
        // Command palette usage - get URI from active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          vscode.window.showErrorMessage('No file is currently open in the editor');
          return;
        }
        
        const lwcFolder = getLwcFolderFromFile(activeEditor.document.uri.fsPath);
        if (!lwcFolder) {
          vscode.window.showErrorMessage('The currently open file is not part of an LWC component');
          return;
        }
        
        uri = vscode.Uri.file(lwcFolder);
      }

      let folderPath: string;
      let folderName: string;
      
      // Check if the URI is a file or folder
      const stat = fs.statSync(uri.fsPath);
      
      if (stat.isFile()) {
        // If it's a file, get the LWC folder containing it
        const lwcFolder = getLwcFolderFromFile(uri.fsPath);
        if (!lwcFolder) {
          vscode.window.showErrorMessage('Selected file is not in an LWC component folder');
          return;
        }
        folderPath = lwcFolder;
        folderName = path.basename(lwcFolder);
      } else {
        // If it's a folder, use it directly
        folderPath = uri.fsPath;
        folderName = path.basename(folderPath);
      }
      
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
      
      // Update command palette context immediately after creating CSS
      updateCommandPaletteContext();
      
      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(cssFilePath);
      vscode.window.showTextDocument(document);
      
      vscode.window.showInformationMessage(`CSS file created for ${folderName}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating CSS file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Register the command for adding CSS file (context menu)
  let addCssCommand = vscode.commands.registerCommand('lwc-css-helper.addCssFile', createCssFile);
  
  // Register the command for adding CSS file from editor (command palette)
  let addCssFromEditorCommand = vscode.commands.registerCommand('lwc-css-helper.addCssFileFromEditor', createCssFile);

  context.subscriptions.push(addCssCommand, addCssFromEditorCommand, onDidChangeActiveEditor, onDidSaveDocument);
}

export function deactivate() {}