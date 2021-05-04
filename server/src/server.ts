import * as fs from 'fs';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as klog from './types';
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
    Position
} from 'vscode-languageserver/node';
import { spawn } from 'child_process';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const documentSettingsMap: Map<string, Thenable<klog.Settings>> = new Map();
const defaultSettings: klog.Settings = {
    klogPath: '',
    validateOn: 'save'
};
let globalSettings: klog.Settings = defaultSettings;

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
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            }
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
        globalSettings = <klog.Settings>((change.settings.klog || defaultSettings));
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

documents.onDidClose(e => {
    documentSettingsMap.delete(e.document.uri);
});

documents.onDidSave(async (change) => {

    const settings = await getDocumentSettings(change.document.uri);
    if (settings.validateOn !== 'save') {
        return;
    }

    validateTextDocument(change.document);
});

documents.onDidChangeContent(async (change) => {

    const settings = await getDocumentSettings(change.document.uri);
    if (settings.validateOn !== 'edit') {
        return;
    }

    validateTextDocument(change.document);
});

documents.listen(connection);
connection.listen();

function getDocumentSettings(resource: string): Thenable<klog.Settings> {
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

    if (!child.stdout) {
        console.log('stdout is <REDACTED>');
        return []
    }
    console.log('stdout is a OK');

    const a = child.stdout.on("data", (b) => {
        console.log(b.toString());
    });
    console.log(a)

    if (!child.stdin) {
        console.log('stdin is <REDACTED>');
        return []
    }
    console.log('stdin is a OK');

    child.stdin.write(textDocument.getText());
    child.stdin.end();





    const json: klog.JsonOutput = JSON.parse("{}")
    const errors = json.errors ?? []

    return errors.map((error: klog.Error): Diagnostic => diagnosticFromKlogError(error, textDocument.uri));
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
