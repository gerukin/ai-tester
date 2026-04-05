import { db } from '../src/database/db.js'
import { modelVersions } from '../src/database/schema/models.js'
import { updateProvidersInDb } from '../src/main/providers.js'

async function getDuplicateCount() {
    const allVersions = await db.select().from(modelVersions)
    const duplicates = allVersions.filter((v, i, self) =>
        self.findIndex(t => t.providerId === v.providerId && t.providerModelCode === v.providerModelCode && t.extraIdentifier === v.extraIdentifier) !== i
    )
    return duplicates.length
}

async function run() {
	console.log('Checking for duplicates...')

	const initialCount = await getDuplicateCount()
	console.log(`Initial duplicate count: ${initialCount}`)

	// Run sync once
	await updateProvidersInDb()

	const midCount = await getDuplicateCount()
	console.log(`Duplicate count after 1st sync: ${midCount}`)

	// Run sync again
	await updateProvidersInDb()

	const finalCount = await getDuplicateCount()
	console.log(`Duplicate count after 2nd sync: ${finalCount}`)

	if (finalCount > initialCount) {
		console.error(`FAIL: Duplicates increased by ${finalCount - initialCount}!`)
		process.exit(1)
	}

	console.log('PASS: No new duplicates created.')
	process.exit(0)
}

run().catch(err => {
	console.error(err)
	process.exit(1)
})
