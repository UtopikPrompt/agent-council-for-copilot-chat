import assert from 'node:assert/strict';
import test from 'node:test';
import learningModule from '../src/model-learning.js';

const { emptyScorecard, getLearningDashboard, getModelRecommendations, normalizeScorecard, recordOutcome } = learningModule;
const getPricing = model => ({ inputCost: model.inputCost, outputCost: model.outputCost, budgetClass: model.budgetClass });

test('a verified failure lowers only that model, role, and task score', () => {
    let scorecard = emptyScorecard();
    scorecard = recordOutcome(scorecard, {
        role: 'coding', taskCategory: 'simple', modelId: 'cheap-a', outcome: 'success', evidenceCode: 'acceptance_passed'
    });
    scorecard = recordOutcome(scorecard, {
        role: 'coding', taskCategory: 'simple', modelId: 'cheap-a', outcome: 'success', evidenceCode: 'acceptance_passed'
    });
    scorecard = recordOutcome(scorecard, {
        role: 'coding', taskCategory: 'simple', modelId: 'cheap-b', outcome: 'failure', evidenceCode: 'acceptance_failed'
    });

    const models = [
        { id: 'cheap-a', name: 'Model A', vendor: 'copilot', inputCost: 10, outputCost: 50, budgetClass: 'low' },
        { id: 'cheap-b', name: 'Model B', vendor: 'copilotcli', inputCost: 12, outputCost: 60, budgetClass: 'low' },
        { id: 'complex-c', name: 'Model C', vendor: 'copilot', inputCost: 200, outputCost: 1000, budgetClass: 'medium' }
    ];
    const recommendations = getModelRecommendations(scorecard, { role: 'coding', taskCategory: 'simple', models, getPricing });

    assert.equal(recommendations.recommendedModelId, 'cheap-a');
    assert.equal(recommendations.candidates.find(model => model.id === 'cheap-a').modelArgument, 'Model A (copilot)');
    assert.equal(recommendations.candidates.find(model => model.id === 'cheap-a').score, 0.75);
    assert.equal(recommendations.candidates.find(model => model.id === 'cheap-b').score, 1 / 3);
    assert.equal(recommendations.candidates.find(model => model.id === 'complex-c').samples, 0);
});

test('explores a priced candidate before evidence is available', () => {
    const scorecard = recordOutcome(emptyScorecard(), {
        role: 'review', taskCategory: 'complex', modelId: 'model-a', outcome: 'failure', evidenceCode: 'incorrect'
    });
    const result = getModelRecommendations(scorecard, {
        role: 'review',
        taskCategory: 'complex',
        models: [{ id: 'model-a', name: 'Model A', vendor: 'copilot', inputCost: 200, outputCost: 1000 }],
        getPricing
    });

    assert.equal(result.recommendedModelId, 'model-a');
    assert.equal(result.selectionMode, 'explore');
});

test('dashboard marks cold-start choices as exploration and then learns from repeated outcomes', () => {
    const models = [{ id: 'model-a', name: 'Model A', vendor: 'copilot', inputCost: 10, outputCost: 50 }];
    let scorecard = recordOutcome(emptyScorecard(), {
        role: 'coding', taskCategory: 'simple', modelId: 'model-a', outcome: 'success', evidenceCode: 'acceptance_passed'
    });
    let row = getLearningDashboard(scorecard, models, getPricing).find(item => item.role === 'coding' && item.taskCategory === 'simple');
    assert.equal(row.recommendedModelId, 'model-a');
    assert.equal(row.candidates.find(model => model.id === 'model-a').selectionMode, 'explore');
    assert.equal(row.sampleCount, 1);

    scorecard = recordOutcome(scorecard, {
        role: 'coding', taskCategory: 'simple', modelId: 'model-a', outcome: 'success', evidenceCode: 'acceptance_passed'
    });
    row = getLearningDashboard(scorecard, models, getPricing).find(item => item.role === 'coding' && item.taskCategory === 'simple');
    assert.equal(row.recommendedModelId, 'model-a');
    assert.equal(row.sampleCount, 2);
    assert.equal(row.candidates.find(model => model.id === 'model-a').selectionMode, 'learned');
});

test('verified repeated failures move simple-task selection from cheap to better-priced alternative', () => {
    let scorecard = emptyScorecard();
    for (let index = 0; index < 3; index += 1) {
        scorecard = recordOutcome(scorecard, {
            role: 'coding', taskCategory: 'simple', modelId: 'cheap', outcome: 'failure', evidenceCode: 'acceptance_failed'
        });
    }
    const models = [
        { id: 'cheap', name: 'Cheap', vendor: 'copilot', inputCost: 10, outputCost: 50 },
        { id: 'balanced', name: 'Balanced', vendor: 'copilot', inputCost: 200, outputCost: 1000 }
    ];
    const result = getModelRecommendations(scorecard, { role: 'coding', taskCategory: 'simple', models, getPricing });
    assert.equal(result.recommendedModelId, 'balanced');
    assert.equal(result.selectionMode, 'explore');
});

test('requires objective evidence and does not persist prompts or outputs', () => {
    assert.throws(() => recordOutcome(emptyScorecard(), {
        role: 'coding', taskCategory: 'simple', modelId: 'model-a', outcome: 'failure'
    }), /objective model-quality failure code/);

    const scorecard = recordOutcome(emptyScorecard(), {
        role: 'coding', taskCategory: 'simple', modelId: 'model-a', outcome: 'failure', evidenceCode: 'incorrect',
        prompt: 'private prompt', response: 'private response'
    });
    assert.deepEqual(Object.keys(scorecard.records[0]).sort(), [
        'evidenceCode', 'modelId', 'outcome', 'recordedAt', 'role', 'taskCategory'
    ]);
    assert.equal(normalizeScorecard(scorecard).records.length, 1);
});