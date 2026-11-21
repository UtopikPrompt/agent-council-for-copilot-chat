(() => {
    const vscode = acquireVsCodeApi();
    const byId = id => document.getElementById(id);
    const statusElement = byId('proposal-status');
    const messageElement = byId('proposal-message');
    const list = byId('proposal-list');
    const form = byId('proposal-form');
    const fields = { name: byId('proposal-name'), description: byId('proposal-description'), body: byId('proposal-body') };
    const errorsElement = byId('proposal-errors');
    const rationaleElement = byId('proposal-rationale');
    let proposals = [];
    let selectedId = '';

    function setStatus(message, state) {
        statusElement.className = `model-load-status ${state}`;
        statusElement.setAttribute('aria-busy', String(state === 'is-loading'));
        messageElement.textContent = message;
    }

    function selected() {
        return proposals.find(proposal => proposal.id === selectedId);
    }

    function fillForm() {
        const proposal = selected();
        form.hidden = !proposal;
        errorsElement.textContent = '';
        if (!proposal) return;
        for (const key of Object.keys(fields)) fields[key].value = proposal[key];
        rationaleElement.textContent = proposal.rationale ? `Why Aro proposed this: ${proposal.rationale}` : '';
    }

    function renderList() {
        list.replaceChildren();
        for (const proposal of proposals) {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = proposal.name;
            button.setAttribute('aria-current', String(proposal.id === selectedId));
            button.addEventListener('click', () => {
                selectedId = proposal.id;
                renderList();
                fillForm();
            });
            item.append(button);
            list.append(item);
        }
    }

    function render(next) {
        const previous = selectedId;
        proposals = next;
        if (!selected()) selectedId = proposals[0]?.id || '';
        renderList();
        // Keep unsaved edits in the open form when the same proposal is merely re-published.
        if (selectedId !== previous) fillForm();
        form.hidden = !selected();
        setStatus(proposals.length ? `${proposals.length} pending proposal${proposals.length === 1 ? '' : 's'}.` : 'No pending proposals.', 'is-ready');
    }

    function edits() {
        return { name: fields.name.value, description: fields.description.value, body: fields.body.value };
    }

    function send(type) {
        const proposal = selected();
        if (!proposal) return;
        errorsElement.textContent = '';
        setStatus('Working...', 'is-loading');
        vscode.postMessage({ type, id: proposal.id, edits: edits() });
    }

    byId('proposal-save').addEventListener('click', () => send('save'));
    byId('proposal-accept').addEventListener('click', () => send('accept'));
    byId('proposal-dismiss').addEventListener('click', () => send('dismiss'));

    window.addEventListener('message', event => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'skillProposals') {
            render(Array.isArray(message.proposals) ? message.proposals : []);
        } else if (message.type === 'skillProposalResult') {
            if (message.ok) {
                if (message.action === 'save') setStatus('Changes saved.', 'is-ready');
                else if (message.action === 'accept') setStatus('Skill created.', 'is-ready');
                else setStatus('Proposal dismissed.', 'is-ready');
                if (message.action !== 'save') fillForm();
            } else if (message.cancelled) {
                setStatus('Cancelled. Nothing was changed.', 'is-ready');
            } else {
                setStatus('Not completed.', 'is-error');
                errorsElement.textContent = (message.errors || []).join('\n');
            }
        }
    });

    vscode.postMessage({ type: 'ready' });
})();
