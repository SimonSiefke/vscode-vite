import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import dotenv, { DotenvParseOutput } from 'dotenv'
import { Options as RollupPluginVueOptions } from 'rollup-plugin-vue'
import { CompilerOptions, SFCStyleCompileOptions } from '@vue/compiler-sfc'
import Rollup, {
  InputOptions as RollupInputOptions,
  OutputOptions as RollupOutputOptions,
  OutputChunk
} from 'rollup'
import { createEsbuildPlugin } from './build/buildPluginEsbuild'
import { ServerPlugin } from './server'
import { Resolver, supportedExts } from './resolver'
import { Transform, CustomBlockTransform } from './transform'
import { DepOptimizationOptions } from './optimizer'
import { IKoaProxiesOptions } from 'koa-proxies'
import { ServerOptions } from 'https'
import { lookupFile } from './utils'

export { Resolver, Transform }

/**
 * Options shared between server and build.
 */
export interface SharedConfig {
  /**
   * Project root directory. Can be an absolute path, or a path relative from
   * the location of the config file itself.
   * @default process.cwd()
   */
  root?: string
  /**
   * Import alias. The entries can either be exact request -> request mappings
   * (exact, no wildcard syntax), or request path -> fs directory mappings.
   * When using directory mappings, the key **must start and end with a slash**.
   *
   * Example `vite.config.js`:
   * ``` js
   * module.exports = {
   *   alias: {
   *     // alias package names
   *     'react': '@pika/react',
   *     'react-dom': '@pika/react-dom'
   *
   *     // alias a path to a fs directory
   *     // the key must start and end with a slash
   *     '/@foo/': path.resolve(__dirname, 'some-special-dir')
   *   }
   * }
   * ```
   */
  alias?: Record<string, string>
  /**
   * Custom file transforms.
   */
  transforms?: Transform[]
  /**
   * Resolvers to map dev server public path requests to/from file system paths,
   * and optionally map module ids to public path requests.
   */
  resolvers?: Resolver[]
  /**
   * Configure dep optimization behavior.
   *
   * Example `vite.config.js`:
   * ``` js
   * module.exports = {
   *   optimizeDeps: {
   *     exclude: ['dep-a', 'dep-b']
   *   }
   * }
   * ```
   */
  optimizeDeps?: DepOptimizationOptions
  /**
   * Options to pass to `@vue/compiler-dom`
   *
   * https://github.com/vuejs/vue-next/blob/master/packages/compiler-core/src/options.ts
   */
  vueCompilerOptions?: CompilerOptions
  /**
   * Transform functions for Vue custom blocks.
   *
   * Example `vue.config.js`:
   * ``` js
   * module.exports = {
   *   vueCustomBlockTransforms: {
   *     i18n: src => `export default Comp => { ... }`
   *   }
   * }
   * ```
   */
  vueCustomBlockTransforms?: Record<string, CustomBlockTransform>
  /**
   * Configure what to use for jsx factory and fragment.
   * @default 'vue'
   */
  jsx?:
    | 'vue'
    | 'preact'
    | 'react'
    | {
        factory?: string
        fragment?: string
      }
  /**
   * Environment variables
   */
  env?: DotenvParseOutput
  /**
   * Environment mode
   */
  mode?: string
  /**
   * CSS preprocess options
   */
  cssPreprocessOptions?: SFCStyleCompileOptions['preprocessOptions']
}

export interface ServerConfig extends SharedConfig {
  port?: number
  open?: boolean
  /**
   * Configure https.
   */
  https?: boolean
  httpsOption?: ServerOptions
  /**
   * Configure custom proxy rules for the dev server. Uses
   * [`koa-proxies`](https://github.com/vagusX/koa-proxies) which in turn uses
   * [`http-proxy`](https://github.com/http-party/node-http-proxy). Each key can
   * be a path Full options
   * [here](https://github.com/http-party/node-http-proxy#options).
   *
   * Example `vite.config.js`:
   * ``` js
   * module.exports = {
   *   proxy: {
   *     proxy: {
   *       // string shorthand
   *       '/foo': 'http://localhost:4567/foo',
   *       // with options
   *       '/api': {
   *         target: 'http://jsonplaceholder.typicode.com',
   *         changeOrigin: true,
   *         rewrite: path => path.replace(/^\/api/, '')
   *       }
   *     }
   *   }
   * }
   * ```
   */
  proxy?: Record<string, string | IKoaProxiesOptions>
  /**
   * Whether to use a Service Worker to cache served code. This can greatly
   * improve full page reload performance, but requires a Service Worker
   * update + reload on each server restart.
   *
   * @default false
   */
  serviceWorker?: boolean
  configureServer?: ServerPlugin | ServerPlugin[]
}

