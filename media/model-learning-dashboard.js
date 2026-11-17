(() => {
    const vscode = acquireVsCodeApi();
    const roles = ['advisor', 'coding', 'documentation', 'infrastructure', 'review'];
    const tasks = ['simple', 'standard', 'complex'];
    let models = [];
    let dashboard = [];
    let scope = 'both';
    let priority = 'cloud-first';
    let hasSelectedLocalModel = false;
    let providerTypes = {};
    let lockedProviders = [];

    const byId = id => document.getElementById(id);

    function renderModels() {
        const body = byId('models');
        body.replaceChildren();
        const query = byId('model-search').value.trim().toLowerCase();
        const visibleModels = models.filter(model => [model.name, model.id, model.vendor, model.family]
            .some(value => String(value || '').toLowerCase().includes(query)));
        for (const model of visibleModels) {
            const row = document.createElement('tr');
            const selection = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = model.selected;
            checkbox.setAttribute('aria-label', `Use ${model.name} (${model.vendor})`);
            checkbox.addEventListener('change', () => {
                setStatus('Saving model selection...', 'is-loading');
                vscode.postMessage({ type: 'setModelSelected', id: model.id, vendor: model.vendor, selected: checkbox.checked });
            });
            selection.append(checkbox);
            const name = document.createElement('td');
            name.textContent = model.name;
            const id = document.createElement('small');
            id.textContent = model.id;
            name.append(id);
            const provider = document.createElement('td');
            provider.textContent = `${model.vendor} / ${model.family} (${model.version})`;
            const tier = document.createElement('td');
            if (model.kind === 'local') {
                const select = document.createElement('select');
                select.setAttribute('aria-label', `Capability tier for ${model.name} (${model.vendor})`);
                for (const [value, label] of [['unrated', 'Unrated'], ['simple', 'Low (simple)'], ['standard', 'Medium (standard)'], ['complex', 'High (complex)']]) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = label;
                    select.append(option);
                }
                select.value = model.localTier;
                select.addEventListener('change', () => {
                    setStatus('Saving local model tier...', 'is-loading');
                    vscode.postMessage({ type: 'setLocalTier', id: model.id, vendor: model.vendor, tier: select.value });
                });
                tier.append(select);
            } else if (['unpriced', 'manual'].includes(model.pricing?.source)) {
                const priceSelect = document.createElement('select');
                priceSelect.setAttribute('aria-label', `Price tier for ${model.name} (${model.vendor})`);
                for (const [value, label] of [['unpriced', 'Unpriced'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = label;
                    priceSelect.append(option);
                }
                priceSelect.value = model.pricing.budgetClass;
                priceSelect.addEventListener('change', () => {
                    setStatus('Saving manual price tier...', 'is-loading');
                    vscode.postMessage({ type: 'setManualPriceTier', id: model.id, vendor: model.vendor, tier: priceSelect.value });
                });
                tier.append(priceSelect);
            } else {
                tier.textContent = model.pricing?.budgetClass || 'unpriced';
            }
            const price = document.createElement('td');
            const rates = [
                `In ${model.pricing?.inputCost ?? '-'}`,
                `Out ${model.pricing?.outputCost ?? '-'}`,
                `Cache ${model.pricing?.cacheCost ?? '-'}`,
                `Write ${model.pricing?.cacheWriteCost ?? '-'}`
            ];
            price.textContent = rates.join(' / ');
            const source = document.createElement('td');
            source.textContent = model.pricing?.source === 'vscode'
                ? 'Native'
                : model.pricing?.source === 'snapshot'
                    ? `Snapshot ${model.pricing.snapshotDate}`
                    : model.pricing?.source === 'local'
                        ? 'Local (no token charge)'
                    : model.pricing?.source === 'manual'
                        ? 'Manual tier'
                    : 'Unavailable';
            row.append(selection, name, provider, tier, price, source);
            body.append(row);
        }
        byId('model-count').textContent = query ? `${visibleModels.length} / ${models.length} models` : `${models.length} models`;
    }

    function renderProviders() {
        const container = byId('provider-controls');
        const settings = byId('provider-types');
        container.replaceChildren();
        settings.replaceChildren();
        for (const vendor of [...new Set(models.map(model => model.vendor))].sort()) {
            const providerModels = models.filter(model => model.vendor === vendor);
            const allSelected = providerModels.every(model => model.selected);
            const selectedCount = providerModels.filter(model => model.selected).length;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'provider-filter';
            button.textContent = `${vendor} ${selectedCount}/${providerModels.length}`;
            button.setAttribute('aria-pressed', allSelected ? 'true' : selectedCount ? 'mixed' : 'false');
            button.title = `${allSelected ? 'Clear' : 'Select'} all models from ${vendor}, including filtered models`;
            button.addEventListener('click', () => {
                setStatus('Saving provider selection...', 'is-loading');
                vscode.postMessage({ type: 'setProviderSelected', vendor, selected: !allSelected });
            });
            container.append(button);
            const label = document.createElement('label');
            label.className = 'provider-type';
            const providerName = document.createElement('span');
            providerName.textContent = vendor;
            if (lockedProviders.includes(vendor)) {
                const cloud = document.createElement('span');
                cloud.textContent = 'Cloud';
                label.append(providerName, cloud);
                settings.append(label);
                continue;
            }
            const type = document.createElement('select');
            type.setAttribute('aria-label', `Model type for ${vendor}`);
            for (const [value, label] of [['unknown', 'Unknown'], ['cloud', 'Cloud'], ['local', 'Local']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                type.append(option);
            }
            type.value = providerTypes[vendor] || 'unknown';
            type.addEventListener('change', () => {
                setStatus('Saving provider type...', 'is-loading');
                vscode.postMessage({ type: 'setProviderType', vendor, kind: type.value });
            });
            label.append(providerName, type);
            settings.append(label);
        }
    }

    function renderDashboard() {
        const body = byId('recommendations');
        body.replaceChildren();
        for (const role of roles) {
            const heading = document.createElement('tr');
            const label = document.createElement('th');
            label.colSpan = 7;
            label.textContent = role;
            heading.append(label);
            body.append(heading);

            for (const task of tasks) {
                const cell = dashboard.find(item => item.role === role && item.taskCategory === task);
                const row = document.createElement('tr');
                const category = document.createElement('td');
                category.textContent = task;
                const recommendation = document.createElement('td');
                const recommended = cell?.candidates.find(model => model.id === cell.recommendedModelId);
                recommendation.textContent = recommended
                    ? `${recommended.name} (${recommended.vendor})`
                    : task === 'complex' && cell?.eligibleCount ? 'No learned recommendation' : 'No eligible priced model';
                const price = document.createElement('td');
                price.textContent = recommended?.pricing?.budgetClass || '—';
                const mode = document.createElement('td');
                mode.textContent = recommended?.selectionMode === 'explore' ? 'Exploring' : recommended ? 'Learned' : 'Fallback';
                const samples = document.createElement('td');
                samples.textContent = String(cell?.sampleCount || 0);
                const score = document.createElement('td');
                score.textContent = recommended
                    ? `${recommended.successes} pass / ${recommended.failures} fail (${Math.round(recommended.score * 100)}%)`
                    : task === 'complex' && cell?.eligibleCount ? 'Needs 2 outcomes per model' : '—';
                const source = document.createElement('td');
                source.textContent = recommended?.pricing?.source === 'vscode'
                    ? 'Native rate'
                    : recommended?.pricing?.source === 'snapshot'
                        ? `Rate snapshot ${recommended.pricing.snapshotDate}`
                        : recommended?.pricing?.source === 'local'
                            ? 'Local (no token charge)'
                        : recommended?.pricing?.source === 'manual'
                            ? 'Manual tier'
                        : '—';
                row.append(category, recommendation, price, mode, samples, score, source);
                body.append(row);
            }
        }
    }

    function setStatus(message, state) {
        const status = byId('learning-status');
        status.className = `model-load-status ${state}`;
        status.setAttribute('aria-busy', String(state === 'is-loading'));
        byId('learning-message').textContent = message;
        byId('refresh-learning').disabled = state === 'is-loading';
        byId('model-search').disabled = state === 'is-loading';
        byId('model-priority').disabled = state === 'is-loading' || scope !== 'both' || !hasSelectedLocalModel;
        for (const control of document.querySelectorAll('#model-scope input, #models select, #models input, #provider-controls button, #provider-types select')) {
            control.disabled = state === 'is-loading'
                || (control.name === 'model-scope' && control.value !== 'cloud' && !hasSelectedLocalModel);
        }
    }

    function refresh() {
        setStatus('Updating recommendations from Aro’s recent outcomes...', 'is-loading');
        vscode.postMessage({ type: 'refreshLearning' });
    }

    byId('refresh-learning').addEventListener('click', refresh);
    byId('model-search').addEventListener('input', renderModels);
    byId('model-scope').addEventListener('change', event => {
        if (event.target.name !== 'model-scope') return;
        setStatus('Saving model scope...', 'is-loading');
        vscode.postMessage({ type: 'setModelScope', scope: event.target.value });
    });
    byId('model-priority').addEventListener('change', event => {
        if (scope !== 'both') return;
        setStatus('Saving model priority...', 'is-loading');
        vscode.postMessage({ type: 'setModelPriority', priority: event.target.value });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'learningDashboard') {
            models = message.models;
            dashboard = message.dashboard;
            scope = message.scope;
            priority = message.priority;
            hasSelectedLocalModel = message.hasSelectedLocalModel;
            providerTypes = message.providerTypes;
            lockedProviders = message.lockedProviders;
            for (const control of document.querySelectorAll('#model-scope input')) control.checked = control.value === scope;
            byId('model-priority').value = priority;
            renderModels();
            renderProviders();
            renderDashboard();
            setStatus(scope === 'local' && !hasSelectedLocalModel
                ? `Local only: no selected local model available. ${message.recordCount} outcomes stored.`
                : `${message.recordCount} verified outcomes stored in this VS Code profile.`, 'is-ready');
        } else if (message.type === 'learningDashboardError') {
            for (const control of document.querySelectorAll('#model-scope input')) control.checked = control.value === scope;
            byId('model-priority').value = priority;
            renderModels();
            renderProviders();
            setStatus(`Could not load learning data: ${message.error}`, 'is-error');
        } else if (message.type === 'learningDashboardLoading') {
            setStatus('Loading model rates and Aro outcome history...', 'is-loading');
        }
    });

    setStatus('Loading model rates and Aro outcome history...', 'is-loading');
    vscode.postMessage({ type: 'ready' });
})();