import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Articles de conseils (générés chaque semaine ou à la demande via Telegram, validés par pull request).
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    date: z.coerce.date(),
    // Chemin sous public/ (ex. "images/blog/mon-article.jpg")
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    category: z.enum(['Conseil', 'Actualité']).default('Conseil'),
    draft: z.boolean().default(false),
  }),
});

// Chantiers réalisés (envoyés en photos par Telegram).
const chantiers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/chantiers' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    date: z.coerce.date(),
    city: z.string().optional(),
    services: z.array(z.string()).default([]),
    materials: z.array(z.string()).default([]),
    // Chemins sous public/ ; la première image sert de couverture.
    images: z.array(z.object({ src: z.string(), alt: z.string().default('') })).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, chantiers };