export interface BuildConfig extends SharedConfig {
  /**
   * Base public path when served in production.
   * @default '/'
   */
  base?: string
  /**
   * Directory relative from `root` where build output will be placed. If the
   * directory exists, it will be removed before the build.
   * @default 'dist'
   */
  outDir?: string
  /**
   * Directory relative from `outDir` where the built js/css/image assets will
   * be placed.
   * @default '_assets'
   */
  assetsDir?: string
  /**
   * Static asset files smaller than this number (in bytes) will be inlined as
   * base64 strings. Default limit is `4096` (4kb). Set to `0` to disable.
   * @default 4096
   */
  assetsInlineLimit?: number
  /**
   * Whether to code-split CSS. When enabled, CSS in async chunks will be
   * inlined as strings in the chunk and inserted via dynamically created
   * style tags when the chunk is loaded.
   * @default true
   */
  cssCodeSplit?: boolean
  /**
   * Whether to generate sourcemap
   * @default false
   */
  sourcemap?: boolean
  /**
   * Set to `false` to dsiable minification, or specify the minifier to use.
   * Available options are 'terser' or 'esbuild'.
   * @default 'terser'
   */
  minify?: boolean | 'terser' | 'esbuild'
  /**
   * Build for server-side rendering
   * @default false
   */
  ssr?: boolean

  // The following are API / config only and not documented in the CLI. --------
  /**
   * Will be passed to rollup.rollup()
   *
   * https://rollupjs.org/guide/en/#big-list-of-options
   */
  rollupInputOptions?: RollupInputOptions
  /**
   * Will be passed to bundle.generate()
   *
   * https://rollupjs.org/guide/en/#big-list-of-options
   */
  rollupOutputOptions?: RollupOutputOptions
  /**
   * Will be passed to rollup-plugin-vue
   *
   * https://github.com/vuejs/rollup-plugin-vue/blob/next/src/index.ts
   */
  rollupPluginVueOptions?: Partial<RollupPluginVueOptions>
  /**
   * Will be passed to @rollup/plugin-node-resolve
   * https://github.com/rollup/plugins/tree/master/packages/node-resolve#dedupe
   */
  rollupDedupe?: string[]
  /**
   * Whether to log asset info to console
   * @default false
   */
  silent?: boolean
  /**
   * Whether to write bundle to disk
   * @default true
   */
  write?: boolean
  /**
   * Whether to emit index.html
   * @default true
   */
  emitIndex?: boolean
  /**
   * Whether to emit assets other than JavaScript
   * @default true
   */
  emitAssets?: boolean
  /**
   * Predicate function that determines whether a link rel=modulepreload shall be
   * added to the index.html for the chunk passed in
   */
  shouldPreload?: (chunk: OutputChunk) => boolean
}

export interface UserConfig extends BuildConfig, ServerConfig {
  plugins?: Plugin[]
}

export interface Plugin
  extends Pick<
    UserConfig,
    | 'alias'
    | 'transforms'
    | 'resolvers'
    | 'configureServer'
    | 'vueCompilerOptions'
    | 'vueCustomBlockTransforms'
    | 'rollupInputOptions'
    | 'rollupOutputOptions'
  > {}

export type ResolvedConfig = UserConfig & {
  /**
   * Path of config file.
   */
  __path?: string
}

const debug = require('debug')('vite:config')

