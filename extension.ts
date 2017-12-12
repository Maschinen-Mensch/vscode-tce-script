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
const LANG_MODE: DocumentFilter = { language: 'plaintext', scheme: 'file' };

class TCEDocumentSymbolProvider implements DocumentSymbolProvider, WorkspaceSymbolProvider, DefinitionProvider {

    cached = {};

    TCEDocumentSymbolProvider()
    {
    }
    
    getSymbols(document: TextDocument, uri: Uri) : SymbolInformation[]
    {
        let prefix = ""
        let regex = null
        
        if (uri.path.endsWith("hjson")) {
            regex = new RegExp("\\bid\\s*:\\s*([\\w-]+)")

        } else if (uri.path.endsWith("csv")) {
            regex = new RegExp("\"(.+)\",")
            prefix = "txt-"
        }

        if (regex == null)
            return null;

        let text = document.getText();
        let lines = text.split('\n')
        let symbols = []

        lines.forEach((line, idx) => {
            let match = regex.exec(line)

            if (match != null) {
                symbols.push(new SymbolInformation(
                    prefix + match[1], 
                    SymbolKind.Key, 
                    uri.path,
                    new Location(uri, new Position(idx, match.index))
                ))
            }
        });

        // cached[document.uri.path] = symbols;
        return symbols;
    }

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): SymbolInformation[] {
        return this.getSymbols(document, document.uri);
    }

    public provideWorkspaceSymbols(query: string, token: CancellationToken): Thenable<SymbolInformation[]>
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
    ctx.subscriptions.push(languages.registerDocumentSymbolProvider(LANG_MODE, provider));

    ctx.subscriptions.push(languages.registerWorkspaceSymbolProvider(provider));

    ctx.subscriptions.push(languages.registerDefinitionProvider(TCE_MODE, provider));
    ctx.subscriptions.push(languages.registerDefinitionProvider(LANG_MODE, provider));
}