<script setup lang="ts">
import { onLaunch, onShow, storeToRefs } from 'wevu'
import { useServerStore } from '@/stores/server'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/inbox/index',
    'pages/library/index',
    'pages/settings/index',
    'pages/setup/index',
    'pages/match/index',
  ],
  window: {
    navigationStyle: 'custom',
    backgroundTextStyle: 'dark',
    backgroundColor: '@bgBase',
  },
  tabBar: {
    custom: true,
    color: '@tabColor',
    selectedColor: '@tabSelectedColor',
    backgroundColor: '@tabBg',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'tabbar/home.png',
        selectedIconPath: 'tabbar/home-active.png',
      },
      {
        pagePath: 'pages/inbox/index',
        text: '收件箱',
        iconPath: 'tabbar/inbox.png',
        selectedIconPath: 'tabbar/inbox-active.png',
      },
      {
        pagePath: 'pages/library/index',
        text: '媒体库',
        iconPath: 'tabbar/library.png',
        selectedIconPath: 'tabbar/library-active.png',
      },
      {
        pagePath: 'pages/settings/index',
        text: '设置',
        iconPath: 'tabbar/settings.png',
        selectedIconPath: 'tabbar/settings-active.png',
      },
    ],
  },
  darkmode: true,
  themeLocation: 'theme.json',
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onLaunch(() => {
  const serverStore = useServerStore()
  const { isConfigured } = storeToRefs(serverStore)
  if (!isConfigured.value) {
    wx.redirectTo({ url: '/pages/setup/index' })
  }
})

onShow(() => {
  console.log('[MediaScraper] app show')
})
</script>

<style>
@import './app.css';

page {
  font-family: -apple-system, 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background-color: var(--color-background);
  color: var(--color-foreground);
  --td-brand-color: #7C3AED;
  --td-navbar-bg-color: var(--color-background);
  --td-navbar-title-font-color: var(--color-foreground);
  --td-navbar-left-arrow-color: var(--color-foreground);
  --td-search-bg-color: var(--color-muted);
  --td-search-text-color: var(--color-foreground);
  --td-search-placeholder-color: var(--color-muted-foreground);
  --td-search-icon-color: var(--color-muted-foreground);
}

@media (prefers-color-scheme: dark) {
  page {
    --color-background: #0a0a0a;
    --color-foreground: #fafafa;
    --color-card: #1a1a1a;
    --color-card-foreground: #fafafa;
    --color-primary: #8B5CF6;
    --color-primary-foreground: #ffffff;
    --color-muted: #262626;
    --color-muted-foreground: #a3a3a3;
    --color-border: #262626;
    --color-accent: #2E1065;
    --color-accent-foreground: #A78BFA;
    --color-destructive: #EF4444;
    --color-success: #22C55E;
    --color-warning: #F59E0B;
    --td-brand-color: #8B5CF6;
  }
}
</style>
