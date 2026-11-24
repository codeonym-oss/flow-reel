- 2026-11-20: started the ticket; grilling.
- 2026-11-23: grilled (decisions 001-003) and drafted.
- 2026-11-24: created issue #101 and renamed the folder.
- 2026-11-24: decision 004 supersedes 003 (wrong premise); draft updated; ticket pass done, impl.md written.
- 2026-11-24: building on `feat/101-cloud-image`. impl.md corrected: sounds and fonts stay out of `base`, and one cache
  scope per architecture is enough because the full build exports the cloud stage's layers too.
- 2026-11-24: opened https://github.com/codeonym-oss/flow-reel/pull/102 for the runtime; the plugin follows.
- 2026-11-24: decision 005: the plugin merges before the release, and one release PR ships both; draft and impl.md updated.
- 2026-11-24: the plugin's tests follow in a third, `test:` pull request.
- 2026-11-24: merged #102 (runtime), #104 (plugin) and #105 (its tests); released runtime 0.7.0 and plugin 0.8.0 (#103).
  Published: the full image is 3.57 GB compressed on amd64 and the cloud image 1.02 GB. Done.
