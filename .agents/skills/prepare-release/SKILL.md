---
name: prepare-release
description: Prepare ai-tester releases, version bumps, changelog updates, npm run publish:{type} runs, release tags, and missing-tag recovery. Use when asked to release ai-tester, choose a patch/minor/major version, update the changelog for a release, publish a package version, push release tags, or create a missing vX.Y.Z tag for an already-versioned release.
---

# Prepare Release

Use this skill when preparing or repairing an `ai-tester` release. Keep the workflow conservative: inspect first, ask before release mutations, and include only developer-facing package changes in release notes.

## Release Invariants

- Treat `package.json`, `CHANGELOG.md`, and git tags as the release sources of truth.
- Treat `skills/ai-tester/SKILL.md` as user-facing guidance for consuming projects, not contributor guidance for this library repo.
- Before release, check whether `skills/ai-tester/SKILL.md` fully reflects recent user-facing package, CLI, docs, config, migration, and workflow changes.
- Use `vX.Y.Z` for git tags and changelog commit messages.
- Use `X.Y.Z` without `v` for `CHANGELOG.md` headings.
- Prefer the latest `vX.Y.Z` tag as the release baseline.
- Require a clean working tree before changing the changelog, running `npm run publish:{type}`, creating tags, or pushing.
- Do not include internal-only refactors, formatting, test-only changes, or tooling churn in the changelog unless they affect package users.

## Normal Release Workflow

Follow this sequence exactly.

1. Read the current state:
   - `package.json` for the current version and publish scripts
   - `CHANGELOG.md` for the existing Keep a Changelog format and compare links
   - `git tag --list --sort=-version:refname` for existing `vX.Y.Z` tags
   - `git status --short --branch` to confirm the working tree state
2. If the working tree has uncommitted changes, stop and ask the user whether those changes should be handled first. Do not ignore them silently.
3. Identify the latest release tag, then inspect full commits since it:

   ```sh
   git log <latest-v-tag>..HEAD
   ```

4. Classify each commit by user impact:
   - include new package features, behavior changes, bug fixes, migration-impacting changes, and user-facing docs changes
   - exclude refactors, code style, test harness work, build output churn, and other internal-only changes
5. Recommend exactly one semantic version bump: `patch`, `minor`, or `major`.
6. Ask the user to confirm the bump before publishing. It is acceptable to update a changelog draft before confirmation, but do not run `npm run publish:{type}` until the user confirms.
7. Update `CHANGELOG.md` using the existing format:
   - add `## [X.Y.Z] - YYYY-MM-DD`
   - move relevant `Unreleased` bullets into the new version section
   - keep remaining unreleased bullets under `## [Unreleased]`
   - update the `[Unreleased]` compare link to `https://github.com/gerukin/ai-tester/compare/vX.Y.Z...HEAD`
   - add the new `[X.Y.Z]` compare link from the previous release tag to `vX.Y.Z`
8. Commit only the changelog release preparation change:

   ```sh
   git add CHANGELOG.md
   git commit -m "docs: update changelog for vX.Y.Z"
   ```

9. Run the confirmed publish script:

   ```sh
   npm run publish:patch
   # or: npm run publish:minor
   # or: npm run publish:major
   ```

   The publish script compiles and runs `npm version`, which updates package version files, creates the version commit, and creates the release tag.
10. Push commits first, then tags:

    ```sh
    git push
    git push --tags
    ```

If any command fails, stop, report the failure, and do not continue to later release steps until the failure is understood.

## Missing-Tag Catch-Up Workflow

Use this path only when the package has already been versioned but the corresponding git tag is missing.

1. Confirm the intended version:
   - read `package.json` for `X.Y.Z`
   - verify `CHANGELOG.md` already contains `## [X.Y.Z] - YYYY-MM-DD`
   - verify `CHANGELOG.md` compare links already reference the intended release
2. Confirm `vX.Y.Z` is missing:

   ```sh
   git tag --list vX.Y.Z
   ```

3. Confirm the working tree is clean:

   ```sh
   git status --short --branch
   ```

4. Verify the target commit contains the released state. Usually this is `HEAD`; if the user identifies another commit, inspect that commit before tagging.
5. Do not rerun `npm version`, do not run `npm run publish:{type}`, and do not rewrite the changelog in catch-up mode.
6. Create the missing annotated tag:

   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z"
   ```

7. Push only the missing tag:

   ```sh
   git push origin vX.Y.Z
   ```

If any source of truth disagrees, stop and explain the mismatch instead of guessing which version to tag.

## Output Template

Use this structure when reporting release work:

1. `Release mode`: normal release or missing-tag catch-up
2. `Baseline`: latest tag and commit range inspected
3. `Recommendation`: patch, minor, major, or tag-only repair
4. `Changelog`: changes made or still needed
5. `Commands`: commands run or proposed
6. `Push/tag status`: what was pushed, what remains, or why the workflow stopped
