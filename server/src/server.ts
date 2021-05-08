import * as fs from 'fs';
import * as klog from './types';
import { spawn } from 'child_process';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    TextDocumentSyncKind,
    InitializeResult,
    Position,
    TextDocumentChangeEvent
} from 'vscode-languageserver/node';

type ValidateOnMode = 'save' | 'edit'

interface Settings {
    klogPath: string,
    validateOn: ValidateOnMode,
}

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const documentSettingsMap: Map<string, Thenable<Settings>> = new Map();
const defaultSettings: Settings = {
    klogPath: '',
    validateOn: 'save'
};
let globalSettings: Settings = defaultSettings;

connection.onInitialize((params: InitializeParams) => {

    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // // Tell the client that this server supports code completion.
            // completionProvider: {
            //     resolveProvider: false
            // }
        }
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

connection.onDidChangeConfiguration(change => {

    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettingsMap.clear();
    } else {
        globalSettings = <Settings>((change.settings.klog || defaultSettings));
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

documents.onDidClose(e => {
    documentSettingsMap.delete(e.document.uri);
});

documents.onDidSave(async (change) => {

    foo(change, 'save')
});

documents.onDidChangeContent(async (change) => {
    foo(change, 'edit')
});

async function foo(change: TextDocumentChangeEvent<TextDocument>, type: klog.ValidateOnMode) {

    const settings = await getDocumentSettings(change.document.uri);
    if (settings.validateOn !== type) {
        return;
    }

    validateTextDocument(change.document);
}

function getDocumentSettings(resource: string): Thenable<Settings> {

    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettingsMap.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'klog'
        });
        documentSettingsMap.set(resource, result);
    }
    return result;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {

    const settings = await getDocumentSettings(textDocument.uri);
    const klogExecutable = settings.klogPath

    let diagnostics: Diagnostic[];

    const validExecutable = isKlogExecutableValid(klogExecutable)

    if (validExecutable === 'unset') {
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
        return;
    }

    if (validExecutable) {
        diagnostics = await validateDocumentWithExecutable(klogExecutable, textDocument)
    } else {
        // create default error message if klog binary cannot be found.
        diagnostics = [{
            range: { start: Position.create(0, 0), end: Position.create(0, 99) },
            message: `Invalid klog path '${klogExecutable}'`
        }]
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics });
}

function isKlogExecutableValid(executable: string): 'valid' | 'invalid' | 'unset' {

    if (!executable) {
        return 'unset';
    }

    if (!fs.existsSync(executable)) {
        return 'invalid'
    }

    return 'valid'
}

async function validateDocumentWithExecutable(executablePath: string, textDocument: TextDocument): Promise<Diagnostic[]> {

    const child = spawn(`"${executablePath}" json`, { shell: true });
    child.stdin.write(textDocument.getText());
    child.stdin.end();

    const data = await new Promise<string>(async (resolve, reject) => {
        child.stdout.on("data", buffer => resolve(buffer.toString()))
    })

    const json: klog.JsonOutput = JSON.parse(data)
    const errors = json.errors ?? []
    const diagnostics: Diagnostic[] = errors.map((error: klog.Error): Diagnostic => diagnosticFromKlogError(error, textDocument.uri))

    return diagnostics
}

function diagnosticFromKlogError(error: klog.Error, uri: string): Diagnostic {

    const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: error.title,
        source: 'klog',
        range: {
            start: Position.create(error.line - 1, error.column - 1),
            end: Position.create(error.line - 1, error.column - 1 + error.length)
        },
    };

    if (hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
            {
                location: {
                    uri: uri,
                    range: Object.assign({}, diagnostic.range)
                },
                message: error.details
            },
        ];
    }

    return diagnostic
}

documents.listen(connection);
connection.listen();
