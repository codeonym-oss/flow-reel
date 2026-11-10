"""Build-time only: fetch immutable model assets and verify their published hashes."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

from huggingface_hub import hf_hub_download

ROOT = Path("/opt/flow-reel/tts-model")
manifest = json.loads(Path(__file__).with_name("assets.json").read_text())
for asset in manifest["files"]:
    path = Path(hf_hub_download(manifest["repository"], asset["file"], revision=manifest["revision"], local_dir=ROOT))
    digest = hashlib.sha256() if asset["algorithm"] == "sha256" else hashlib.sha1()
    if asset["algorithm"] == "git-blob-sha1":
        digest.update(f"blob {asset['size']}\0".encode())
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    if path.stat().st_size != asset["size"] or digest.hexdigest() != asset["hash"]:
        raise RuntimeError(f"model asset verification failed: {asset['file']}")

# The checkpoint is Apache-2.0; retain its model card and the upstream runtime licence.
for filename, url in {
    "MODEL_CARD.md": f"https://huggingface.co/{manifest['repository']}/resolve/{manifest['revision']}/README.md",
    "LICENSE": "https://raw.githubusercontent.com/QwenLM/Qwen3-TTS/022e286b98fbec7e1e916cb940cdf532cd9f488e/LICENSE",
}.items():
    with urlopen(url) as response:
        (ROOT / filename).write_bytes(response.read())
