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
    Definition,
    TextEditor,
    TextEditorEdit,
} from 'vscode';

import { copy } from 'copy-paste';
import * as path from 'path';


const TCE_MODE: DocumentFilter = { language: 'tcescript', scheme: 'file' };
const LANG_MODE: DocumentFilter = { language: 'plaintext', scheme: 'file' };

class TCEDocumentSymbolProvider implements DocumentSymbolProvider, WorkspaceSymbolProvider, DefinitionProvider {
    cached = {};

    TCEDocumentSymbolProvider() {
    }
    
    getSymbols(document: TextDocument, uri: Uri) : SymbolInformation[] {
        let prefix = ""
        let regex = null
        
        if (uri.path.endsWith("hjson") || uri.path.endsWith("json")) {
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

    public async provideWorkspaceSymbols(query: string, token: CancellationToken): Promise<SymbolInformation[]> {

        let processSymbolsFromFiles = (files) =>
        {        
            let symbols = []
    
            let parsePromises = files.map(file => {
                return workspace.openTextDocument(file).then((document) => {
                    let newSymbols = this.getSymbols(document, document.uri)
                    symbols = symbols.concat(newSymbols);
                });
            });

            return Promise.all(parsePromises).then(() => {
                 return symbols;
            });
        };

        let hjsonFiles = await workspace.findFiles('**/*.hjson');

        if (hjsonFiles.length == 0)
        {
            hjsonFiles = await workspace.findFiles('**/*.json');
        }

        let symbols = await processSymbolsFromFiles(hjsonFiles);
        return symbols;
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

    vscode.commands.registerTextEditorCommand("tcescript.githubLink", (editor: TextEditor, edit: TextEditorEdit) => {
        let line = editor.selections[0].start.line;
        let file = path.basename(editor.document.uri.fsPath);
        let link = "https://github.com/Maschinen-Mensch/curiousexpedition/blob/fecda4d18b041c4735f0dfdc37ef09f79b81f8fc/conf/"+file+"#L"+line;
        copy(link);
    });
}