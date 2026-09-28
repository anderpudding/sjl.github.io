import { navigate } from 'astro:transitions/client';
import { files, routeFor, readSiteTree, type Route } from '../data/routes';

type Output = string | null;   // HTML; null prints nothing

const COMMANDS = ['help', 'ls', 'cd', 'open', 'pwd', 'whoami', 'clear', 'history', 'echo', 'date', 'neofetch', 'traceroute', 'sudo'] as const;

function escapeHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function currentPath(): string {
    return document.documentElement.dataset.path ?? '~';
}

/** Resolve a shell path (absolute `~/…` or relative, with `..`) against the current directory. */
function resolvePath(arg: string, cwd: string): string {
    const absolute = arg.startsWith('~') || arg.startsWith('/');
    const parts = absolute
        ? arg.replace(/^~/, '').split('/')
        : [...cwd.replace(/^~/, '').split('/'), ...arg.split('/')];
    const stack: string[] = [];
    for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
    }
    return stack.length ? '~/' + stack.join('/') : '~';
}

export function initTerminal(): void {
    const input = document.getElementById('terminal-input') as HTMLInputElement | null;
    const log = document.getElementById('term-log');
    const pathEl = document.getElementById('term-path');
    if (!input || !log || !pathEl) return;

    const history: string[] = [];
    let historyIndex = 0;
    const tree = readSiteTree();
    const byPath = (path: string) => tree.find(r => r.path === path);
    const childrenOf = (dir: Route) => tree.filter(r =>
        r.href !== '/' && (r.parent ?? '/') === dir.href);

    const run: Record<string, (args: string[]) => Output> = {
        help: () => [
            'Available commands:',
            '  ls              list this directory',
            '  cd &lt;dir&gt;        move (try: cd projects, cd .., cd ~/journey)',
            '  open &lt;file&gt;     open resume.pdf / cv.pdf',
            '  pwd  whoami  date  echo  history  neofetch  clear',
            'Tab completes, ↑/↓ walk history.',
        ].join('\n'),

        ls: ([arg = '.']) => {
            const dir = byPath(resolvePath(arg, currentPath()));
            if (!dir) return `<span class="term-err">ls: ${escapeHtml(arg)}: No such file or directory</span>`;
            const entries = childrenOf(dir).map(r => `<a class="term-dir" href="${r.href}">${r.name}/</a>`);
            if (dir.href === '/') {
                entries.push(...files.map(f => `<a class="term-file" href="${f.href}" target="_blank" rel="noopener">${f.name}*</a>`));
            }
            return entries.length ? entries.join('  ') : '<span class="muted">README.md</span>';
        },

        cd: ([arg = '~']) => {
            const dest = byPath(resolvePath(arg, currentPath()));
            if (!dest) return `<span class="term-err">cd: no such directory: ${escapeHtml(arg)}</span>`;
            if (dest.href === routeFor(location.pathname, tree).href) return null;
            navigate(dest.href);
            return null;
        },

        open: ([name = '']) => {
            const file = files.find(f => f.name === name);
            if (!file) return `<span class="term-err">open: ${escapeHtml(name || '(missing file)')}: no such file</span>`;
            window.open(file.href, '_blank', 'noopener');
            return `opening ${file.name}...`;
        },

        pwd: () => currentPath().replace('~', '/home/sungjun'),
        whoami: () => 'guest — but the owner is <strong>Sungjun Lee</strong>, CS + Math @ UBC.',
        date: () => new Date().toString(),
        echo: args => escapeHtml(args.join(' ')),
        history: () => history.map((h, i) => `${String(i + 1).padStart(4)}  ${escapeHtml(h)}`).join('\n'),
        clear: () => { log.innerHTML = ''; return null; },

        neofetch: () => [
            '<strong>sungjun</strong>@<strong>ubc</strong>',
            '-------------',
            'OS:      CMCM 4th year',
            'Host:    University of British Columbia',
            'Route:   Seoul → Tokyo → Vancouver',
            'Theme:   Tokyo Night',
        ].join('\n'),

        traceroute: () => {
            if (routeFor(location.pathname).href !== '/journey') navigate('/journey');
            return 'traceroute to ubc.ca (Vancouver), 4 hops max';
        },

        sudo: () => '<span class="term-err">guest is not in the sudoers file. This incident will be reported.</span>',
    };

    function print(command: string, output: Output) {
        const promptHtml = `<div class="prompt-line"><span class="p-user">guest</span><span class="p-at">@</span><span class="p-host">ubc</span><span class="p-path">${currentPath()}</span><span class="p-symbol">→</span><span class="cmd-inline">${escapeHtml(command)}</span></div>`;
        log!.insertAdjacentHTML('beforeend', promptHtml + (output ? `<div class="term-out">${output}</div>` : ''));
    }

    function execute(raw: string) {
        const line = raw.trim();
        if (!line) return;
        history.push(line);
        historyIndex = history.length;

        const [cmd, ...args] = line.split(/\s+/);
        const handler = run[cmd.toLowerCase()];
        if (cmd.toLowerCase() === 'clear') { handler(args); return; }
        print(line, handler ? handler(args) : `<span class="term-err">command not found: ${escapeHtml(cmd)}</span>`);
        input!.scrollIntoView({ block: 'nearest' });
    }

    function complete() {
        const value = input!.value;
        const parts = value.split(/\s+/);
        const word = parts[parts.length - 1];
        // Complete the last path segment against the directory named by everything before it.
        const slash = word.lastIndexOf('/');
        const prefix = slash >= 0 ? word.slice(0, slash + 1) : '';
        const stem = word.slice(slash + 1);
        let candidates: string[];
        if (parts.length <= 1) {
            candidates = [...COMMANDS];
        } else if (parts[0] === 'open') {
            candidates = files.map(f => f.name);
        } else {
            const dir = byPath(resolvePath(prefix || '.', currentPath()));
            candidates = dir ? childrenOf(dir).map(r => r.name + '/') : [];
            if (!prefix) candidates.push('../', '~/');
        }
        const matches = candidates.filter(c => c.startsWith(stem));
        if (matches.length === 1) {
            parts[parts.length - 1] = prefix + matches[0];
            input!.value = parts.join(' ') + (parts.length === 1 ? ' ' : '');
        } else if (matches.length > 1) {
            print(value, matches.join('  '));
        }
    }

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            execute(input.value);
            input.value = '';
        } else if (e.key === 'Tab') {
            e.preventDefault();
            complete();
        } else if (e.key === 'ArrowUp' && historyIndex > 0) {
            e.preventDefault();
            input.value = history[--historyIndex];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            historyIndex = Math.min(history.length, historyIndex + 1);
            input.value = history[historyIndex] ?? '';
        }
    });

    // "/" focuses the shell from anywhere, like a search shortcut.
    document.addEventListener('keydown', e => {
        const t = e.target as HTMLElement;
        if (e.key !== '/' || t.closest('input, textarea, [contenteditable]')) return;
        e.preventDefault();
        input.focus({ preventScroll: false });
    });

    document.addEventListener('astro:page-load', () => {
        pathEl.textContent = currentPath();
    });
}
