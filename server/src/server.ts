import { spawn } from 'child_process'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Settings, KlogSettings, ValidateOnMode, JsonOutput, Error } from './types'
import { Guard } from 'runtypes'
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
  TextDocumentChangeEvent,
} from 'vscode-languageserver/node'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false
let hasDiagnosticRelatedInformationCapability = false

const documentSettingsMap: Map<string, Thenable<KlogSettings>> = new Map()
const defaultSettings: KlogSettings = {
  languageServer: {
    enable: false,
    path: 'klog',
    validateOn: 'save',
  },
}
let globalSettings = KlogSettings.check(defaultSettings)

connection.onInitialize((params: InitializeParams) => {

  const capabilities = params.capabilities

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  )
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  )
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  )

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // // Tell the client that this server supports code completion.
      // completionProvider: {
      //     resolveProvider: false
      // }
    },
  }

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    }
  }
  return result
})

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    await connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      connection.console.log('Workspace folder change event received.')
    })
  }
})

connection.onDidChangeConfiguration(change => {

  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettingsMap.clear()
  } else {
    globalSettings = ((Settings.check(change.settings).klog || defaultSettings))
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument)
})

documents.onDidClose(e => {
  documentSettingsMap.delete(e.document.uri)
})

documents.onDidSave(async (change) => {
  await validateDocumentOnEvent(change, 'save')
})

documents.onDidChangeContent(async (change) => {
  await validateDocumentOnEvent(change, 'edit')
})

async function validateDocumentOnEvent(change: TextDocumentChangeEvent<TextDocument>, type: ValidateOnMode) {

  const settings = await getDocumentSettings(change.document.uri)
  if (settings.languageServer.validateOn !== type) {
    return
  }

  await validateTextDocument(change.document)
}

function getDocumentSettings(resource: string): Thenable<KlogSettings> {

  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings)
  }
  let result = documentSettingsMap.get(resource)
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'klog',
    })
    documentSettingsMap.set(resource, result)
  }
  return result
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {

  const settings = await getDocumentSettings(textDocument.uri)

  if (!settings.languageServer.enable || !settings.languageServer.path.trim()) {
    return
  }

  const klogExecutable = settings.languageServer.path
  const diagnostics = await validateDocumentWithExecutable(klogExecutable, textDocument)

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics })
}

async function validateDocumentWithExecutable(executablePath: string, textDocument: TextDocument): Promise<Diagnostic[]> {

  const child = spawn(`"${executablePath}" json`, { shell: true })
  child.stdin.write(textDocument.getText())
  child.stdin.end()

  const data = await new Promise<string>((resolve) => {
    const B = Guard(Buffer.isBuffer.bind(Buffer))
    let data = ''
    child.stdout.on('data', buffer => data += B.check(buffer).toString())
    child.stdout.on('end', () => resolve(data))
  })
  
  let json: JsonOutput

  try {
    json = JsonOutput.check(JSON.parse(data))
  } catch {
    const ret: Diagnostic[] = [
      {
        severity: DiagnosticSeverity.Error,
        message: 'Could not parse document.',
        source: 'klog',
        range: {
          start: Position.create(0, 0),
          end: Position.create(0, 50),
        },
      },
    ]
    return ret
  }

  const errors = json.errors ?? []
  const diagnostics: Diagnostic[] = errors.map((error: Error): Diagnostic => diagnosticFromKlogError(error, textDocument.uri))

  return diagnostics
}

function diagnosticFromKlogError(error: Error, uri: string): Diagnostic {

  const diagnostic: Diagnostic = {
    severity: DiagnosticSeverity.Error,
    message: error.title,
    source: 'klog',
    range: {
      start: Position.create(error.line - 1, error.column - 1),
      end: Position.create(error.line - 1, error.column - 1 + error.length),
    },
  }

  if (hasDiagnosticRelatedInformationCapability) {
    diagnostic.relatedInformation = [
      {
        location: {
          uri: uri,
          range: Object.assign({}, diagnostic.range),
        },
        message: error.details,
      },
    ]
  }

  return diagnostic
}

documents.listen(connection)
connection.listen()
