const ROLES = ['advisor', 'coding', 'documentation', 'infrastructure', 'review'];
const TASK_CATEGORIES = ['simple', 'standard', 'complex'];
const OUTCOMES = ['success', 'failure'];
const FAILURE_CODES = ['incorrect', 'incomplete', 'acceptance_failed', 'unsafe'];
const MAX_RECORDS = 1000;
const EXPLORE_WEIGHT = { simple: 0.35, standard: 0.24, complex: 0.12 };
const PRICE_WEIGHT = { simple: 0.25, standard: 0.15, complex: 0.06 };

function emptyScorecard() {
    return { schemaVersion: 1, records: [] };
}

function normalizeScorecard(value) {
    const records = Array.isArray(value?.records) ? value.records : [];
    return {
        schemaVersion: 1,
        records: records.filter(record => record
            && ROLES.includes(record.role)
            && TASK_CATEGORIES.includes(record.taskCategory)
            && typeof record.modelId === 'string'
            && OUTCOMES.includes(record.outcome)
            && (record.outcome === 'success'
                ? record.evidenceCode === 'acceptance_passed'
                : FAILURE_CODES.includes(record.evidenceCode))
            && typeof record.recordedAt === 'string')
            .slice(-MAX_RECORDS)
    };
}

function recordOutcome(scorecardValue, input) {
    if (!ROLES.includes(input.role)) throw new TypeError('Unknown model-learning role.');
    if (!TASK_CATEGORIES.includes(input.taskCategory)) throw new TypeError('Unknown task category.');
    if (typeof input.modelId !== 'string' || input.modelId.length === 0 || input.modelId.length > 300) {
        throw new TypeError('A requested model ID is required.');
    }
    if (!OUTCOMES.includes(input.outcome)) throw new TypeError('Outcome must be success or failure.');
    if (input.outcome === 'success' && input.evidenceCode !== 'acceptance_passed') {
        throw new TypeError('Success requires verified acceptance checks.');
    }
    if (input.outcome === 'failure' && !FAILURE_CODES.includes(input.evidenceCode)) {
        throw new TypeError('Failure requires an objective model-quality failure code.');
    }

    const scorecard = normalizeScorecard(scorecardValue);
    const record = {
        role: input.role,
        taskCategory: input.taskCategory,
        modelId: input.modelId,
        outcome: input.outcome,
        evidenceCode: input.evidenceCode,
        ...(typeof input.worker === 'string' && input.worker.length <= 100 ? { worker: input.worker } : {}),
        recordedAt: new Date().toISOString()
    };
    return normalizeScorecard({ records: [...scorecard.records, record] });
}

function getModelRecommendations(scorecardValue, { role, taskCategory, models, getPricing, getModelKind, preference }) {
    const scorecard = normalizeScorecard(scorecardValue);
    const historyForContext = scorecard.records.filter(record => record.role === role && record.taskCategory === taskCategory);
    const candidates = models.map(model => {
        const history = scorecard.records.filter(record => record.role === role
            && record.taskCategory === taskCategory
            && record.modelId === model.id);
        const successes = history.filter(record => record.outcome === 'success').length;
        const failures = history.length - successes;
        const total = history.length;
        const pricing = getPricing(model);
        return {
            id: model.id,
            name: model.name,
            vendor: model.vendor,
            modelArgument: `${model.name} (${model.vendor})`,
            family: model.family,
            kind: getModelKind ? getModelKind(model) : undefined,
            pricing,
            successes,
            failures,
            samples: total,
            score: (successes + 1) / (total + 2),
            exploration: Math.min(1, Math.sqrt(Math.log(historyForContext.length + models.length + 1) / (total + 1))),
            cost: priceOf(pricing)
        };
    });

    const pricedCandidates = candidates.filter(candidate => Number.isFinite(candidate.cost));
    const minCost = Math.min(...pricedCandidates.map(candidate => candidate.cost));
    const maxCost = Math.max(...pricedCandidates.map(candidate => candidate.cost));
    for (const candidate of candidates) {
        candidate.costRatio = Number.isFinite(candidate.cost) && maxCost > minCost
            ? (candidate.cost - minCost) / (maxCost - minCost)
            : Number.isFinite(candidate.cost) ? 0 : 1;
        candidate.utility = Number.isFinite(candidate.cost)
            ? candidate.score + EXPLORE_WEIGHT[taskCategory] * candidate.exploration - PRICE_WEIGHT[taskCategory] * candidate.costRatio
            : Number.NEGATIVE_INFINITY;
        candidate.selectionMode = candidate.samples < 2 ? 'explore' : 'learned';
    }
    candidates.sort((left, right) => Number(Number.isFinite(right.cost)) - Number(Number.isFinite(left.cost))
        || (preference ? Number(right.kind === preference) - Number(left.kind === preference) : 0)
        || right.utility - left.utility
        || right.score - left.score
        || left.cost - right.cost
        || left.id.localeCompare(right.id));

    const recommended = candidates.find(candidate => Number.isFinite(candidate.cost));
    return {
        role,
        taskCategory,
        recommendedModelId: recommended?.id || null,
        selectionMode: recommended?.selectionMode || 'fallback',
        candidates
    };
}

