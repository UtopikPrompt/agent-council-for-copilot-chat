(() => {
    const vscode = acquireVsCodeApi();
    const roles = ['advisor', 'coding', 'documentation', 'infrastructure', 'review'];
    const tasks = ['simple', 'standard', 'complex'];
    let models = [];
    let dashboard = [];

    const byId = id => document.getElementById(id);

    function renderModels() {
        const body = byId('models');
        body.replaceChildren();
        for (const model of models) {
            const row = document.createElement('tr');
            const name = document.createElement('td');
            name.textContent = model.name;
            const id = document.createElement('small');
            id.textContent = model.id;
            name.append(id);
            const provider = document.createElement('td');
            provider.textContent = `${model.vendor} / ${model.family} (${model.version})`;
            const price = document.createElement('td');
            const rates = [
                `In ${model.pricing?.inputCost ?? '-'}`,
                `Out ${model.pricing?.outputCost ?? '-'}`,
                `Cache ${model.pricing?.cacheCost ?? '-'}`,
                `Write ${model.pricing?.cacheWriteCost ?? '-'}`
            ];
            price.textContent = rates.join(' / ');
            const tier = document.createElement('td');
            tier.textContent = model.pricing?.budgetClass || 'unpriced';
            const source = document.createElement('td');
            source.textContent = model.pricing?.source === 'vscode'
                ? 'Native'
                : model.pricing?.source === 'snapshot'
                    ? `Snapshot ${model.pricing.snapshotDate}`
                    : 'Unavailable';
            row.append(name, provider, price, tier, source);
            body.append(row);
        }
        byId('model-count').textContent = `${models.length} models`;
    }

    function renderDashboard() {
        const body = byId('recommendations');
        body.replaceChildren();
        for (const role of roles) {
            const heading = document.createElement('tr');
            const label = document.createElement('th');
            label.colSpan = 6;
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
                    : 'Collecting evidence';
                const price = document.createElement('td');
                price.textContent = recommended?.pricing?.budgetClass || '—';
                const mode = document.createElement('td');
                mode.textContent = recommended?.selectionMode === 'explore' ? 'Exploring' : recommended ? 'Learned' : 'Fallback';
                const samples = document.createElement('td');
                samples.textContent = String(cell?.sampleCount || 0);
                const score = document.createElement('td');
                score.textContent = recommended
                    ? `${recommended.successes} pass / ${recommended.failures} fail (${Math.round(recommended.score * 100)}%)`
                    : `${cell?.sampleCount || 0} / 2 minimum outcomes`;
                const source = document.createElement('td');
                source.textContent = recommended?.pricing?.source === 'vscode'
                    ? 'Native rate'
                    : recommended?.pricing?.source === 'snapshot'
                        ? `Rate snapshot ${recommended.pricing.snapshotDate}`
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
    }

    function refresh() {
        setStatus('Updating recommendations from Aro’s recent outcomes...', 'is-loading');
        vscode.postMessage({ type: 'refreshLearning' });
    }

    byId('refresh-learning').addEventListener('click', refresh);

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'learningDashboard') {
            models = message.models;
            dashboard = message.dashboard;
            renderModels();
            renderDashboard();
            setStatus(`${message.recordCount} verified outcomes stored in this VS Code profile.`, 'is-ready');
        } else if (message.type === 'learningDashboardError') {
            setStatus(`Could not load learning data: ${message.error}`, 'is-error');
        } else if (message.type === 'learningDashboardLoading') {
            setStatus('Loading model rates and Aro outcome history...', 'is-loading');
        }
    });

    setStatus('Loading model rates and Aro outcome history...', 'is-loading');
    vscode.postMessage({ type: 'ready' });
})();