export async function resolveConfig(
  root: string,
  mode: string,
  configPath?: string
): Promise<ResolvedConfig | undefined> {
  const start = Date.now()
  const cwd = root
  let config: ResolvedConfig | undefined
  let resolvedPath: string | undefined
  let isTS = false
  if (configPath) {
    resolvedPath = path.resolve(cwd, configPath)
  } else {
    const jsConfigPath = path.resolve(cwd, 'vite.config.js')
    if (fs.existsSync(jsConfigPath)) {
      resolvedPath = jsConfigPath
    } else {
      const tsConfigPath = path.resolve(cwd, 'vite.config.ts')
      if (fs.existsSync(tsConfigPath)) {
        isTS = true
        resolvedPath = tsConfigPath
      }
    }
  }

  if (!resolvedPath) {
    // load environment variables
    return {
      env: loadEnv(mode, cwd)
    }
  }

  try {
    if (!isTS) {
      try {
        config = require(resolvedPath)
      } catch (e) {
        if (
          !/Cannot use import statement|Unexpected token 'export'/.test(
            e.message
          )
        ) {
          throw e
        }
      }
    }

    if (!config) {
      // 2. if we reach here, the file is ts or using es import syntax.
      // transpile es import syntax to require syntax using rollup.
      const rollup = require('rollup') as typeof Rollup
      const esbuildPlugin = await createEsbuildPlugin(false, {})
      // use node-resolve to support .ts files
      const nodeResolve = require('@rollup/plugin-node-resolve').nodeResolve({
        extensions: supportedExts
      })
      const bundle = await rollup.rollup({
        external: (id: string) =>
          (id[0] !== '.' && !path.isAbsolute(id)) ||
          id.slice(-5, id.length) === '.json',
        input: resolvedPath,
        treeshake: false,
        plugins: [esbuildPlugin, nodeResolve]
      })

      const {
        output: [{ code }]
      } = await bundle.generate({
        exports: 'named',
        format: 'cjs'
      })

      config = await loadConfigFromBundledFile(resolvedPath, code)
    }

    // normalize config root to absolute
    if (config.root && !path.isAbsolute(config.root)) {
      config.root = path.resolve(path.dirname(resolvedPath), config.root)
    }

    // resolve plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        config = resolvePlugin(config, plugin)
      }
    }

    config.env = loadEnv(mode, config.root || cwd)
    debug(`config resolved in ${Date.now() - start}ms`)

    config.__path = resolvedPath
    return config
  } catch (e) {
    console.error(
      chalk.red(`[vite] failed to load config from ${resolvedPath}:`)
    )
    console.error(e)
    process.exit(1)
  }
}

interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any
}

async function loadConfigFromBundledFile(
  fileName: string,
  bundledCode: string
): Promise<UserConfig> {
  const extension = path.extname(fileName)
  const defaultLoader = require.extensions[extension]!
  require.extensions[extension] = (module: NodeModule, filename: string) => {
    if (filename === fileName) {
      ;(module as NodeModuleWithCompile)._compile(bundledCode, filename)
    } else {
      defaultLoader(module, filename)
    }
  }
  delete require.cache[fileName]
  const raw = require(fileName)
  const config = raw.__esModule ? raw.default : raw
  require.extensions[extension] = defaultLoader
  return config
}

export function resolvePlugin(config: UserConfig, plugin: Plugin): UserConfig {
  return {
    ...config,
    alias: {
      ...plugin.alias,
      ...config.alias
    },
    transforms: [...(config.transforms || []), ...(plugin.transforms || [])],
    resolvers: [...(config.resolvers || []), ...(plugin.resolvers || [])],
    configureServer: ([] as any[]).concat(
      config.configureServer || [],
      plugin.configureServer || []
    ),
    vueCompilerOptions: {
      ...config.vueCompilerOptions,
      ...plugin.vueCompilerOptions
    },
    vueCustomBlockTransforms: {
      ...config.vueCustomBlockTransforms,
      ...plugin.vueCustomBlockTransforms
    },
    rollupInputOptions: {
      ...config.rollupInputOptions,
      ...plugin.rollupInputOptions
    },
    rollupOutputOptions: {
      ...config.rollupOutputOptions,
      ...plugin.rollupOutputOptions
    }
  }
}

function loadEnv(mode: string, root: string): Record<string, string> {
  debug(`env mode: ${mode}`)
  const envFiles = [
    /** default file */ `.env`,
    /** local file */ `.env.local`,
    /** mode file */ `.env.${mode}`,
    /** mode local file */ `.env.${mode}.local`
  ]

  const env: Record<string, string> = {}
  for (const file of envFiles) {
    const path = lookupFile(root, [file], true)
    if (path) {
      const result = dotenv.config({
        debug: !!process.env.DEBUG || undefined,
        path
      })
      if (result.error) {
        throw result.error
      }
      Object.assign(env, result.parsed)
    }
  }

  debug(`env: %O`, env)
  return env
}
