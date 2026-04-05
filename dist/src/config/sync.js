import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../database/db.js';
import { providers } from '../database/schema/providers.js';
import { models, modelVersions } from '../database/schema/models.js';
import { currencies, modelCosts } from '../database/schema/costs.js';
const CostSchema = z.object({
    costPerCall: z.number().default(0),
    costPerPromptToken: z.number().default(0),
    costPerCompletionToken: z.number().default(0),
    costPerHour: z.number().default(0),
    currency: z.string().default('USD'),
    validFrom: z.string().optional(), // ISO date string
});
const ModelSchema = z.object({
    code: z.string(),
    providerModelCode: z.string(),
    extraIdentifier: z.string().optional(),
    costs: z.array(CostSchema).default([]),
});
const ProviderSchema = z.object({
    code: z.string(),
    name: z.string(),
    models: z.array(ModelSchema).default([]),
});
export async function syncProviders() {
    const configDir = path.join(process.cwd(), 'config', 'providers');
    if (!fs.existsSync(configDir)) {
        console.warn(`Config directory ${configDir} does not exist. Skipping provider sync.`);
        return;
    }
    const files = fs.readdirSync(configDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
        const content = fs.readFileSync(path.join(configDir, file), 'utf-8');
        const rawConfig = parse(content);
        const config = ProviderSchema.parse(rawConfig);
        await syncProvider(config);
    }
}
async function syncProvider(config) {
    // 1. Upsert Provider
    let [provider] = await db
        .insert(providers)
        .values({
        code: config.code,
        name: config.name,
    })
        .onConflictDoUpdate({
        target: providers.code,
        set: { name: config.name },
    })
        .returning();
    if (!provider) {
        // If onConflictDoUpdate didn't return anything (e.g. no change), fetch it
        const p = await db.query.providers.findFirst({
            where: eq(providers.code, config.code),
        });
        if (!p)
            throw new Error(`Failed to upsert provider ${config.code}`);
        provider = p;
    }
    for (const modelConfig of config.models) {
        // 2. Upsert Model (the abstract concept)
        let [model] = await db
            .insert(models)
            .values({
            code: modelConfig.code,
        })
            .onConflictDoNothing() // Code is unique
            .returning();
        if (!model) {
            const m = await db.query.models.findFirst({
                where: eq(models.code, modelConfig.code),
            });
            if (!m)
                throw new Error(`Failed to upsert model ${modelConfig.code}`);
            model = m;
        }
        // 3. Upsert Model Version (the specific implementation by the provider)
        let [modelVersion] = await db
            .insert(modelVersions)
            .values({
            modelId: model.id,
            providerId: provider.id,
            providerModelCode: modelConfig.providerModelCode,
            extraIdentifier: modelConfig.extraIdentifier,
        })
            .onConflictDoUpdate({
            target: [modelVersions.providerId, modelVersions.providerModelCode, modelVersions.extraIdentifier],
            set: {
                modelId: model.id, // Ensure it points to the correct model
            },
        })
            .returning();
        if (!modelVersion) {
            const mv = await db.query.modelVersions.findFirst({
                where: and(eq(modelVersions.providerId, provider.id), eq(modelVersions.providerModelCode, modelConfig.providerModelCode), modelConfig.extraIdentifier
                    ? eq(modelVersions.extraIdentifier, modelConfig.extraIdentifier)
                    : undefined),
            });
            if (!mv)
                throw new Error(`Failed to upsert model version for ${modelConfig.code}`);
            modelVersion = mv;
        }
        // 4. Upsert Costs
        for (const costConfig of modelConfig.costs) {
            // Ensure currency exists
            let [currency] = await db
                .insert(currencies)
                .values({
                code: costConfig.currency,
            })
                .onConflictDoNothing()
                .returning();
            if (!currency) {
                const c = await db.query.currencies.findFirst({
                    where: eq(currencies.code, costConfig.currency),
                });
                if (!c)
                    throw new Error(`Failed to upsert currency ${costConfig.currency}`);
                currency = c;
            }
            const validFrom = costConfig.validFrom ? new Date(costConfig.validFrom) : new Date();
            await db
                .insert(modelCosts)
                .values({
                modelVersionId: modelVersion.id,
                currencyId: currency.id,
                costPerCall: costConfig.costPerCall,
                costPerPromptToken: costConfig.costPerPromptToken,
                costPerCompletionToken: costConfig.costPerCompletionToken,
                costPerHour: costConfig.costPerHour,
                validFrom: validFrom,
            })
                .onConflictDoUpdate({
                target: [modelCosts.modelVersionId, modelCosts.validFrom],
                set: {
                    costPerCall: costConfig.costPerCall,
                    costPerPromptToken: costConfig.costPerPromptToken,
                    costPerCompletionToken: costConfig.costPerCompletionToken,
                    costPerHour: costConfig.costPerHour,
                },
            });
        }
    }
}
