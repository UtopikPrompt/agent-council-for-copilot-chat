import assert from 'node:assert/strict';
import test from 'node:test';
import providerAvailability from '../src/provider-availability.js';
import pricingModule from '../src/model-pricing.js';

const { isProviderEnabled, normalizeProviderId, normalizeProviderIds, readWorkspaceProviderSetting, resolveProviderAvailability } = providerAvailability;

test('global availability defaults to All and excludes only unchecked providers', () => {
    assert.deepEqual(resolveProviderAvailability({}), { mode: 'inherit', enabledProviders: [], disabledProviders: [] });
    const global = resolveProviderAvailability({ globalDisabledProviders: ['mistral', 'mistral', ' ollama '] });
    assert.deepEqual(global.disabledProviders, ['mistral', 'ollama']);
    assert.equal(isProviderEnabled('copilot', global), true);
    assert.equal(isProviderEnabled('mistral', global), false);
});

test('a workspace custom list replaces the global list instead of intersecting with it', () => {
    const globalDisabled = ['copilot'];
    const workspace = readWorkspaceProviderSetting(['mistral']);
    const resolved = resolveProviderAvailability({ globalDisabledProviders: globalDisabled, workspace });
    assert.equal(resolved.mode, 'custom');
    assert.equal(isProviderEnabled('mistral', resolved), true);
    assert.equal(isProviderEnabled('copilot', resolved), false);
    assert.equal(isProviderEnabled('ollama', resolved), false);
});

test('an unset or invalid workspace value inherits the global list', () => {
    const globalDisabled = ['mistral'];
    for (const value of [undefined, null, 'copilot', { vendor: 'copilot' }]) {
        const workspace = readWorkspaceProviderSetting(value);
        assert.equal(workspace.mode, 'inherit');
        const resolved = resolveProviderAvailability({ globalDisabledProviders: globalDisabled, workspace });
        assert.equal(resolved.mode, 'inherit');
        assert.equal(isProviderEnabled('mistral', resolved), false);
        assert.equal(isProviderEnabled('copilot', resolved), true);
    }
    assert.equal(readWorkspaceProviderSetting('copilot').invalid, true);
    assert.equal(readWorkspaceProviderSetting(undefined).invalid, false);
});

test('provider IDs are exact, trimmed, bounded, and free of control characters', () => {
    assert.equal(normalizeProviderId('  copilot  '), 'copilot');
    assert.equal(normalizeProviderId('Copilot'), 'Copilot');
    assert.equal(normalizeProviderId(''), null);
    assert.equal(normalizeProviderId('   '), null);
    assert.equal(normalizeProviderId(42), null);
    assert.equal(normalizeProviderId('a\nb'), null);
    assert.equal(normalizeProviderId('x'.repeat(301)), null);
    assert.deepEqual(normalizeProviderIds(['b', 'a', 'a', 7, '', 'c']), ['a', 'b', 'c']);
    assert.deepEqual(normalizeProviderIds(undefined), []);
    assert.equal(isProviderEnabled('copilot', resolveProviderAvailability({ workspace: readWorkspaceProviderSetting(['Copilot']) })), false);
});

test('selection filters by effective provider availability and keeps unfiltered inventory intact', () => {
    const models = [
        { id: 'cloud', vendor: 'copilot', inputCost: 10, outputCost: 50 },
        { id: 'mistral-model', vendor: 'mistral', inputCost: 10, outputCost: 50 },
        { id: 'local', vendor: 'ollama' }
    ];
    const base = { scope: 'both', localModelVendors: ['ollama'], classifications: {}, providerTypes: { mistral: 'cloud' }, selections: {}, localTiers: {} };
    const ids = policy => pricingModule.selectModels(models, policy.localModelVendors, policy.classifications, 'both', { ...policy }).map(model => model.id);

    assert.deepEqual(ids({ ...base }), ['cloud', 'mistral-model', 'local']);
    assert.deepEqual(ids({ ...base, providerAvailability: resolveProviderAvailability({ globalDisabledProviders: ['mistral'] }) }), ['cloud', 'local']);
    const copilotOnly = { ...base, providerAvailability: resolveProviderAvailability({ workspace: readWorkspaceProviderSetting(['copilot']) }) };
    assert.deepEqual(ids(copilotOnly), ['cloud']);
    const workspaceReenables = { ...base, providerAvailability: resolveProviderAvailability({ globalDisabledProviders: ['mistral'], workspace: readWorkspaceProviderSetting(['mistral']) }) };
    assert.deepEqual(ids(workspaceReenables), ['mistral-model']);
    assert.equal(models.length, 3);
});

test('a disabled local provider cannot keep the local scope selected', () => {
    const models = [{ id: 'local', vendor: 'ollama' }, { id: 'cloud', vendor: 'copilot' }];
    const policy = {
        scope: 'both', localModelVendors: ['ollama'], classifications: {}, selections: {}, providerTypes: {}, localTiers: {},
        providerAvailability: resolveProviderAvailability({ globalDisabledProviders: ['ollama'] })
    };
    assert.equal(pricingModule.hasSelectedLocalModel(models, policy), false);
    assert.equal(pricingModule.effectiveModelScope(models, policy), 'cloud');
});
