import * as vscode from 'vscode';

/**
 * Returns the LWC component folder for a given URI (file or folder), or null.
 * We consider a folder to be an LWC component folder if its parent is named "lwc"
 * and it is not "__tests__".
 */
async function getLwcComponentFolder(uri: vscode.Uri): Promise<vscode.Uri | null> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    const folder = (stat.type & vscode.FileType.Directory) ? uri : vscode.Uri.file(require('path').dirname(uri.fsPath));

    const folderName = folder.path.split('/').pop();
    const parentPath = folder.with({ path: folder.path.replace(/\/[^/]+$/, '') });
    const parentName = parentPath.path.split('/').pop();

    if (parentName === 'lwc' && folderName && folderName !== '__tests__') {
      return folder;
    }
  } catch {
    // swallow; will return null
  }
  return null;
}

/**
 * Computes the CSS file URI for an LWC component folder.
 */
function cssFileForComponentFolder(folder: vscode.Uri): vscode.Uri {
  const compName = folder.path.split('/').pop()!;
  return vscode.Uri.joinPath(folder, `${compName}.css`);
}

let lastContextValue: boolean | undefined;

async function updateCommandPaletteContext(forUri?: vscode.Uri) {
  let shouldEnable = false;

  const targetUri =
    forUri ??
    vscode.window.activeTextEditor?.document.uri;

  if (targetUri) {
    const lwcFolder = await getLwcComponentFolder(targetUri);
    if (lwcFolder) {
      const cssUri = cssFileForComponentFolder(lwcFolder);
      try {
        await vscode.workspace.fs.stat(cssUri);
        shouldEnable = false; // exists → don't enable
      } catch {
        shouldEnable = true; // not found → can create
      }
    }
  }

  if (shouldEnable !== lastContextValue) {
    lastContextValue = shouldEnable;
    await vscode.commands.executeCommand('setContext', 'lwc-css-helper.canAddCssFromEditor', shouldEnable);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Initial context set
  updateCommandPaletteContext().catch(() => { /* noop */ });

  // Debounced editor-change handler
  let editorChangeTimer: NodeJS.Timeout | undefined;
  const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(() => {
    clearTimeout(editorChangeTimer);
    editorChangeTimer = setTimeout(() => updateCommandPaletteContext().catch(() => {}), 75);
  });

  // Watch for CSS file creation/deletion anywhere under lwc/* to keep context in sync
  const watcher = vscode.workspace.createFileSystemWatcher('**/lwc/*/*.css');
  const onCreate = watcher.onDidCreate(uri => updateCommandPaletteContext(uri).catch(() => {}));
  const onDelete = watcher.onDidDelete(uri => updateCommandPaletteContext(uri).catch(() => {}));
  // onDidChange is not needed for presence checks

  const createCssFile = async (uri?: vscode.Uri) => {
    try {
      // If invoked from Command Palette, use active editor
      if (!uri) {
        const active = vscode.window.activeTextEditor?.document.uri;
        if (!active) {
          return vscode.window.showErrorMessage('No file is currently open in the editor.');
        }
        uri = active;
      }

      const lwcFolder = await getLwcComponentFolder(uri);
      if (!lwcFolder) {
        return vscode.window.showErrorMessage('The selected item is not inside an LWC component folder (lwc/<component>).');
      }

      const cssUri = cssFileForComponentFolder(lwcFolder);

      // If exists, offer to open
      try {
        await vscode.workspace.fs.stat(cssUri);
        const action = await vscode.window.showInformationMessage(
          `CSS file already exists for "${lwcFolder.path.split('/').pop()}". Open it?`,
          'Open',
          'Cancel'
        );
        if (action === 'Open') {
          const doc = await vscode.workspace.openTextDocument(cssUri);
          await vscode.window.showTextDocument(doc, { preview: false });
        }
        return;
      } catch {
        // file does not exist → proceed
      }

      // Create the CSS file
      const initialContent = Buffer.from('/* Add your CSS styles here */\n', 'utf8');
      await vscode.workspace.fs.writeFile(cssUri, initialContent);

      // Update context immediately
      await updateCommandPaletteContext(cssUri);

      // Open in editor
      const doc = await vscode.workspace.openTextDocument(cssUri);
      await vscode.window.showTextDocument(doc, { preview: false });

      vscode.window.showInformationMessage(`CSS file created for "${lwcFolder.path.split('/').pop()}".`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Error creating CSS file: ${message}`);
    }
  };

  const addCssCommand = vscode.commands.registerCommand('lwc-css-helper.addCssFile', createCssFile);
  const addCssFromEditorCommand = vscode.commands.registerCommand('lwc-css-helper.addCssFileFromEditor', createCssFile);

  context.subscriptions.push(
    addCssCommand,
    addCssFromEditorCommand,
    onDidChangeActiveEditor,
    watcher,
    onCreate,
    onDelete
  );
}

export function deactivate() {}
