#!/usr/bin/env -S node --no-warnings
import { runMigrations } from '../src/cli/actions.js'

await runMigrations()
