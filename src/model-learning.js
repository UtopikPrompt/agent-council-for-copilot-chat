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

function getModelRecommendations(scorecardValue, { role, taskCategory, models, getPricing }) {
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
    candidates.sort((left, right) => right.utility - left.utility
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

function getLearningDashboard(scorecardValue, models, getPricing) {
    const scorecard = normalizeScorecard(scorecardValue);
    return ROLES.flatMap(role => TASK_CATEGORIES.map(taskCategory => {
        const recommendation = getModelRecommendations(scorecard, { role, taskCategory, models, getPricing });
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
    return { low: 0, medium: 1, high: 2 }[pricing?.budgetClass] ?? Number.POSITIVE_INFINITY;
}

module.exports = {
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