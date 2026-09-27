"""Local-only web API. Core calculations remain independent of FastAPI."""

import json
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from capacity_engine import calculate, compare_benchmark, __version__
from capacity_engine.rules import SPECS
from capacity_web.migration import calculate_migration, catalog
from capacity_web.optimization import calculate_optimization

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 2 * 1024 * 1024
app = FastAPI(title="Capacity Agent", version="0.1.0", docs_url=None, redoc_url=None)
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"]
)


def read_json(path):
    return json.loads((ROOT / path).read_text())


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("중복 JSON 키를 사용할 수 없습니다.")
        result[key] = value
    return result


async def body(request):
    buffer = bytearray()
    async for chunk in request.stream():
        buffer.extend(chunk)
        if len(buffer) > LIMIT:
            raise HTTPException(413, "입력 JSON은 2MB 이하여야 합니다.")
    try:
        return json.loads(
            buffer,
            object_pairs_hook=unique_object,
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError("유한한 숫자가 필요합니다.")
            ),
        )
    except (ValueError, UnicodeDecodeError, RecursionError) as exc:
        raise HTTPException(
            400, "올바른 UTF-8 JSON을 입력하세요. 중복 키·NaN은 허용하지 않습니다."
        ) from exc


@app.get("/api/health")
def health():
    return {"status": "ok", "engine_version": __version__, "local_only": True}


@app.get("/api/bootstrap")
def bootstrap():
    manifest = read_json("wiki/sources/manifest.json")
    formulas = read_json("wiki/formulas/catalog.json")
    documents = []
    for path in sorted((ROOT / "wiki").rglob("*.md")):
        text = path.read_text()
        title = next(
            (line.lstrip("# ") for line in text.splitlines() if line.startswith("# ")),
            path.stem,
        )
        documents.append(
            {
                "id": str(path.relative_to(ROOT / "wiki")),
                "title": title,
                "category": path.parent.name
                if path.parent != ROOT / "wiki"
                else "overview",
            }
        )
    sources = [
        {
            "id": x["id"],
            "path": x["path"],
            "page_count": x.get("page_count"),
            "card": x["card"].removeprefix("wiki/"),
            "format": x["format"],
            "sha256": x["sha256"],
            "available": (ROOT / x["path"]).is_file(),
        }
        for x in manifest["sources"]
    ]
    data = catalog()
    return {
        "engine_version": __version__,
        "formulas": formulas["rules"],
        "specs": SPECS,
        "documents": documents,
        "sources": sources,
        "source_count": manifest["unique_source_count"],
        "benchmarks": read_json("wiki/sources/external-links.json")["links"],
        "catalog": {
            key: data[key]
            for key in [
                "catalog_version",
                "verified_on",
                "region",
                "region_name",
                "currency",
                "price_publication_date",
                "price_scope",
                "limitations",
            ]
        },
        "examples": {
            key: read_json(f"examples/{name}.json")
            for key, name in {
                "tta-r3-2023": "tta-appendix",
                "lecture-network": "network",
                "network-guide-2021": "network-guide",
                "migration": "migration",
            }.items()
        },
    }


@app.get("/api/catalog")
def get_catalog():
    return catalog()


@app.post("/api/calculate")
async def calculate_route(request: Request):
    return calculate(await body(request))


@app.post("/api/migrate")
async def migration_route(request: Request):
    return calculate_migration(await body(request))


@app.post("/api/optimize")
async def optimization_route(request: Request):
    return calculate_optimization(await body(request))


@app.post("/api/benchmarks/compare")
async def compare_route(request: Request):
    return compare_benchmark(await body(request))


@app.get("/api/documents/{document_id:path}")
def document(document_id: str):
    allowed = {
        str(p.relative_to(ROOT / "wiki")): p for p in (ROOT / "wiki").rglob("*.md")
    }
    if document_id not in allowed:
        raise HTTPException(404, "등록된 Wiki 문서가 아닙니다.")
    return {"id": document_id, "markdown": allowed[document_id].read_text()}


@app.get("/api/sources/{source_id}/original")
def original(source_id: str):
    source = next(
        (
            x
            for x in read_json("wiki/sources/manifest.json")["sources"]
            if x["id"] == source_id
        ),
        None,
    )
    if source is None:
        raise HTTPException(404, "등록된 출처가 아닙니다.")
    path = ROOT / source["path"]
    if not path.is_file():
        raise HTTPException(
            404,
            "이 출처의 원본은 로컬 reference 폴더에 없습니다. 공개 저장소에는 출처 카드와 계산 규칙만 포함됩니다.",
        )
    return FileResponse(
        path,
        filename=path.name,
        content_disposition_type="inline"
        if source["format"] == "pdf"
        else "attachment",
    )


@app.get("/api/search")
def search(q: str = ""):
    query = q.strip().casefold()
    if len(query) < 2 or len(query) > 200:
        return {"results": []}
    results = []
    for path in sorted((ROOT / "wiki").rglob("*.md")):
        text = path.read_text()
        position = text.casefold().find(query)
        if position >= 0:
            results.append(
                {
                    "id": str(path.relative_to(ROOT / "wiki")),
                    "title": text.splitlines()[0].lstrip("# "),
                    "snippet": text[max(0, position - 50) : position + 180],
                }
            )
    return {"results": results[:50]}


@app.get("/{file_path:path}")
def frontend(file_path: str):
    dist = (ROOT / "web/dist").resolve()
    if file_path.startswith("api/"):
        raise HTTPException(404, "API를 찾을 수 없습니다.")
    path = (dist / unquote(file_path)).resolve()
    if dist not in path.parents and path != dist:
        raise HTTPException(404)
    if path.is_file():
        return FileResponse(path)
    if file_path and "." in Path(file_path).name:
        raise HTTPException(404)
    if (dist / "index.html").exists():
        return FileResponse(dist / "index.html")
    return JSONResponse(
        {"message": "웹 빌드가 필요합니다. web 폴더에서 npm run build를 실행하세요."},
        status_code=503,
    )
