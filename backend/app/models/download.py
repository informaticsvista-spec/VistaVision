"""Download and verify the pretrained model files.

Usage (from the backend/ folder):

    python -m app.models.download            # download anything missing
    python -m app.models.download --verify   # only check files that already exist
    python -m app.models.download --force    # re-download everything
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

from app.config import settings
from app.models.manifest import MODELS, ModelSpec


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_valid(spec: ModelSpec, directory: Path) -> bool:
    path = directory / spec.filename
    return path.is_file() and sha256_of(path) == spec.sha256


def download(spec: ModelSpec, directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / spec.filename
    partial = target.with_suffix(target.suffix + ".part")
    print(f"  downloading {spec.filename} ...", flush=True)
    request = urllib.request.Request(spec.url, headers={"User-Agent": "VistaVision/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as out:
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
    if sha256_of(partial) != spec.sha256:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Checksum mismatch for {spec.filename}; the download was discarded.")
    partial.replace(target)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download even if the file is valid")
    parser.add_argument("--verify", action="store_true", help="verify existing files, download nothing")
    args = parser.parse_args(argv)

    directory = settings.weights_dir
    print(f"Model directory: {directory}")
    failed = False
    for spec in (m for m in MODELS.values() if not m.bundled):
        ok = is_valid(spec, directory)
        if args.verify:
            print(f"  [{'ok' if ok else 'MISSING/INVALID'}] {spec.filename}  ({spec.purpose})")
            failed |= not ok
            continue
        if ok and not args.force:
            print(f"  [ok] {spec.filename} already present")
            continue
        try:
            download(spec, directory)
            print(f"  [ok] {spec.filename}")
        except Exception as error:  # noqa: BLE001 - report every failure, keep going
            failed = True
            print(f"  [FAILED] {spec.filename}: {error}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
