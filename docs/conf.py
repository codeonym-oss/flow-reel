"""Sphinx configuration: MyST pages, Shibuya theme."""

import json
import os
from pathlib import Path

project = "flow-reel"
author = "codeonym-oss"
copyright = "codeonym-oss — MIT License"
release = json.loads((Path(__file__).parent.parent / "package.json").read_text())["version"]
version = ".".join(release.split(".")[:2])

extensions = ["myst_parser", "sphinx_design"]
# demos/ holds the scripts of the reels shown in these docs, not pages.
exclude_patterns = ["_build", "demos"]

# Pages: Markdown, with ```{directive} blocks and `#heading` anchors for links.
myst_enable_extensions = ["colon_fence", "deflist"]
myst_heading_anchors = 3

html_theme = "shibuya"
html_title = "flow-reel"
html_static_path = ["_static"]
# Read the Docs serves each version under /en/<version>/ and passes its URL in; the fallback is
# `stable`, so a local build never points canonical links at a path that 404s.
html_baseurl = os.environ.get(
    "READTHEDOCS_CANONICAL_URL", "https://docs.codeonym.work/projects/flow-reel/en/stable/"
)
html_context = {
    "source_type": "github",
    "source_user": "codeonym-oss",
    "source_repo": "flow-reel",
    "source_version": "main",
    "source_docs_path": "/docs/",
}
html_theme_options = {
    "accent_color": "indigo",
    "github_url": "https://github.com/codeonym-oss/flow-reel",
    "nav_links": [
        {"title": "Quickstart", "url": "getting-started/quickstart"},
        {"title": "With Claude", "url": "tutorials/with-claude"},
        {"title": "Reference", "url": "reference/script-api"},
        {"title": "npm", "url": "https://www.npmjs.com/package/flow-reel", "external": True},
    ],
}
