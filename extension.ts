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
    ProviderResult,
    DefinitionProvider,
    Definition
} from 'vscode';

const TCE_MODE: DocumentFilter = { language: 'tcescript', scheme: 'file' };

class TCEDocumentSymbolProvider implements DocumentSymbolProvider, WorkspaceSymbolProvider, DefinitionProvider {

    cached = {};

    TCEDocumentSymbolProvider()
    {
    }
    
    getSymbols(document: TextDocument, uri: Uri)
    {
        // if (cached[document.uri.path] != null)
        // {
        //     return cached[document.uri.path];
        // }

        let text = document.getText();
        let regex = new RegExp("\\bid\\s*:\\s*([\\w-]+)")

        let lines = text.split('\n')
        let symbols = []

        lines.forEach((line, idx) => {
            let match = regex.exec(line)

            if (match != null) {
                symbols.push(new SymbolInformation(
                    match[1], 
                    SymbolKind.Key, 
                    uri.path,
                    new Location(uri, new Position(idx, match.index))
                ))
            }
        });

        // cached[document.uri.path] = symbols;
        return symbols;
    }

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): Thenable<SymbolInformation[]> {
        let text = document.getText();
        return this.getSymbols(document, document.uri);
    }

    public provideWorkspaceSymbols(query: string, token: CancellationToken): ProviderResult<SymbolInformation[]>
    {
        let symbols = []

        return workspace.findFiles('**/*.hjson').then(files => Promise.all(files.map(file => {
            let st = workspace.openTextDocument(file)
            return st.then((document) => {
                let newSymbols = this.getSymbols(document, document.uri)
                symbols = symbols.concat(newSymbols);
            });
        }))).then(() => symbols);
    }

    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition> {
        let regex = new RegExp("\\s*([\\w-]+)")
        let query : string = document.getText(document.getWordRangeAtPosition(position, regex)).trim();
       
        return this.provideWorkspaceSymbols(query, token).then(symbols => {
            for (let symbol of symbols) {
                if (symbol.name == query) {
                    return symbol.location;
                }
            }
        });
    }
}

export function activate(ctx: ExtensionContext) {
    console.log('Acvitated TCE Script Extension');

    let provider = new TCEDocumentSymbolProvider()
    ctx.subscriptions.push(languages.registerDocumentSymbolProvider(TCE_MODE, provider));
    ctx.subscriptions.push(languages.registerWorkspaceSymbolProvider(provider));
    ctx.subscriptions.push(languages.registerDefinitionProvider(TCE_MODE, provider));
}