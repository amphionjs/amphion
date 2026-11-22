import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Amphion',
  description: 'A TypeScript-first Node.js framework with the developer experience of Laravel.',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Contributing', link: '/contributing/development' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [{ text: 'Introduction', link: '/guide/introduction' }],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'Development setup', link: '/contributing/development' },
          { text: 'Dependency policy', link: '/contributing/dependency-policy' },
          { text: 'Releasing', link: '/contributing/releasing' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/amphionjs/amphion' }],
    editLink: {
      pattern: 'https://github.com/amphionjs/amphion/edit/master/docs/:path',
    },
    search: { provider: 'local' },
  },
})
