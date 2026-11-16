const PRICE_SNAPSHOT_DATE = '2026-11-16';

const MODEL_PRICES = {
    claudefable5: [1000, 5000],
    claudefable51: [1000, 5000],
    claudefable52: [800, 4000],
    claudehaiku45: [100, 500],
    claudehaiku55: [10, 50],
    claudeopus48: [500, 2500],
    claudeopus48fastmode: [1000, 5000],
    claudeopus5: [500, 2500],
    claudeopus55: [400, 2000],
    claudesonnet5: [200, 1000],
    claudesonnet55: [200, 1000],
    gemini38flash: [75, 375],
    gemini4argon: [200, 1000],
    gemini4carbon: [200, 1000],
    gemini4hydrogen: [150, 750],
    gpt52: [175, 1400],
    gpt53codex: [175, 1400],
    gpt56luna: [20, 120],
    gpt56sol: [400, 2000],
    gpt56terra: [200, 1200],
    gpt6astra: [1000, 5000],
    gpt6luna: [10, 50],
    gpt6sol: [200, 1000],
    gpt61sol: [200, 1000],
    gpt61terra: [100, 500],
    grok46: [100, 600],
    grok47: [200, 600],
    kimik3: [300, 1500],
    maicode11flash: [20, 120]
};

const ALIASES = {
    claudeopus48fastmodepreview: 'claudeopus48fastmode',
    claudeopus48fast: 'claudeopus48fastmode',
    gemini38flashpreview: 'gemini38flash',
    maicode11flashpreview: 'maicode11flash'
};

function normalizeModelName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/preview/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function classifyPrice(...rates) {
    const knownRates = rates.filter(rate => Number.isFinite(rate) && rate >= 0);
    if (knownRates.length === 0) return 'unpriced';
    const highestRate = Math.max(...knownRates);
    if (highestRate <= 150) return 'low';
    if (highestRate <= 1000) return 'medium';
    return 'high';
}

function getModelPricing(model) {
    const nativeInputCost = Number.isFinite(model?.inputCost) ? model.inputCost : null;
    const nativeOutputCost = Number.isFinite(model?.outputCost) ? model.outputCost : null;
    const nativeCacheCost = Number.isFinite(model?.cacheCost) ? model.cacheCost : null;
    const nativeCacheWriteCost = Number.isFinite(model?.cacheWriteCost) ? model.cacheWriteCost : null;
    const nativePriceCategory = String(model?.priceCategory || '').toLowerCase();
    const knownNativeCategory = ['low', 'medium', 'high'].includes(nativePriceCategory) ? nativePriceCategory : null;
    if (knownNativeCategory || [nativeInputCost, nativeOutputCost, nativeCacheCost, nativeCacheWriteCost].some(rate => rate !== null)) {
        return {
            inputCost: nativeInputCost,
            outputCost: nativeOutputCost,
            cacheCost: nativeCacheCost,
            cacheWriteCost: nativeCacheWriteCost,
            budgetClass: knownNativeCategory || classifyPrice(nativeInputCost, nativeOutputCost, nativeCacheCost, nativeCacheWriteCost),
            source: 'vscode',
            snapshotDate: null
        };
    }

    const keys = [model?.name, model?.family, model?.id?.split('/').pop()]
        .map(normalizeModelName)
        .filter(Boolean);
    const key = keys.map(candidate => ALIASES[candidate] || candidate).find(candidate => MODEL_PRICES[candidate]);

    if (!key) {
        return {
            inputCost: null,
            outputCost: null,
            cacheCost: null,
            cacheWriteCost: null,
            budgetClass: 'unpriced',
            source: 'unpriced',
            snapshotDate: PRICE_SNAPSHOT_DATE
        };
    }

    const [inputCost, outputCost] = MODEL_PRICES[key];
    return {
        inputCost,
        outputCost,
        cacheCost: null,
        cacheWriteCost: null,
        budgetClass: classifyPrice(inputCost, outputCost),
        source: 'snapshot',
        snapshotDate: PRICE_SNAPSHOT_DATE
    };
}

module.exports = { PRICE_SNAPSHOT_DATE, classifyPrice, getModelPricing, normalizeModelName };