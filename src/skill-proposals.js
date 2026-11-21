const { randomUUID } = require('node:crypto');

const SKILL_PROPOSALS_KEY = 'agentRoster.skillProposals.v1';
const LIMITS = { name: 64, description: 1024, body: 20_000, rationale: 1_000, pending: 20 };
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Single-line text must be free of every control and Unicode line separator.
const LINE_BREAKING = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const BODY_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

let queue = Promise.resolve();
// Serializes read-modify-write cycles on the stored list so concurrent tool calls and UI actions cannot lose updates.
function serialize(task) {
    const result = queue.then(task);
    queue = result.catch(() => { });
    return result;
}

function normalizeDraft(input) {
    const source = input && typeof input === 'object' ? input : {};
    const text = value => typeof value === 'string' ? value : undefined;
    return {
        name: text(source.name)?.trim(),
        description: text(source.description)?.trim(),
        body: text(source.body)?.replace(/\r\n?/g, '\n').trim(),
        rationale: source.rationale === undefined ? '' : text(source.rationale)?.replace(/\r\n?/g, '\n').trim()
    };
}

// Returns every problem at once so a caller can fix a draft in one pass.
function validateDraft(input, { reservedNames = [], otherNames = [] } = {}) {
    const value = normalizeDraft(input);
    const errors = [];
    if (!value.name) errors.push('Skill name is required.');
    else if (value.name.length > LIMITS.name || !SKILL_NAME.test(value.name)) {
        errors.push(`Skill name must be lowercase letters, digits and single hyphens, at most ${LIMITS.name} characters.`);
    } else if (reservedNames.includes(value.name)) errors.push(`Skill name "${value.name}" belongs to a packaged skill.`);
    else if (otherNames.includes(value.name)) errors.push(`Skill name "${value.name}" is already used by a pending proposal.`);
    if (!value.description) errors.push('Description is required.');
    else if (value.description.length > LIMITS.description) errors.push(`Description must be at most ${LIMITS.description} characters.`);
    else if (LINE_BREAKING.test(value.description)) errors.push('Description must be a single line without control characters.');
    if (!value.body) errors.push('Instructions are required.');
    else if (value.body.length > LIMITS.body) errors.push(`Instructions must be at most ${LIMITS.body} characters.`);
    else if (BODY_CONTROL.test(value.body)) errors.push('Instructions contain unsupported control characters.');
    if (value.rationale === undefined) errors.push('Rationale must be text.');
    else if (value.rationale.length > LIMITS.rationale) errors.push(`Rationale must be at most ${LIMITS.rationale} characters.`);
    else if (BODY_CONTROL.test(value.rationale)) errors.push('Rationale contains unsupported control characters.');
    return { ok: errors.length === 0, errors, value };
}

// The description is written as a JSON string, which is a valid YAML double-quoted scalar.
function buildSkillMarkdown({ name, description, body }) {
    return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;
}

// Re-reads the generated text the way a skill loader would and confirms it still matches the approved draft.
function validateSkillMarkdown(text, expected) {
    const errors = [];
    const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(text);
    if (!match) return { ok: false, errors: ['Generated SKILL.md has no valid frontmatter.'] };
    const lines = match[1].split('\n');
    const nameLine = lines.length === 2 && lines[0].startsWith('name: ') ? lines[0].slice(6) : undefined;
    let description;
    try {
        description = lines[1]?.startsWith('description: ') ? JSON.parse(lines[1].slice(13)) : undefined;
    } catch {
        description = undefined;
    }
    if (nameLine !== expected.name || !SKILL_NAME.test(nameLine || '')) errors.push('Generated SKILL.md name does not match the approved name.');
    if (description !== expected.description) errors.push('Generated SKILL.md description does not match the approved description.');
    if (match[2].trim() !== expected.body) errors.push('Generated SKILL.md instructions do not match the approved instructions.');
    return { ok: errors.length === 0, errors };
}

