/**
 * Shared terminal handler for all pages.
 *
 * Usage: call initTerminal(options) after the DOM is ready.
 *
 * options:
 *   currentPath  {string}  Path shown in the guest prompt (e.g. "~/learning")
 *   listOutput   {string}  Output for the `ls` command
 *   homePage     {string}  URL to navigate to for `home` / `cd ..` / `cd ~`  (default: "index.html")
 */
function initTerminal(options) {
    const currentPath = options.currentPath || "~";
    const listOutput  = options.listOutput  || "";
    const homePage    = options.homePage    || "index.html";

    const input       = document.getElementById('terminal-input');
    const terminalDiv = document.getElementById('dynamic-terminal');
    if (!input || !terminalDiv) return;

    function sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    input.addEventListener('keypress', function (e) {
        if (e.key !== 'Enter') return;

        const rawInput  = input.value;
        const safeInput = sanitize(rawInput);
        const trimmed   = rawInput.trim();
        const cmd       = trimmed.toLowerCase().split(/\s+/)[0];

        const promptHTML = `<div class="prompt-line">
            <span class="p-user">guest</span><span class="p-at">@</span><span class="p-host">ubc</span><span class="p-path">${currentPath}</span><span class="p-symbol">→</span>
            <span class="cmd-inline">${safeInput}</span>
        </div>`;

        if (trimmed !== "") {
            terminalDiv.insertAdjacentHTML('beforeend', promptHTML);
        }

        let outputText = "";

        if (cmd === 'help') {
            outputText = 'Available commands: help, ls, cd .., home, clear';
        } else if (cmd === 'ls') {
            outputText = listOutput;
        } else if (cmd === 'home' || trimmed === 'cd ..' || trimmed === 'cd ~') {
            outputText = 'Navigating...';
            terminalDiv.insertAdjacentHTML('beforeend', `<div class="terminal-output">${outputText}</div>`);
            input.value = '';
            window.location.href = homePage;
            return;
        } else if (cmd === 'clear') {
            terminalDiv.innerHTML = '';
            input.value = '';
            return;
        } else if (trimmed !== '') {
            outputText = `command not found: ${sanitize(trimmed)}`;
        }

        if (outputText) {
            terminalDiv.insertAdjacentHTML('beforeend', `<div class="terminal-output">${outputText}</div>`);
        }

        input.value = '';
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
}
