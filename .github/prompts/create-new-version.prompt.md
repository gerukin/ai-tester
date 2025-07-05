Follow these steps carefully to update the changelog:

1. Read the [changelog](/CHANGELOG.md) to understand it.
2. Make sure there are no outstanding uncommitted changes (ask me whether to ignore them, if any).
3. Then get the most recent commits since the last release (use `git log {current}..HEAD`).
4. Propose a new version (type: `patch`, `minor`, or `major`) based on the changes and ask me to confirm it. (but do NOT run `npm run publish:{type}` yet!)
5. Update the changelog based on the new commits. Remember to observe the same format as the existing entries. (do not forget to update the Unreleased link)
6. Once I have confirmed, commit the changelog changes as `docs: update changelog for vX.Y.Z` where `X.Y.Z` is the new version number.
7. Run the appropriate `npm run publish:{type}` command to publish the new version.
8. Push the changes and tags to the remote repository.

> [!NOTE]
> In the changelog we only care about the changes that are relevant to the end user. The end user in this case is a developer using the library. Don't include internal changes that do not affect the end user, such as refactoring, code style changes, or other non-user-facing changes.
