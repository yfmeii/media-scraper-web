**结论**
- 仅升级到 Svelte 5 并不强制改代码：Svelte 5 仍然支持 Svelte 4 的旧语法，而且新旧语法可以混用。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))

**如果你要迁移到 runes 模式，这些地方需要改**
1. **`$:` 反应式语句**  
`client/web/src/routes/+layout.svelte`、`client/web/src/lib/components/TMDBSearchModal.svelte` 用了 `$:`，在 runes 模式需要改成 `$derived` 或 `$effect`。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))

2. **`export let` 组件 props**  
当前组件大量使用 `export let`（`client/web/src/lib/components/*.svelte` 以及页面内自定义组件 props）。在 runes 模式应改为 `$props()` 解构。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))

3. **`bind:` 到组件 props / 在子组件里改 props**  
`TMDBSearchModal`、`PreviewModal`、`DisambiguationModal` 里有 `show = false` / `bind:show` / `bind:value` 这类“子组件改 props”的写法。runes 模式下 props 默认不可绑定，需要显式用 `$bindable()` 标记，或改成回调 props 让父级更新。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))

4. **`createEventDispatcher`**  
以下组件使用了 `createEventDispatcher`：  
`client/web/src/lib/components/DetailDrawer.svelte`  
`client/web/src/lib/components/MediaCard.svelte`  
`client/web/src/lib/components/ConfirmDialog.svelte`  
`client/web/src/lib/components/PreviewModal.svelte`  
`client/web/src/lib/components/DisambiguationModal.svelte`  
`client/web/src/lib/components/TMDBSearchModal.svelte`  
在 Svelte 5 中该方式已被弃用，推荐改成“回调 props”。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))

5. **`<slot>` / `<svelte:fragment slot="...">`**  
`client/web/src/routes/+layout.svelte`、`client/web/src/lib/components/DetailDrawer.svelte`、`client/web/src/lib/components/BatchActionBar.svelte` 以及 `routes/movies/+page.svelte`、`routes/tv/+page.svelte` 里的 `<svelte:fragment slot="actions">` 都属于 slots 体系。Svelte 5 中 slots 被 snippets / `{@render}` 取代（仍兼容，但已弃用）。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))

6. **`on:` 与事件修饰符**  
`on:` 语法仍兼容，但如果你迁移到新事件属性（`onclick` 等），原来的修饰符（`|stopPropagation`、`|self`）不能直接用，需要改为手写或包装函数。你在 `routes/movies/+page.svelte`、`routes/tv/+page.svelte`、`routes/inbox/+page.svelte` 和多个 modal 里都有这些修饰符。([svelte.dev](https://svelte.dev/docs/svelte/v5-migration-guide))
