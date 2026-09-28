import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/projects' }),
    schema: z.object({
        title: z.string(),
        tagline: z.string(),
        summary: z.string(),
        /** Name shown as `cat <file>` in the shell */
        file: z.string(),
        order: z.number(),
        featured: z.boolean().default(false),
        tags: z.array(z.string()),
        stack: z.array(z.string()),
        skills: z.array(z.string()),
        repo: z.url().optional(),
    }),
});

export const collections = { projects };
