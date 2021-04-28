import * as fs from 'fs';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { KlogError, KlogJsonOutput, KlogSettings } from './klog';
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
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const documentSettings: Map<string, Thenable<KlogSettings>> = new Map();
const defaultSettings: KlogSettings = {
    klogPath: '',
    validateOn: 'save'
};
let globalSettings: KlogSettings = defaultSettings;

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
        globalSettings = <KlogSettings>((change.settings.klog || defaultSettings));
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
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
    const tmp = require('tmp')
    const util = require('util')
    const exec = util.promisify(require('child_process').exec)

    // fixme: this is a hack until klog supports piping.
    //        add warning if on windows and <2.2?
    const tempFile = tmp.fileSync();
    fs.writeSync(tempFile.fd, textDocument.getText())
    const { stdout } = await exec(`"${executablePath}" json ${tempFile.name}`)
    tempFile.removeCallback();

    const json: KlogJsonOutput = JSON.parse(stdout)
    const errors = json.errors ?? []

    return errors.map((error: KlogError): Diagnostic => diagnosticFromKlogError(error, textDocument.uri));
}

function diagnosticFromKlogError(error: KlogError, uri: string): Diagnostic {
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
