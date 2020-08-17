import { createServer, ServerPlugin, resolveConfig, ResolvedConfig } from 'vite'
import * as vscode from 'vscode'
import { parse } from '@vue/compiler-sfc'
import * as path from 'path'
import * as fs from 'fs'

const isValid = (filePath: string, text: string) => {
  /*
   * hmr still works event with these error codes
   */
  const notVueErrors = new Set([/* missing end tag */ 24])
  if (filePath.endsWith('.vue')) {
    const parseResult = parse(text)
    if (parseResult.errors.length > 0) {
      if (parseResult.errors.length > 1) {
        console.log('no hmr due to errors')
        return false
      }
      const firstError = parseResult.errors[0]
      // if (!notVueErrors.has(firstError.code)) {
      //   console.log('no hmr due to error')
      //   return false
      // }
    }
    console.log('vue reload')
    return true
  }
  return true
}

const customRead = (originalRead) => async (ctx, filePath) => {
  let document = vscode.workspace.textDocuments.find(
    (document) => document.uri.fsPath === filePath,
  )
  if (document) {
    return document.getText()
  }
  return originalRead(ctx, filePath)
}

const myPlugin: ServerPlugin = (ctx) => {
  let _viteInternalCtx
  ctx.app.middleware.splice(1, 0, async (ctx, next) => {
    console.log('call middleware')
    _viteInternalCtx = ctx
    const originalRead = ctx.read
    ctx.read = customRead(originalRead)
    await next()
  })

  // ctx.app.middleware.unshift(ctx.app.middleware.pop())
  // console.log(typeof ctx.app.middleware)

  // TODO dispose
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.scheme !== 'file') {
      return
    }
    const filePath = event.document.uri.fsPath
    const text = event.document.getText()
    if (isValid(filePath, text)) {
      ctx.watcher.emit('change', filePath)
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
  const nodeModulesPath = path.join(root, 'node_modules')
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(nodeModulesPath)) {
    return
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())

  const options = {
    vite: packageJson.scripts && packageJson.scripts.dev === 'vite',
  }
  if (!options.vite) {
    return
  }
  const outputChannel = vscode.window.createOutputChannel('vite')
  console.log = (...args: any[]) => outputChannel.appendLine(args.toString())
  console.error = (...args: any[]) => outputChannel.appendLine(args.toString())

  const viteConfigPath = root + 'vite.config.js'

  let userConfig: ResolvedConfig = {}
  if (fs.existsSync(viteConfigPath)) {
    userConfig = await resolveConfig('development', root + 'vite.config.js')
  }
  if (Array.isArray(userConfig.configureServer)) {
    userConfig.configureServer.unshift(myPlugin)
  } else if (userConfig.configureServer) {
    userConfig.configureServer = [myPlugin, userConfig.configureServer]
  } else {
    userConfig.configureServer = [myPlugin]
  }
  userConfig.root = root
  try {
    console.log('starting server at ' + root)
    const server = createServer(userConfig).listen(3000, () => {
      console.log('started server')
    })
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
