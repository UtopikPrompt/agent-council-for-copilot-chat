(() => {
    const vscode = acquireVsCodeApi();
    const activityLabels = { advise: 'Advise', implement: 'Implement', analyze: 'Analyze', review: 'Review', document: 'Document', operate: 'Operate' };
    const domainLabels = {
        coding: 'Coding', business: 'Business', 'documentation-governance': 'Documentation and governance',
        infrastructure: 'Infrastructure', 'cross-domain': 'Cross-domain'
    };
    let activeView = 'recommendations';
    let models = [];
    let dashboard = [];
    let activeActivity = 'all';
    let activeDomain = 'all';
    let scope = 'both';
    let priority = 'cloud-first';
    let hasSelectedLocalModel = false;
    let providerTypes = {};
    let lockedProviders = [];
    let pinnedAdvisorModel = null;

    const byId = id => document.getElementById(id);

    function selectView(view, focus = false) {
        const tabs = Array.from(byId('view-tabs').children);
        activeView = view;
        for (const tab of tabs) {
            const selected = tab.dataset.view === view;
            const panel = byId(`${tab.dataset.view}-view`);
            tab.tabIndex = selected ? 0 : -1;
            tab.setAttribute('aria-selected', String(selected));
            panel.hidden = !selected;
            panel.setAttribute('aria-labelledby', tab.id);
        }
        if (focus) tabs.find(tab => tab.dataset.view === view)?.focus();
    }

    function initializeViewTabs() {
        const tabs = Array.from(byId('view-tabs').children);
        for (const [index, tab] of tabs.entries()) {
            tab.addEventListener('click', () => selectView(tab.dataset.view, true));
            tab.addEventListener('keydown', event => {
                const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
                        : event.key === 'Home' ? 0
                            : event.key === 'End' ? tabs.length - 1 : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                selectView(tabs[nextIndex].dataset.view, true);
            });
        }
        selectView(activeView);
    }

    function renderFilterTabs(containerId, prefix, selected, labels, onSelect) {
        const container = byId(containerId);
        container.replaceChildren();
        const options = [['all', 'All'], ...Object.entries(labels)];
        for (const [value, label] of options) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.id = `${prefix}-${value}`;
            tab.dataset.filterValue = value;
            tab.textContent = label;
            tab.tabIndex = value === selected ? 0 : -1;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(value === selected));
            tab.setAttribute('aria-controls', 'recommendations-panel');
            tab.addEventListener('click', () => onSelect(value, true));
            tab.addEventListener('keydown', event => {
                const index = options.findIndex(([option]) => option === value);
                const nextIndex = event.key === 'ArrowRight' ? (index + 1) % options.length
                    : event.key === 'ArrowLeft' ? (index - 1 + options.length) % options.length
                        : event.key === 'Home' ? 0
                            : event.key === 'End' ? options.length - 1 : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                onSelect(options[nextIndex][0], true);
            });
            container.append(tab);
        }
    }

    function renderActivityTabs() {
        renderFilterTabs('activity-tabs', 'activity-tab', activeActivity, activityLabels, selectActivity);
    }

    function renderDomainTabs() {
        renderFilterTabs('domain-tabs', 'domain-tab', activeDomain, domainLabels, selectDomain);
    }

    function selectActivity(activity, focus = false) {
        activeActivity = activity;
        renderActivityTabs();
        if (focus) Array.from(byId('activity-tabs').children).find(tab => tab.dataset.filterValue === activity)?.focus();
        renderDashboard();
    }

    function selectDomain(domain, focus = false) {
        activeDomain = domain;
        renderDomainTabs();
        if (focus) Array.from(byId('domain-tabs').children).find(tab => tab.dataset.filterValue === domain)?.focus();
        renderDashboard();
    }

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
        const modelCount = query ? `${visibleModels.length} / ${models.length} models` : `${models.length} models`;
        byId('model-count').textContent = modelCount;
        byId('model-count-label').textContent = modelCount;
    }

    function renderProviders() {
        const body = byId('providers');
        body.replaceChildren();
        for (const vendor of [...new Set(models.map(model => model.vendor))].sort()) {
            const providerModels = models.filter(model => model.vendor === vendor);
            const allSelected = providerModels.every(model => model.selected);
            const selectedCount = providerModels.filter(model => model.selected).length;
            const row = document.createElement('tr');
            const provider = document.createElement('td');
            provider.textContent = vendor;
            const selection = document.createElement('td');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'provider-filter';
            button.textContent = `${selectedCount} / ${providerModels.length} selected`;
            button.setAttribute('aria-pressed', allSelected ? 'true' : selectedCount ? 'mixed' : 'false');
            button.setAttribute('aria-label', `${allSelected ? 'Deselect' : 'Select'} all models from ${vendor}`);
            button.addEventListener('click', () => {
                setStatus('Saving provider selection...', 'is-loading');
                vscode.postMessage({ type: 'setProviderSelected', vendor, selected: !allSelected });
            });
            selection.append(button);
            const typeCell = document.createElement('td');
            if (lockedProviders.includes(vendor)) {
                typeCell.textContent = 'Cloud';
            } else {
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
                typeCell.append(type);
            }
            row.append(provider, selection, typeCell);
            body.append(row);
        }
    }

    

    function renderDashboard() {
        const body = byId('recommendations');
        body.replaceChildren();
        const matchingRows = dashboard.filter(item => (activeActivity === 'all' || item.activity === activeActivity)
            && (activeDomain === 'all' || item.domain === activeDomain));
        byId('context-activity-heading').hidden = activeActivity !== 'all';
        byId('context-domain-heading').hidden = activeDomain !== 'all';
        byId('recommendations-panel').setAttribute('aria-labelledby', `activity-tab-${activeActivity} domain-tab-${activeDomain}`);
        byId('context-count').textContent = `Showing ${matchingRows.length} of ${dashboard.length} contexts`;
        for (const cell of matchingRows) {
            const row = document.createElement('tr');
            const activityCell = document.createElement('td');
            activityCell.hidden = activeActivity !== 'all';
            activityCell.textContent = activityLabels[cell.activity];
            const domainCell = document.createElement('td');
            domainCell.hidden = activeDomain !== 'all';
            domainCell.textContent = domainLabels[cell.domain];
            const difficultyCell = document.createElement('td');
            const difficultyLabel = `${cell.difficulty[0].toUpperCase()}${cell.difficulty.slice(1)}`;
            difficultyCell.textContent = difficultyLabel;
            const recommendation = document.createElement('td');
            const recommended = cell.candidates.find(model => model.id === cell.recommendedModelId
                && (!cell.recommendedVendor || model.vendor === cell.recommendedVendor));
            const learnedRecommendation = cell.candidates.find(model => model.id === cell.learnedRecommendedModelId
                && model.vendor === cell.learnedRecommendedVendor);
            const manualModel = cell.manualSelection && models.find(model => model.id === cell.manualSelection.modelId
                && model.vendor === cell.manualSelection.vendor);
            const manualChoice = document.createElement('button');
            manualChoice.type = 'button';
            manualChoice.className = 'manual-model-selection';
            manualChoice.textContent = cell.manualSelection
                ? cell.selectionMode === 'manual-unavailable'
                    ? `Unavailable: ${manualModel?.name || cell.manualSelection.modelId} (${manualModel?.vendor || cell.manualSelection.vendor})`
                    : `${manualModel?.name || cell.manualSelection.modelId} (${manualModel?.vendor || cell.manualSelection.vendor})`
                : recommended ? `${recommended.name} (${recommended.vendor})` : 'Choose model';
            manualChoice.setAttribute('aria-label', `${cell.manualSelection ? 'Change' : 'Choose'} manual model for ${activityLabels[cell.activity]}, ${domainLabels[cell.domain]}, ${difficultyLabel}`);
            const selectionMode = cell.selectionMode === 'manual' ? 'Manual override'
                : cell.selectionMode === 'manual-unavailable' ? 'Manual pin unavailable'
                    : cell.selectionMode === 'pooled' ? 'Pooled evidence'
                        : recommended?.selectionMode === 'explore' ? 'Exploring'
                            : recommended?.evidenceSource === 'mixed' ? 'Exact and pooled evidence'
                                : recommended ? 'Exact evidence' : 'Fallback';
            const priceSource = recommended?.pricing?.source === 'vscode'
                ? 'Native rate'
                : recommended?.pricing?.source === 'snapshot'
                    ? `Rate snapshot ${recommended.pricing.snapshotDate}`
                    : recommended?.pricing?.source === 'local'
                        ? 'Local (no token charge)'
                        : recommended?.pricing?.source === 'manual'
                            ? 'Manual tier'
                            : 'Unavailable';
            manualChoice.title = [
                `Selection mode: ${selectionMode}`,
                cell.manualSelection && learnedRecommendation ? `Learned suggestion: ${learnedRecommendation.name} (${learnedRecommendation.vendor})` : null,
                Number.isFinite(recommended?.averageDurationMs) ? `Average measured duration: ${Math.round(recommended.averageDurationMs)} ms` : null,
                Number.isFinite(recommended?.averageCostUsd) ? `Average measured cost: ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(recommended.averageCostUsd)}` : null,
                `Price source: ${priceSource}`
            ].filter(Boolean).join('\n');
            manualChoice.addEventListener('click', () => {
                setStatus('Opening manual model picker...', 'is-loading');
                vscode.postMessage({ type: 'chooseManualModel', activity: cell.activity, domain: cell.domain, difficulty: cell.difficulty });
            });
            recommendation.append(manualChoice);
            let reset;
            if (cell.manualSelection) {
                reset = document.createElement('button');
                reset.type = 'button';
                reset.className = 'use-learned-model';
                reset.textContent = 'X';
                reset.title = 'Clear manual selection';
                reset.setAttribute('aria-label', `Clear manual selection for ${activityLabels[cell.activity]}, ${domainLabels[cell.domain]}, ${difficultyLabel}`);
                reset.addEventListener('click', () => {
                    setStatus('Restoring learned recommendation...', 'is-loading');
                    vscode.postMessage({ type: 'useLearnedModel', activity: cell.activity, domain: cell.domain, difficulty: cell.difficulty });
                });
                recommendation.append(reset);
            }
            if (cell.manualSelection) {
                const learnedLabel = document.createElement('small');
                learnedLabel.textContent = learnedRecommendation
                    ? `Suggested: ${learnedRecommendation.name} (${learnedRecommendation.vendor})`
                    : 'No learned suggestion available';
                recommendation.append(learnedLabel);
            }
            const price = document.createElement('td');
            price.textContent = recommended?.pricing?.budgetClass || '—';
            price.title = `Price source: ${priceSource}${recommended?.pricing?.snapshotDate ? ` (${recommended.pricing.snapshotDate})` : ''}`;
            const evidence = document.createElement('td');
            const sampleCount = document.createElement('div');
            sampleCount.textContent = recommended
                ? `${recommended.samples} exact / ${recommended.pooledSamples} pooled`
                : `${cell.sampleCount} exact / ${cell.pooledSampleCount} pooled overall`;
            const quality = document.createElement('small');
            quality.textContent = recommended
                ? `${recommended.successes} pass / ${recommended.failures} fail; ${Math.round(recommended.score * 100)}% smoothed score`
                : cell.selectionMode === 'manual-unavailable' ? 'Pinned model unavailable'
                    : cell.difficulty === 'complex' && cell.eligibleCount ? 'Needs 2 exact or 4 pooled outcomes' : 'No outcome evidence';
            evidence.title = 'The smoothed score is a ranking signal, not a probability.';
            evidence.append(sampleCount, quality);
            row.append(activityCell, domainCell, difficultyCell, recommendation, evidence, price);
            body.append(row);
        }
    }

    function advisorOptionValue(model) {
        return JSON.stringify([model.vendor, model.modelId ?? model.id]);
    }

    function renderAdvisorDefault() {
        const select = byId('advisor-default-model');
        select.replaceChildren();
        const learned = document.createElement('option');
        learned.value = '';
        learned.textContent = 'Learned recommendations';
        select.append(learned);
        for (const model of models) {
            const option = document.createElement('option');
            option.value = advisorOptionValue(model);
            option.textContent = `${model.name} (${model.vendor})`;
            select.append(option);
        }
        if (pinnedAdvisorModel && !models.some(model => model.id === pinnedAdvisorModel.modelId && model.vendor === pinnedAdvisorModel.vendor)) {
            const unavailable = document.createElement('option');
            unavailable.value = advisorOptionValue(pinnedAdvisorModel);
            unavailable.textContent = `Unavailable: ${pinnedAdvisorModel.modelId} (${pinnedAdvisorModel.vendor})`;
            select.append(unavailable);
        }
        select.value = pinnedAdvisorModel ? advisorOptionValue(pinnedAdvisorModel) : '';
    }

    function setStatus(message, state) {
        const status = byId('learning-status');
        status.className = `model-load-status ${state}`;
        status.setAttribute('aria-busy', String(state === 'is-loading'));
        byId('learning-message').textContent = message;
        byId('refresh-learning').disabled = state === 'is-loading';
        byId('advisor-default-model').disabled = state === 'is-loading';
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
    byId('advisor-default-model').addEventListener('change', () => {
        const value = byId('advisor-default-model').value;
        const [vendor, modelId] = value ? JSON.parse(value) : [];
        setStatus('Saving Aro and advisor default model...', 'is-loading');
        vscode.postMessage({ type: 'setAdvisorPinnedModel', model: value ? { modelId, vendor } : null });
    });
    byId('model-search').addEventListener('input', renderModels);
    initializeViewTabs();
    renderActivityTabs();
    renderDomainTabs();
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
            pinnedAdvisorModel = message.pinnedAdvisorModel ?? null;
            for (const control of document.querySelectorAll('#model-scope input')) control.checked = control.value === scope;
            byId('model-priority').value = priority;
            renderModels();
            renderProviders();
            renderAdvisorDefault();
            renderDashboard();
            setStatus(scope === 'local' && !hasSelectedLocalModel
                ? `Local only: no selected local model available. ${message.recordCount} outcomes stored.`
                : `${message.recordCount} verified outcomes stored in this VS Code profile.`, 'is-ready');
        } else if (message.type === 'learningDashboardError') {
            for (const control of document.querySelectorAll('#model-scope input')) control.checked = control.value === scope;
            byId('model-priority').value = priority;
            renderModels();
            renderProviders();
            renderAdvisorDefault();
            setStatus(`Could not load learning data: ${message.error}`, 'is-error');
        } else if (message.type === 'learningDashboardLoading') {
            setStatus('Loading model rates and Aro outcome history...', 'is-loading');
        }
    });

    setStatus('Loading model rates and Aro outcome history...', 'is-loading');
    vscode.postMessage({ type: 'ready' });
})();