function compactModelRecommendations(result) {
    const eligible = result.candidates.filter(candidate => Number.isFinite(candidate.cost));
    const selected = [];
    const keys = new Set();
    const add = candidate => {
        if (!candidate) return;
        const key = JSON.stringify([candidate.vendor, candidate.id]);
        if (keys.has(key)) return;
        keys.add(key);
        selected.push(candidate);
    };
    eligible.slice(0, 3).forEach(add);
    const preferredKind = eligible[0]?.kind;
    if (preferredKind) add(eligible.find(candidate => candidate.kind && candidate.kind !== preferredKind));
    for (const kind of ['local', 'cloud']) {
        add(eligible.find(candidate => candidate.kind === kind && candidate.selectionMode === 'learned'));
    }
    for (const modelArgument of ['Claude Haiku 5.5 (copilot)', 'Claude Sonnet 5.5 (copilot)']) {
        add(eligible.find(candidate => candidate.modelArgument === modelArgument));
    }
    const rank = new Map(eligible.map((candidate, index) => [candidate, index]));
    selected.sort((left, right) => rank.get(left) - rank.get(right));
    return {
        role: result.role,
        taskCategory: result.taskCategory,
        recommendedModelId: result.recommendedModelId,
        selectionMode: result.selectionMode,
        candidates: selected.map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            vendor: candidate.vendor,
            modelArgument: candidate.modelArgument,
            kind: candidate.kind,
            selectionMode: candidate.selectionMode,
            samples: candidate.samples,
            successes: candidate.successes,
            failures: candidate.failures,
            score: Number(candidate.score.toFixed(3)),
            pricing: { budgetClass: candidate.pricing.budgetClass, source: candidate.pricing.source }
        })),
        eligibleCount: eligible.length,
        unpricedCount: result.candidates.length - eligible.length,
        truncated: selected.length < eligible.length
    };
}

function getLearningDashboard(scorecardValue, models, getPricing, options = {}) {
    const scorecard = normalizeScorecard(scorecardValue);
    return ROLES.flatMap(role => TASK_CATEGORIES.map(taskCategory => {
        const recommendation = getModelRecommendations(scorecard, {
            role, taskCategory, models: options.getModelsForTask ? options.getModelsForTask(taskCategory) : models,
            getPricing, getModelKind: options.getModelKind, preference: options.preference
        });
        const sampleCount = scorecard.records.filter(record => record.role === role && record.taskCategory === taskCategory).length;
        return {
            role,
            taskCategory,
            sampleCount,
            recommendedModelId: recommendation.recommendedModelId,
            candidates: recommendation.candidates.slice(0, 3)
        };
    }));
}

function priceOf(pricing) {
    const rates = [pricing?.inputCost, pricing?.outputCost, pricing?.cacheCost, pricing?.cacheWriteCost]
        .filter(rate => Number.isFinite(rate) && rate >= 0);
    if (rates.length) return Math.max(...rates);
    return { low: 75, medium: 575, high: 1001 }[pricing?.budgetClass] ?? Number.POSITIVE_INFINITY;
}

module.exports = {
    compactModelRecommendations,
    FAILURE_CODES,
    OUTCOMES,
    ROLES,
    TASK_CATEGORIES,
    emptyScorecard,
    getLearningDashboard,
    getModelRecommendations,
    normalizeScorecard,
    recordOutcome
};