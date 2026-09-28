import { navigate } from 'astro:transitions/client';
import { routes, files, routeFor } from '../data/routes';

type Output = string | null;   // HTML; null prints nothing

const COMMANDS = ['help', 'ls', 'cd', 'open', 'pwd', 'whoami', 'clear', 'history', 'echo', 'date', 'neofetch', 'sudo'] as const;
const dirs = routes.filter(r => r.href !== '/');

function escapeHtml(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function currentPath(): string {
    return document.documentElement.dataset.path ?? '~';
}

function resolveDir(arg: string) {
    const target = arg.replace(/^~\/?/, '').replace(/\/+$/, '');
    if (arg === '' || arg === '~' || arg === '/' || target === '' || arg === '..') return routes[0];
    return dirs.find(r => r.name === target);
}

export function initTerminal(): void {
    const input = document.getElementById('terminal-input') as HTMLInputElement | null;
    const log = document.getElementById('term-log');
    const pathEl = document.getElementById('term-path');
    if (!input || !log || !pathEl) return;

    const history: string[] = [];
    let historyIndex = 0;

    const run: Record<string, (args: string[]) => Output> = {
        help: () => [
            'Available commands:',
            '  ls              list directories',
            '  cd &lt;dir&gt;        move (try: cd projects, cd .., cd ~)',
            '  open &lt;file&gt;     open resume.pdf / cv.pdf',
            '  pwd  whoami  date  echo  history  neofetch  clear',
            'Tab completes, ↑/↓ walk history.',
        ].join('\n'),

        ls: () => {
            if (currentPath() !== '~') return `<span class="muted">README.md</span>   <span class="muted">(cd .. to go back)</span>`;
            return [
                ...dirs.map(r => `<a class="term-dir" href="${r.href}">${r.name}/</a>`),
                ...files.map(f => `<a class="term-file" href="${f.href}" target="_blank" rel="noopener">${f.name}*</a>`),
            ].join('  ');
        },

        cd: ([arg = '~']) => {
            const dest = resolveDir(arg);
            if (!dest) return `<span class="term-err">cd: no such directory: ${escapeHtml(arg)}</span>`;
            if (dest.href === routeFor(location.pathname).href) return null;
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
            'Shell:   ko / ja / en',
            'Uptime:  Seoul → Tokyo → Vancouver',
            'Theme:   Tokyo Night',
        ].join('\n'),

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
        const candidates = parts.length <= 1
            ? [...COMMANDS]
            : parts[0] === 'open' ? files.map(f => f.name) : [...dirs.map(r => r.name), '..', '~'];
        const word = parts[parts.length - 1];
        const matches = candidates.filter(c => c.startsWith(word));
        if (matches.length === 1) {
            parts[parts.length - 1] = matches[0];
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
