import type { CollectionEntry } from 'astro:content'

export type PageEntry = CollectionEntry<'pages'>

export function sortPages(a: PageEntry, b: PageEntry) {
  return a.data.sectionOrder - b.data.sectionOrder || a.data.order - b.data.order || a.data.navTitle.localeCompare(b.data.navTitle, 'zh-CN')
}

export function groupPages(pages: PageEntry[]) {
  const groups = new Map<string, PageEntry[]>()
  for (const page of [...pages].sort(sortPages)) {
    const list = groups.get(page.data.section) ?? []
    list.push(page)
    groups.set(page.data.section, list)
  }
  return Array.from(groups, ([section, items]) => ({ section, items }))
}
