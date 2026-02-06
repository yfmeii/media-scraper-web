import { resolve } from 'node:path'
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      resolvers: [TDesignResolver()],
      htmlCustomData: true,
      typedComponents: true,
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
    json: {
      defaults: {
        component: {
          styleIsolation: 'apply-shared',
        },
      },
    },
    wevu: {
      defaults: {
        component: {
          options: {
            virtualHost: true,
            styleIsolation: 'apply-shared',
          },
        },
      },
    },
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'css',
      },
      dirs: {
        component: 'src/components',
        page: 'src/pages',
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/utils/*.wxs', dest: 'utils' },
        { src: 'src/components/MsImage/tool.wxs', dest: 'components/MsImage' },
      ],
    }),
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
      cssEntries: [
        resolve(import.meta.dirname, 'src/app.css'),
      ],
    }) as any,
  ],
})
