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

    TCEDocumentSymbolProvider() {
    }
    
    getSymbols(document: TextDocument, uri: Uri) : SymbolInformation[] {
        let prefix = ""
        let regex = null
        
        if (uri.path.endsWith("hjson") || uri.path.endsWith("hjson.txt")) {
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

        return symbols;
    }

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): SymbolInformation[] {
        return this.getSymbols(document, document.uri);
    }

    public async getAllWorkspaceSymbols(): Promise<SymbolInformation[]> {

        let hjsonFiles = await workspace.findFiles('**/*.hjson');
        hjsonFiles = hjsonFiles.concat(await workspace.findFiles('**/*.hjson.txt'));

        let csvFiles = await workspace.findFiles('**/*.csv');

        let allFiles = hjsonFiles.concat(csvFiles);

        let symbols = []
        for (let file of allFiles) {
            let document = await workspace.openTextDocument(file);
            let newSymbols = this.getSymbols(document, document.uri)
            symbols = symbols.concat(newSymbols);
        }

        return symbols;
    }

    public async provideWorkspaceSymbols(query: string, token: CancellationToken): Promise<SymbolInformation[]> {
        return this.getAllWorkspaceSymbols();
    }

    cachedSymbols = {};

    async cacheWorkspaceSymbols()
    {
        let symbols = await this.getAllWorkspaceSymbols();
        this.cachedSymbols = {};
        for (let symbol of symbols)
        {
            this.cachedSymbols[symbol.name] = symbol;
        }
    }

    getPositionForSymbol(document: TextDocument, symbolID : string) : Position {
        let prefix = ""
        let regex = null
        let uri = document.uri;
        
        if (uri.path.endsWith("hjson") || uri.path.endsWith("hjson.txt")) {
            regex = new RegExp("\\bid\\s*:\\s*([\\w-]+)")

        } else if (uri.path.endsWith("csv")) {
            regex = new RegExp("\"(.+)\",")
            prefix = "txt-"
        }

        if (regex == null)
            return null;

        let text = document.getText();
        let lines = text.split('\n')

        let idx = 0;
        for (const line of lines)
        {
            let match = regex.exec(line)

            if (match != null) {
                let thisID = prefix + match[1]
                if (thisID == symbolID)
                {
                    return new Position(idx, match.index);
                }
            }
            idx++;
        }

        return null;
    }

    public async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition> {
        let regex = new RegExp("\\s*([\\w-]+)")
        let query : string = document.getText(document.getWordRangeAtPosition(position, regex)).trim();

        let cachedResult : SymbolInformation = this.cachedSymbols[query];
        if (cachedResult != null)
        {
            // check if the cached result it still valid            
            let document = await workspace.openTextDocument(cachedResult.containerName);
            let currPosition = this.getPositionForSymbol(document, query);
            if (currPosition != null && currPosition.line != cachedResult.location.range.start.line)
            {
                // no longer valid - but as its still in this file, just update the cached symbol
                cachedResult = new SymbolInformation(
                    query,
                    SymbolKind.Key, 
                    document.uri.path,
                    new Location(document.uri, currPosition));
                this.cachedSymbols[query] = cachedResult;                
            }
            else if (currPosition == null)
            {
                // it's not: just re-cache everything
                cachedResult = null;
            }
        }

        if (cachedResult == null)
        {
            await this.cacheWorkspaceSymbols();
            cachedResult = this.cachedSymbols[query];
        }

        if (cachedResult != null)
        {
            return cachedResult.location;   
        }
        else
        {
            return null;
        }
    }
}

export function activate(ctx: ExtensionContext) {
    console.log('Activated TCE Script Extension');

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