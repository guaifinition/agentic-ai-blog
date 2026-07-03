import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/generated' }),
  schema: z.object({
    title: z.string(),
    navTitle: z.string(),
    section: z.string(),
    sectionOrder: z.number(),
    order: z.number(),
    slug: z.string(),
    sourcePath: z.string(),
    isReadme: z.boolean().default(false),
  }),
})

export const collections = { pages }
