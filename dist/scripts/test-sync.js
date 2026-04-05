import { eq } from 'drizzle-orm';
async function run() {
    process.env['AI_TESTER_PROVIDERS_DIR'] = '.local/ai-evals-data/providers';
    process.env['AI_TESTER_MODELS_DIR'] = '.local/ai-evals-data/models';
    const { updateProvidersInDb } = await import('../src/main/providers.js');
    const { db } = await import('../src/database/db.js');
    const { providers } = await import('../src/database/schema/providers.js');
    const { models, modelVersions } = await import('../src/database/schema/models.js');
    const { modelCosts } = await import('../src/database/schema/costs.js');
    console.log('Starting sync...');
    await updateProvidersInDb();
    console.log('Sync complete.');
    const provider = await db.query.providers.findFirst({
        where: eq(providers.code, 'openai'),
    });
    if (!provider) {
        console.error('FAIL: OpenAI provider not found');
        process.exit(1);
    }
    console.log('PASS: OpenAI provider found');
    const model = await db.query.models.findFirst({
        where: eq(models.code, 'gpt-4o'),
    });
    if (!model) {
        console.error('FAIL: gpt-4o model not found');
        process.exit(1);
    }
    console.log('PASS: gpt-4o model found');
    const version = await db.query.modelVersions.findFirst({
        where: eq(modelVersions.modelId, model.id),
    });
    if (!version) {
        console.error('FAIL: gpt-4o model version not found');
        process.exit(1);
    }
    console.log('PASS: gpt-4o model version found');
    const costs = await db.query.modelCosts.findMany({
        where: eq(modelCosts.modelVersionId, version.id),
    });
    if (costs.length === 0) {
        console.error('FAIL: No costs found for gpt-4o');
        process.exit(1);
    }
    console.log(`PASS: Found ${costs.length} cost records for gpt-4o`);
    const anthropicProvider = await db.query.providers.findFirst({
        where: eq(providers.code, 'vertex_anthropic'),
    });
    if (!anthropicProvider) {
        console.error('FAIL: Vertex Anthropic provider not found');
        process.exit(1);
    }
    console.log('PASS: Vertex Anthropic provider found');
    console.log('All checks passed!');
    process.exit(0);
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
