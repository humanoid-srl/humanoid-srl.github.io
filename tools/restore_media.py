"""Restore verified release videos into the static website before deployment."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


class References(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('src', 'href', 'poster', 'data-src') or not value:
                continue
            url = urlsplit(value)
            if not url.scheme and not url.netloc and url.path:
                target = SITE / unquote(url.path)
                if not target.is_file():
                    raise ValueError(f'Missing website resource: {value}')


def main(archive):
    manifest = json.loads((ROOT / 'media-manifest.json').read_text())
    if sha256(archive) != manifest['sha256']:
        raise ValueError('Video archive checksum does not match the reviewed version')
    expected = {v['path']: v for v in manifest['videos']}
    with zipfile.ZipFile(archive) as media:
        if len(media.namelist()) != len(expected) or set(media.namelist()) != set(expected):
            raise ValueError('Video archive has missing, extra, or duplicate files')
        for name, item in expected.items():
            path = Path(name)
            if path.is_absolute() or '..' in path.parts or path.suffix != '.mp4' or path.parts[0] != 'assets':
                raise ValueError(f'Unexpected video path: {name}')
            target = SITE / path
            target.parent.mkdir(parents=True, exist_ok=True)
            with media.open(name) as src, target.open('wb') as dest:
                shutil.copyfileobj(src, dest)
            if target.stat().st_size != item['bytes'] or sha256(target) != item['sha256']:
                raise ValueError(f'Video checksum mismatch: {name}')
    for page in SITE.glob('*.html'):
        References().feed(page.read_text())
    files = list(SITE.rglob('*'))
    if any(p.is_symlink() for p in files):
        raise ValueError('Pages artifact must not contain symlinks')
    total = sum(p.stat().st_size for p in files if p.is_file())
    if total >= 1_000_000_000:
        raise ValueError('Website exceeds the GitHub Pages size limit')
    print(f'Verified {len(expected)} unchanged videos and HTML resource paths; website size {total / 1e6:.1f} MB.')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
