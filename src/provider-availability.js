const PROVIDER_AVAILABILITY_KEY = 'agentRoster.modelLearning.providerAvailability.v1';
const WORKSPACE_PROVIDERS_SETTING = 'enabledProviders';
const MAX_PROVIDER_ID_LENGTH = 300;

// Exact VS Code vendor IDs: trimmed, non-empty, bounded, and free of control characters.
function normalizeProviderId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    if (!id || id.length > MAX_PROVIDER_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(id)) return null;
    return id;
}

function normalizeProviderIds(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(normalizeProviderId).filter(Boolean))].sort();
}

// Reads a workspace setting value. Only an array is a custom list; any other value is ignored as invalid.
function readWorkspaceProviderSetting(value) {
    if (value === undefined || value === null) return { mode: 'inherit', enabledProviders: [], invalid: false };
    if (!Array.isArray(value)) return { mode: 'inherit', enabledProviders: [], invalid: true };
    return {
        mode: 'custom',
        enabledProviders: normalizeProviderIds(value),
        invalid: value.some(item => normalizeProviderId(item) === null)
    };
}

// The global list excludes providers, so an unset list means All. A workspace list replaces the global list.
function resolveProviderAvailability({ globalDisabledProviders = [], workspace = null } = {}) {
    if (workspace?.mode === 'custom') {
        return { mode: 'custom', enabledProviders: normalizeProviderIds(workspace.enabledProviders), disabledProviders: [] };
    }
    return { mode: 'inherit', enabledProviders: [], disabledProviders: normalizeProviderIds(globalDisabledProviders) };
}

function isProviderEnabled(vendor, availability) {
    if (!availability) return true;
    if (availability.mode === 'custom') return availability.enabledProviders.includes(vendor);
    return !availability.disabledProviders.includes(vendor);
}

// Short sidebar label for the effective provider policy.
function providerAvailabilityLabel(effective) {
    if (effective.mode === 'custom') return `Workspace: ${effective.enabledProviders.length} enabled`;
    return effective.disabledProviders.length ? `${effective.disabledProviders.length} disabled` : 'All providers';
}

// Builds the provider page payload. Inventory counts come from unfiltered discovery; stored IDs missing from inventory are reported, not removed.
function describeProviderAvailability({ inventory = [], globalDisabledProviders = [], workspace = { mode: 'inherit', enabledProviders: [], invalid: false }, hasWorkspace = false }) {
    const effective = resolveProviderAvailability({ globalDisabledProviders, workspace });
    const counts = new Map(inventory.map(item => [item.vendor, item.modelCount]));
    const custom = workspace.mode === 'custom';
    const stored = [...globalDisabledProviders, ...(custom ? workspace.enabledProviders : [])];
    const vendors = [...new Set([...counts.keys(), ...stored])].sort();
    let summary;
    if (effective.mode === 'custom') {
        summary = effective.enabledProviders.length
            ? `Custom workspace list: ${effective.enabledProviders.length} provider(s) enabled. It overrides the global list.`
            : 'Custom workspace list: no providers enabled. Aro has no eligible models in this workspace.';
    } else {
        summary = effective.disabledProviders.length
            ? `Global list applies: ${effective.disabledProviders.length} provider(s) disabled.`
            : 'All providers are enabled (global default).';
    }
    return {
        hasWorkspace,
        global: { disabledProviders: globalDisabledProviders, allEnabled: globalDisabledProviders.length === 0 },
        workspace: { mode: workspace.mode, invalid: Boolean(workspace.invalid), enabledProviders: custom ? workspace.enabledProviders : [] },
        effective: { mode: effective.mode, label: providerAvailabilityLabel(effective), summary },
        providers: vendors.map(vendor => ({
            vendor,
            modelCount: counts.get(vendor) ?? 0,
            available: counts.has(vendor),
            globallyEnabled: !globalDisabledProviders.includes(vendor),
            workspaceEnabled: custom ? workspace.enabledProviders.includes(vendor) : null,
            effectiveEnabled: isProviderEnabled(vendor, effective),
            effectiveSource: custom ? 'workspace' : 'global'
        }))
    };
}

module.exports = {
    MAX_PROVIDER_ID_LENGTH,
    PROVIDER_AVAILABILITY_KEY,
    WORKSPACE_PROVIDERS_SETTING,
    describeProviderAvailability,
    isProviderEnabled,
    normalizeProviderId,
    normalizeProviderIds,
    providerAvailabilityLabel,
    readWorkspaceProviderSetting,
    resolveProviderAvailability
};
