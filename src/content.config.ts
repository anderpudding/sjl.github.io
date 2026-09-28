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

/** Bilingual (ko/en) writing: the body holds <div lang="ko"> and <div lang="en"> blocks. */
const books = defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/books' }),
    schema: z.object({
        title: z.string(),
        titleEn: z.string(),
        author: z.string(),
        date: z.coerce.date(),
        tags: z.array(z.string()),
    }),
});

const thoughts = defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/thoughts' }),
    schema: z.object({
        date: z.coerce.date(),
    }),
});

export const collections = { projects, books, thoughts };
