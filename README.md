<h1><img alt="klog icon" src="https://raw.githubusercontent.com/vladdeSV/vscode-klog/main/resource/readme-klog-icon.png"></h1>

Syntax and snippet support for [klog](https://github.com/jotaen/klog) in VS Code.

![klog readme](https://user-images.githubusercontent.com/7542961/161096025-e90f4242-d06a-43b7-857c-5025e57d7e8d.gif)

## Features
- Syntax support
- Snippets
- In-editor validation

## Development
Requires [Bun](https://bun.com/).

```sh
bun install
bun run build      # bundles the client and the language server
bun run typecheck
bun run lint
bun run package    # produces a .vsix
```

Press <kbd>F5</kbd> to launch a VS Code window with the extension loaded.

## License
MIT © [Vladimirs Nordholm](https://github.com/vladdeSV)
