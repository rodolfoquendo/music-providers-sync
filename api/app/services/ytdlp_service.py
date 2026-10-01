import os
import re
import time
from datetime import date
from typing import Optional
import yt_dlp
from mutagen.easyid3 import EasyID3
from mutagen.id3 import ID3NoHeaderError
from mutagen import File as MutagenFile
from ..config import get_settings

AUDIO_FORMAT = "mp3"
AUDIO_QUALITY = "128"  # kbps; yt-dlp/ffmpeg transcodes to this whatever the source stream is


def _clean(name: str, fallback: str) -> str:
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", name or "").strip().strip(".")
    return name or fallback


def target_path(track) -> str:
    """<MUSIC_LOCAL_PATH>/<artist>/<year> - <album>/<title>.mp3"""
    artists = track.artists_json if isinstance(track.artists_json, list) and track.artists_json else None
    artist = _clean(artists[0] if artists else track.artist, "Unknown Artist")
    album = _clean(track.album, "Unknown Album")
    if track.release_date:
        album = f"{track.release_date.year} - {album}"
    title = _clean(track.title, "Unknown Title")
    return os.path.join(get_settings().music_local_path, artist, album, f"{title}.{AUDIO_FORMAT}")


def _download_with_retries(opts: dict, url: str, attempts: int = 3):
    # YouTube intermittently serves a format list without audio ("Requested format is not available"); a retry usually works.
    for attempt in range(1, attempts + 1):
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            return
        except yt_dlp.utils.DownloadError:
            if attempt == attempts:
                raise
            time.sleep(3 * attempt)


def download_track(track, youtube_id: str) -> dict:
    """Download youtube_id as a 128 kbps mp3 at target_path(track) and tag it. Returns Track local_* fields."""
    path = target_path(track)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if not os.path.exists(path):
        base = path[: -len(f".{AUDIO_FORMAT}")].replace("%", "%%")
        opts = {
            "format": "bestaudio/best",
            "outtmpl": base + ".%(ext)s",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "postprocessors": [
                {"key": "FFmpegExtractAudio", "preferredcodec": AUDIO_FORMAT, "preferredquality": AUDIO_QUALITY},
            ],
        }
        _download_with_retries(opts, f"https://www.youtube.com/watch?v={youtube_id}")
        if not os.path.exists(path):
            raise RuntimeError(f"yt-dlp did not produce {path}")

    _write_tags(path, track)

    bitrate = None
    audio = MutagenFile(path)
    if audio is not None and getattr(audio, "info", None):
        bitrate = getattr(audio.info, "bitrate", None)

    return {
        "local_path": path,
        "local_filename": os.path.basename(path),
        "local_format": AUDIO_FORMAT,
        "local_bitrate": bitrate,
    }


def _write_tags(path: str, track):
    # Tag from DB metadata so a later /local/scan keeps the same title/artist.
    try:
        tags = EasyID3(path)
    except ID3NoHeaderError:
        tags = EasyID3()
    tags["title"] = track.title
    tags["artist"] = track.artist
    if track.album:
        tags["album"] = track.album
    if track.release_date:
        tags["date"] = str(track.release_date.year)
    tags.save(path)


_NOISE = re.compile(
    r"\s*[\(\[]\s*(?:official[^)\]]*|lyrics?[^)\]]*|audio[^)\]]*|video[^)\]]*|hd|hq|4k|visuali[sz]er)\s*[\)\]]",
    re.IGNORECASE,
)
_ARTIST_TITLE = re.compile(r"^(.+?)\s+[-\u2013\u2014]\s+(.+)$")


def fetch_metadata(video_id: str) -> dict:
    """Best-effort Track fields for a YouTube video, without downloading it."""
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

    title = info.get("track") or info.get("title") or video_id
    artist = info.get("artist") or ", ".join(info.get("artists") or [])
    if not artist:
        m = None if info.get("track") else _ARTIST_TITLE.match(title)
        if m:
            artist, title = m.group(1), m.group(2)
        else:
            artist = re.sub(r"\s*-\s*Topic$", "", info.get("channel") or info.get("uploader") or "Unknown")
    title = _NOISE.sub("", title).strip() or video_id
    artist = artist.strip() or "Unknown"

    release = None
    try:
        if info.get("release_year"):
            release = date(int(info["release_year"]), 1, 1)
        elif info.get("upload_date"):
            u = info["upload_date"]
            release = date(int(u[:4]), int(u[4:6]), int(u[6:8]))
    except (ValueError, TypeError):
        pass

    return {
        "title": title[:500],
        "artist": artist[:500],
        "artists_json": [a.strip() for a in artist.split(",")] if info.get("artist") else [artist],
        "album": info.get("album"),
        "duration_ms": int(info["duration"] * 1000) if info.get("duration") else None,
        "release_date": release,
        "cover_url": info.get("thumbnail"),
    }
