/**
 * Every "directory" of the site. The terminal (`cd`, `ls`, tab completion)
 * and the 3D world (one node per entry) are both driven from this list.
 */
export interface Route {
    /** URL path, e.g. "/projects" */
    href: string;
    /** Shell path shown in prompts, e.g. "~/projects" */
    path: string;
    /** Name used by `cd` and shown on the node label */
    name: string;
    title: string;
    blurb: string;
    /** href of the parent directory, for nested routes like /projects/<slug> */
    parent?: string;
}

/** A nested page (a project, a book review…) shared with client scripts via #site-tree. */
export interface SiteEntry {
    /** href of the directory it lives in, e.g. "/projects" */
    parent: string;
    slug: string;
    title: string;
    summary: string;
}

export const routes: Route[] = [
    { href: '/',           path: '~',            name: '~',          title: 'Sungjun Lee',              blurb: 'home' },
    { href: '/about',      path: '~/about',      name: 'about',      title: 'About Me',                 blurb: 'who I am' },
    { href: '/journey',    path: '~/journey',    name: 'journey',    title: 'Journey',                  blurb: 'Seoul → Tokyo → Vancouver' },
    { href: '/projects',   path: '~/projects',   name: 'projects',   title: 'Projects',                 blurb: 'things I built' },
    { href: '/courses',    path: '~/courses',    name: 'courses',    title: 'UBC Courses',              blurb: 'CS + Math @ UBC' },
    { href: '/math',       path: '~/math',       name: 'math',       title: 'Math',                     blurb: 'ℂ/Λ ≅ E(ℂ)' },
    { href: '/learning',   path: '~/learning',   name: 'learning',   title: 'Learning Strategy',        blurb: 'how I study' },
    { href: '/books',      path: '~/books',      name: 'books',      title: 'Book Reviews',             blurb: 'what I read' },
    { href: '/thoughts',   path: '~/thoughts',   name: 'thoughts',   title: 'Thought Dumps',            blurb: 'notes to self' },
    { href: '/bucketlist', path: '~/bucketlist', name: 'bucketlist', title: 'Bucket List',              blurb: 'someday' },
    { href: '/lol',        path: '~/lol',        name: 'lol',        title: 'League of Legends Stats',  blurb: 'live from Riot API' },
    { href: '/contact',    path: '~/contact',    name: 'contact',    title: 'Contact',                  blurb: 'say hi' },
];

export const files = [
    { name: 'resume.pdf', href: '/pdf/resume.pdf' },
    { name: 'cv.pdf',     href: '/pdf/cv.pdf' },
];

/** Top-level routes plus one nested route per entry (projects, books…). */
export function allRoutes(entries: SiteEntry[]): Route[] {
    return [
        ...routes,
        ...entries.map(e => ({
            href: `${e.parent}/${e.slug}`,
            path: `~${e.parent}/${e.slug}`,
            name: e.slug,
            title: e.title,
            blurb: e.summary,
            parent: e.parent,
        })),
    ];
}

export function routeFor(pathname: string, list: Route[] = routes): Route {
    const clean = pathname.replace(/\/+$/, '') || '/';
    return list.find(r => r.href === clean)
        ?? list.find(r => r.href !== '/' && clean.startsWith(r.href + '/'))
        ?? list[0];
}

/** Client side: read the project list the layout embeds in every page. */
export function readSiteTree(): Route[] {
    const el = document.getElementById('site-tree');
    try {
        return allRoutes(el ? JSON.parse(el.textContent ?? '[]') : []);
    } catch {
        return routes;
    }
}
