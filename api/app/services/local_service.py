import os
from typing import Optional
from mutagen import File as MutagenFile
from mutagen.id3 import ID3NoHeaderError

SUPPORTED_FORMATS = {".mp3", ".flac", ".ogg", ".m4a", ".wav", ".aac", ".wma", ".opus"}


def scan_folder(folder_path: str) -> list[dict]:
    """Walk folder_path and return a list of track dicts with metadata."""
    tracks = []
    for root, _, files in os.walk(folder_path):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in SUPPORTED_FORMATS:
                continue
            full_path = os.path.join(root, filename)
            track = _parse_file(full_path, filename, ext)
            if track:
                tracks.append(track)
    return tracks


def _parse_file(path: str, filename: str, ext: str) -> Optional[dict]:
    try:
        audio = MutagenFile(path, easy=True)
    except Exception:
        return None

    if audio is None:
        return None

    def get_tag(key: str) -> Optional[str]:
        val = audio.get(key)
        return val[0] if val else None

    title = get_tag("title") or os.path.splitext(filename)[0]
    artist = get_tag("artist") or "Unknown"
    album = get_tag("album")

    duration_ms = None
    if hasattr(audio, "info") and audio.info:
        duration_ms = int(audio.info.length * 1000)

    bitrate = None
    if hasattr(audio, "info") and hasattr(audio.info, "bitrate"):
        bitrate = audio.info.bitrate

    return {
        "title": title,
        "artist": artist,
        "artists_json": [artist],
        "album": album,
        "duration_ms": duration_ms,
        "local_path": path,
        "local_filename": filename,
        "local_format": ext.lstrip("."),
        "local_bitrate": bitrate,
        "genres_json": [],
    }
