const ADVISOR_PINNED_MODEL_KEY = 'agentRoster.modelLearning.advisorPinnedModel.v1';

function getAdvisorPinnedModel(context) {
    const pinnedModel = context.globalState.get(ADVISOR_PINNED_MODEL_KEY);
    return pinnedModel ? {
        modelId: pinnedModel.modelId,
        vendor: pinnedModel.vendor
    } : null;
}

function getAdvisorFilteredModels(context, models, policy, taskContext, manualSelection = null) {
    const pinnedModel = getAdvisorPinnedModel(context);

    // Per-context manual selections outrank the advisor default.
    if (pinnedModel && taskContext.activity === 'advise' && !manualSelection) {
        const filteredModels = models.filter(model => model.id === pinnedModel.modelId && model.vendor === pinnedModel.vendor);
        return filteredModels.length > 0 ? filteredModels : models;
    }

    // Otherwise, use the existing policy logic
    return models;
}

module.exports = { ADVISOR_PINNED_MODEL_KEY, getAdvisorFilteredModels, getAdvisorPinnedModel };
