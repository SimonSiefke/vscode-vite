import { createServer, ServerPlugin } from '../vite'
import * as vscode from 'vscode'
import { parse } from '@vue/compiler-sfc'
import * as path from 'path'
import * as fs from 'fs'

const cache: {
  [filePath: string]: string
} = Object.create(null)

const myPlugin: ServerPlugin = (ctx) => {
  const originalRead = ctx.read
  ctx.read = async (ctx, filePath) => {
    if (filePath in cache) {
      console.log('read from cache')
      return cache[filePath]
    }
    return originalRead(ctx, filePath)
  }
  // TODO dispose
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.scheme !== 'file') {
      return
    }
    console.log(event.document.uri.toString())
    console.log('change')
    const filePath = event.document.uri.fsPath
    const text = event.document.getText()
    cache[filePath] = text
    /*
     * hmr still works event with these error codes
     */
    const notErrors = new Set([/* missing end tag */ 24])
    if (filePath.endsWith('.vue')) {
      console.log('its vue')
      const parseResult = parse(text)
      console.log('parsed vue')
      if (parseResult.errors.length > 0) {
        if (parseResult.errors.length > 1) {
          console.log('no hmr due to errors')
          return
        }
        const firstError = parseResult.errors[0]
        if (!notErrors.has(firstError.code)) {
          console.log('no hmr due to error')
          return
        }
      }
      console.log('vue reload')
      ctx.watcher.handleVueReload(ctx, filePath)
    }
  })
  ctx.app.use(async (ctx, next) => {
    // You can do pre-processing here - this will be the raw incoming requests
    // before vite touches it.
    if (ctx.path.endsWith('.scss')) {
      // Note vue <style lang="xxx"> are supported by
      // default as long as the corresponding pre-processor is installed, so this
      // only applies to <link ref="stylesheet" href="*.scss"> or js imports like
      // `import '*.scss'`.
      console.log('pre processing: ', ctx.url)
      ctx.type = 'css'
      ctx.body = 'body { border: 1px solid red }'
    }

    // ...wait for vite to do built-in transforms
    await next()

    // Post processing before the content is served. Note this includes parts
    // compiled from `*.vue` files, where <template> and <script> are served as
    // `application/javascript` and <style> are served as `text/css`.
    if (ctx.response.is('js')) {
      console.log('post processing: ', ctx.url)
      console.log(ctx.body) // can be string or Readable stream
    }
  })
}

export const activate = async (context: vscode.ExtensionContext) => {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (workspaceFolders.length !== 1) {
    return
  }
  const workspaceFolder = workspaceFolders[0]
  const root = workspaceFolder.uri.fsPath
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())

  const options = {
    vite: packageJson.scripts.dev === 'vite',
  }
  if (!options.vite) {
    return
  }
  const outputChannel = vscode.window.createOutputChannel('vite')
  console.log = (...args: any[]) => outputChannel.appendLine(args.toString())
  console.error = (...args: any[]) => outputChannel.appendLine(args.toString())
  // let userConfig = await resolveConfig(root, 'development')
  const userConfig = {
    configureServer: [myPlugin],
  }
  try {
    const server = createServer(userConfig).listen(3000)
    context.subscriptions.push({
      dispose: () => server.close(),
    })
  } catch (error) {
    console.log('failed to start vite server')
    console.error(error)
    console.error(error.stack)
    vscode.window.showErrorMessage(error)
  }
}
