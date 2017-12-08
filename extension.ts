'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode = require('vscode');

import {
    window, 
    workspace, 
    commands, 
    Disposable, 
    ExtensionContext, 
    StatusBarAlignment, 
    StatusBarItem, 
    TextDocument, 
    DocumentFilter, 
    DocumentSymbolProvider,
    WorkspaceSymbolProvider,
    CancellationToken,
    SymbolInformation,
    languages,
    SymbolKind,
    Location,
    Uri,
    Position,
    ProviderResult
} from 'vscode';

const TCE_MODE: DocumentFilter = { language: 'tcescript', scheme: 'file' };

class TCEDocumentSymbolProvider implements DocumentSymbolProvider, WorkspaceSymbolProvider {

    getSymbols(text: string, uri: Uri)
    {
        let regex = new RegExp("\\bid\\s*:\\s*([\\w-]+)")

        let lines = text.split('\n')
        let symbols = []

        lines.forEach((line, idx) => {
            let match = regex.exec(line)

            if (match != null) {
                symbols.push(new SymbolInformation(
                    match[1], 
                    SymbolKind.Key, 
                    uri,
                    new Location(uri, new Position(idx, match.index))
                ))
            }
        });

        return symbols;
    }

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
        let text = document.getText();
        return this.getSymbols(text, document.uri);
    }

    public provideWorkspaceSymbols(query: string, token: CancellationToken): ProviderResult<SymbolInformation[]>
    {
        let symbols = []

        return workspace.findFiles('**/*.hjson').then(files => Promise.all(files.map(file => {
            let st = workspace.openTextDocument(file)
            return st.then((document) => {
                let text = document.getText();
                let newSymbols = this.getSymbols(text, document.uri)

                symbols = symbols.concat(newSymbols);
            });
        }))).then(() => symbols);
    }
}

// this method is called when your extension is activated. activation is
// controlled by the activation events defined in package.json
export function activate(ctx: ExtensionContext) {
    console.log('Acvitated TCE Script Extension');
    
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated

    // create a new word counter
    // add to a list of disposables which are disposed when this extension
    // is deactivated again.

    let provider = new TCEDocumentSymbolProvider()
    ctx.subscriptions.push(languages.registerDocumentSymbolProvider(TCE_MODE, provider));
    ctx.subscriptions.push(languages.registerWorkspaceSymbolProvider(provider));
}