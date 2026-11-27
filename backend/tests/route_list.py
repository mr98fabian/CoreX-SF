"""Every (full path, route) of the app, flat. From FastAPI 0.137 `app.routes` holds one
_IncludedRouter per include_router instead of the routes themselves (mission 21, H-05), so a
plain scan of app.routes would see none of them and checks built on it would pass vacuously."""


def iter_routes(routes, prefix=""):
    for r in routes:
        inner = getattr(r, "original_router", None)
        if inner is not None:
            yield from iter_routes(inner.routes, prefix + (r.include_context.prefix or ""))
        else:
            yield prefix + getattr(r, "path", ""), r
