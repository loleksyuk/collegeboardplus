# Versioning and GitHub releases

## Required rule

Every new extension version must be committed and pushed to GitHub, tagged, and published as a GitHub release with its installable ZIP before the version is reported as delivered. A local ZIP or a push to `main` alone is not a completed release. Only defer publishing when the user explicitly requests an unpublished build.

## Version and file names

- Use semantic versions: `MAJOR.MINOR.PATCH`. Increment PATCH for fixes, MINOR for new compatible features, and MAJOR for incompatible changes.
- Set `extension/manifest.json` → `version` to the exact version being released.
- Use the exact version for both the Git tag and release title, for example `1.0.3` (no `v` prefix).
- Name the asset `CollegeBoardPlus-Dark-Mode-v1.0.3.zip`.
- Put `manifest.json` at the ZIP root along with all extension files. Exclude HAR captures, screenshots, tests, account data, and development files.

## Release checklist

1. Complete the changes and run the relevant browser regression checks. State whether verification used synthetic fixtures or a live signed-in website.
2. Update the manifest and documentation. Commit and push the source.
3. Build the ZIP from that exact commit's `extension/` directory. Validate its integrity, manifest version, file list, and byte-for-byte match with the tagged source.
4. Tag the tested commit and push the tag. Never point an older version at newer code.
5. Publish the GitHub release in `loleksyuk/collegeboardplus` with the matching title and ZIP attached. When publishing multiple versions, mark only the newest as Latest.
6. Include changes, installation/update instructions, verification results, and known limitations in the release notes. Link related issues where relevant.
7. Read back the published release. Confirm it is not a draft, the tag points to the expected commit, and the uploaded asset name, size, and SHA-256 match the local ZIP.
8. Give the user the GitHub release link, not just a local file link.

## Published history

Preserve existing tags and release assets. Ship later fixes as a new version rather than replacing a published build, unless the user explicitly requests replacement. When backfilling a missed release, use that version's historical source commit and matching ZIP, then complete the same verification checklist.
