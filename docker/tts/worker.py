"""One model load, serial clips, fixed CPU generation; JSON stdin/stdout for the TS adapter."""
import contextlib
import json
import random
import resource
import sys
import time

START = time.monotonic()
MAX_TOKENS = 1024


def synthesize(jobs):
    # Upstream prints optional-dependency notices to stdout; keep our JSON channel clean.
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import soundfile as sf
        import torch
        from qwen_tts import Qwen3TTSModel

        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        torch.use_deterministic_algorithms(True)
        model = Qwen3TTSModel.from_pretrained(
            "/opt/flow-reel/tts-model", device_map="cpu", dtype=torch.float32,
            attn_implementation="eager", local_files_only=True,
        )
        model.model.eval()
        # The pinned official wrapper discards codec counts before returning WAVs.
        # Check those counts at its generation boundary to reject token-limit truncation.
        generate = model.model.generate

        def checked_generate(**kwargs):
            codes, hidden = generate(**kwargs)
            if any(len(code) >= MAX_TOKENS - 1 for code in codes):
                raise RuntimeError("speech reached its generation limit; shorten this step's narration")
            return codes, hidden

        model.model.generate = checked_generate
        for job in jobs:
            try:
                random.seed(0)
                np.random.seed(0)
                torch.manual_seed(0)
                wavs, rate = model.generate_custom_voice(
                    text=job["text"], speaker="Ryan", language="English", non_streaming_mode=True,
                    do_sample=True, top_k=50, top_p=1.0, temperature=0.9, repetition_penalty=1.05,
                    subtalker_dosample=True, subtalker_top_k=50, subtalker_top_p=1.0,
                    subtalker_temperature=0.9, max_new_tokens=MAX_TOKENS,
                )
                if not len(wavs[0]) or not np.isfinite(wavs[0]).all():
                    raise RuntimeError("speech was empty or invalid")
                sf.write(job["file"], wavs[0], rate, subtype="PCM_16")
            except Exception as error:
                raise RuntimeError(f"step {job['index']}: {error}") from error


if __name__ == "__main__":
    try:
        jobs = json.load(sys.stdin)
        synthesize(jobs)
        print(json.dumps({"clips": len(jobs)}))
        print(json.dumps({"ttsSeconds": round(time.monotonic() - START, 3),
                          "peakMemoryKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}), file=sys.stderr)
    except Exception as error:
        print(f"Qwen TTS: {error}", file=sys.stderr)
        sys.exit(1)
