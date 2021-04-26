import * as fs from 'fs';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { JsonOutput, KlogSettings } from './klog';
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

const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const defaultSettings: KlogSettings = { klogPath: 'klog' };
let globalSettings: KlogSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<KlogSettings>> = new Map();

function getDocumentSettings(resource: string): Thenable<KlogSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'klog'
        });
        documentSettings.set(resource, result);
    }
    return result;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {

    const settings = await getDocumentSettings(textDocument.uri);
    const klogExecutable = settings.klogPath
    if (!klogExecutable) {
        return;
    }

    if (!fs.existsSync(klogExecutable)) {
        const diagnostics: Diagnostic[] = [
            {
                range: {
                    start: Position.create(0, 0),
                    end: Position.create(0, 99)
                },
                message: `Invalid klog path '${klogExecutable}'`
            }
        ]
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
        return
    }

    const tmp = require('tmp');
    const util = require('util');
    const exec = util.promisify(require('child_process').exec);

    const tempFile = tmp.fileSync();
    fs.writeSync(tempFile.fd, textDocument.getText())

    const { stdout } = await exec(`"${klogExecutable}" json ${tempFile.name}`);
    const json: JsonOutput = JSON.parse(stdout)

    let errors = json.errors
    if (errors === null) {
        errors = []
    }

    const diagnostics: Diagnostic[] = [];
    for (const error of errors) {
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range: {
                start: Position.create(error.line - 1, error.column - 1),
                end: Position.create(error.line - 1, error.column - 1 + error.length)
            },
            message: error.title,
            source: 'klog'
        };

        if (hasDiagnosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: error.details
                },
            ];
        }

        diagnostics.push(diagnostic)
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

    tempFile.removeCallback();
}

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
        documentSettings.clear();
    } else {
        globalSettings = <KlogSettings>(
            (change.settings.klog || defaultSettings)
        );
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

documents.listen(connection);
connection.listen();
