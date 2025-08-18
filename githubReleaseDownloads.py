import requests
from pathlib import Path
import json
from typing import TypedDict
from concurrent.futures import ThreadPoolExecutor, Future, wait
import hashlib

Assest = TypedDict(
    "Assest",
    {
        "url": str,
        "id": int,
        "node_id": str,
        "name": str,
        "label": None | str,
        "content_type": str,
        "state": str,
        "size": int,
        "digest": str,
        "download_count": int,
        "created_at": str,
        "updated_at": str,
        "browser_download_url": str,
    },
)

OWNER = "kuankuan2007"
REPO = "cpython-build"
SAVE_AT = Path("E:\\工具包\\python\\self-build")
PROXIES = {
    "http": "http://username:password@proxy_ip:proxy_port",
    "https": "https://username:password@proxy_ip:proxy_port",
}

req = requests.sessions.Session()
req.proxies = PROXIES

datas = requests.get(
    f"https://api.github.com/repos/{OWNER}/{REPO}/releases", timeout=60
).json()

logs: list[str] = []


def printLog(s: str):
    """
    Print a log message.
    """
    logs.append(s)


def checkHash(path: Path, digest: str, data: str) -> bool:
    """
    Check if the file at path has the same hash as the data.
    """
    with path.open("rb") as f:
        h = hashlib.file_digest(f, digest)
    if h.hexdigest() == data:
        return True
    return False


def syncAssets(
    path: Path,
    asset: Assest,
):
    """
    Sync an asset to a path.
    """
    while True:
        if path.exists():
            printLog(f"Asset {path} already exists, checking for hash...")
            digest, data = asset["digest"].split(":", 1)
            if checkHash(path, digest, data):
                printLog(f"Asset {path} is up to date.")
                return

            printLog(f"Asset {path} was changed, downloading...")
        printLog(f"Downloading asset {asset['browser_download_url']} to {path}...")
        res = req.get(
            asset["browser_download_url"], stream=True, timeout=60, allow_redirects=True
        )
        res.raise_for_status()
        with path.open("wb") as f:
            for chunk in res.iter_content(chunk_size=1024 * 5):
                f.write(chunk)
        printLog(f"Downloaded asset {asset['browser_download_url']} to {path}.")


pool = ThreadPoolExecutor(max_workers=10, )
flist: list[Future] = []

for i in datas:
    showname=i["name"] or i["tag_name"]
    now = SAVE_AT / showname
    if not now.exists():
        now.mkdir(parents=True, exist_ok=True)
    with open(now / "_release_info.json", "w", encoding="utf-8") as f:
        json.dump(i, f, indent=4, ensure_ascii=False)

    for j in i["assets"]:
        flist.append(pool.submit(syncAssets, now / j["name"], j))

wait(flist, return_when="ALL_COMPLETED")
pool.shutdown()
print("Done")