function toStored(entry) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id) return undefined;
    const checked = validateDraft(entry);
    if (!checked.ok) return undefined;
    const timestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : new Date(0).toISOString();
    return { id: entry.id, ...checked.value, createdAt: timestamp(entry.createdAt), updatedAt: timestamp(entry.updatedAt) };
}

function listProposals(store) {
    const stored = store.get(SKILL_PROPOSALS_KEY);
    return Array.isArray(stored) ? stored.map(toStored).filter(Boolean).slice(0, LIMITS.pending) : [];
}

function save(store, proposals) {
    return store.update(SKILL_PROPOSALS_KEY, proposals.length ? proposals : undefined);
}

function submitProposal(store, input, options = {}) {
    return serialize(async () => {
        const proposals = listProposals(store);
        if (proposals.length >= LIMITS.pending) {
            return { ok: false, errors: [`There are already ${LIMITS.pending} pending proposals. Ask the user to review them first.`] };
        }
        const checked = validateDraft(input, { reservedNames: options.reservedNames, otherNames: proposals.map(proposal => proposal.name) });
        if (!checked.ok) return { ok: false, errors: checked.errors };
        const now = new Date().toISOString();
        const proposal = { id: randomUUID(), ...checked.value, createdAt: now, updatedAt: now };
        await save(store, [...proposals, proposal]);
        return { ok: true, proposal };
    });
}

function updateProposal(store, id, edits, options = {}) {
    return serialize(async () => {
        const proposals = listProposals(store);
        const current = proposals.find(proposal => proposal.id === id);
        if (!current) return { ok: false, errors: ['The proposal no longer exists.'] };
        const checked = validateDraft({ ...current, ...edits }, {
            reservedNames: options.reservedNames,
            otherNames: proposals.filter(proposal => proposal.id !== id).map(proposal => proposal.name)
        });
        if (!checked.ok) return { ok: false, errors: checked.errors };
        const proposal = { ...current, ...checked.value, updatedAt: new Date().toISOString() };
        await save(store, proposals.map(entry => entry.id === id ? proposal : entry));
        return { ok: true, proposal };
    });
}

function dismissProposal(store, id) {
    return serialize(async () => {
        const proposals = listProposals(store);
        if (!proposals.some(proposal => proposal.id === id)) return { ok: false, errors: ['The proposal no longer exists.'] };
        await save(store, proposals.filter(proposal => proposal.id !== id));
        return { ok: true };
    });
}

// Validates the draft with any pending edits applied; nothing is stored or written.
function prepareAcceptance(store, id, edits, options = {}) {
    const proposals = listProposals(store);
    const current = proposals.find(proposal => proposal.id === id);
    if (!current) return { ok: false, errors: ['The proposal no longer exists.'] };
    const checked = validateDraft({ ...current, ...edits }, {
        reservedNames: options.reservedNames,
        otherNames: proposals.filter(proposal => proposal.id !== id).map(proposal => proposal.name)
    });
    if (!checked.ok) return { ok: false, errors: checked.errors };
    const markdown = buildSkillMarkdown(checked.value);
    const generated = validateSkillMarkdown(markdown, checked.value);
    if (!generated.ok) return { ok: false, errors: generated.errors };
    return { ok: true, value: checked.value, markdown };
}

// Runs write() and removes the proposal in one serialized step; the proposal is kept when write() throws.
function completeAcceptance(store, id, write) {
    return serialize(async () => {
        const proposals = listProposals(store);
        if (!proposals.some(proposal => proposal.id === id)) return { ok: false, errors: ['The proposal no longer exists.'] };
        await write();
        await save(store, proposals.filter(proposal => proposal.id !== id));
        return { ok: true };
    });
}

module.exports = {
    buildSkillMarkdown,
    completeAcceptance,
    dismissProposal,
    LIMITS,
    listProposals,
    prepareAcceptance,
    SKILL_PROPOSALS_KEY,
    submitProposal,
    updateProposal,
    validateDraft,
    validateSkillMarkdown
};
