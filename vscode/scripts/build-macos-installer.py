#!/usr/bin/env python3
"""Compila o Fefito e cria uma imagem DMG para este Mac."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile


EDITOR = Path(__file__).resolve().parents[1]
ARCH = platform.machine()


def run(*command: str) -> None:
    print("\n==>", " ".join(command), flush=True)
    subprocess.run(command, cwd=EDITOR, check=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-build", action="store_true", help="Usar o aplicativo já compilado")
    args = parser.parse_args()

    if sys.platform != "darwin" or ARCH not in {"arm64", "x86_64"}:
        raise SystemExit("Este instalador precisa ser gerado em um Mac Intel ou Apple Silicon.")
    if not shutil.which("npm") or not shutil.which("hdiutil") or not shutil.which("ditto"):
        raise SystemExit("Instale Node.js e as ferramentas do macOS antes de compilar.")

    arch = "x64" if ARCH == "x86_64" else ARCH
    if not args.skip_build:
        run("npm", "run", "gulp", f"vscode-darwin-{arch}-min")

    app = EDITOR.parent / f"VSCode-darwin-{arch}" / "Fefito.app"
    if not app.is_dir():
        raise SystemExit(f"A compilação não criou o aplicativo esperado: {app}")

    destination = EDITOR / ".build" / "installers"
    destination.mkdir(parents=True, exist_ok=True)
    dmg = destination / f"Fefito-macOS-{arch}.dmg"

    with tempfile.TemporaryDirectory(prefix="fefito-dmg-", dir=destination) as temporary:
        staging = Path(temporary)
        run("ditto", str(app), str(staging / "Fefito.app"))
        (staging / "Aplicativos").symlink_to("/Applications", target_is_directory=True)
        run(
            "hdiutil", "create", "-volname", "Fefito", "-srcfolder", str(staging),
            "-format", "UDZO", "-ov", str(dmg),
        )

    run("hdiutil", "verify", str(dmg))
    print(f"\nInstalador pronto: {dmg}")
    print(f"SHA-256: {sha256(dmg)}")
    print(f"Tamanho: {dmg.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
