"""Reference solutions proving every lab challenge is solvable."""

def N(id, type, **kw):
    return {"id": id, "type": type, **kw}

def E(*pairs):
    return [{"source": a, "target": b} for a, b in pairs]

SOLUTIONS = {
    "hello-scale": (
        [N("c", "client"), N("lb", "lb", replicas=2), N("app", "server", replicas=3), N("db", "db", read_replicas=1)],
        E(("c", "lb"), ("lb", "app"), ("app", "db")),
    ),
    "read-heavy-feed": (
        [N("c", "client"), N("lb", "lb", replicas=2), N("app", "server", replicas=24),
         N("cache", "cache", replicas=2, hit_rate=0.9), N("db", "db", read_replicas=1)],
        E(("c", "lb"), ("lb", "app"), ("app", "cache"), ("app", "db")),
    ),
    "black-friday": (
        [N("c", "client"), N("lb", "lb", replicas=2),
         N("app", "server", replicas=8, autoscale=True, min_replicas=8, max_replicas=30),
         N("cache", "cache", replicas=2, hit_rate=0.9), N("db", "db", read_replicas=1)],
        E(("c", "lb"), ("lb", "app"), ("app", "cache"), ("app", "db")),
    ),
    "no-spof": (
        [N("c", "client"), N("lb", "lb", replicas=2), N("appA", "server", replicas=6), N("appB", "server", replicas=6),
         N("cache", "cache", replicas=2), N("db", "db", read_replicas=2)],
        E(("c", "lb"), ("lb", "appA"), ("lb", "appB"), ("appA", "cache"), ("appB", "cache"), ("appA", "db"), ("appB", "db")),
    ),
    "write-firehose": (
        [N("c", "client"), N("lb", "lb", replicas=2), N("app", "server", replicas=14), N("q", "queue", replicas=3),
         N("w", "worker", replicas=16), N("store", "nosql", shards=2, read_replicas=1)],
        E(("c", "lb"), ("lb", "app"), ("app", "q"), ("app", "store"), ("q", "w"), ("w", "store")),
    ),
    "cache-stampede": (
        [N("c", "client"), N("cdn", "cdn", hit_rate=0.7), N("lb", "lb", replicas=2), N("app", "server", replicas=8),
         N("cache", "cache", replicas=2), N("db", "db", read_replicas=2)],
        E(("c", "cdn"), ("cdn", "lb"), ("lb", "app"), ("app", "cache"), ("app", "db")),
    ),
    "global-video": (
        [N("c", "client"), N("cdn", "cdn", hit_rate=0.85), N("lb", "lb", replicas=2), N("app", "server", replicas=13),
         N("cache", "cache", replicas=2, hit_rate=0.9), N("db", "db", read_replicas=1)],
        E(("c", "cdn"), ("cdn", "lb"), ("lb", "app"), ("app", "cache"), ("app", "db")),
    ),
    "sharded-ledger": (
        [N("c", "client"), N("lb", "lb", replicas=2), N("app", "server", replicas=20),
         N("cache", "cache", replicas=2), N("db", "db", shards=8, read_replicas=1)],
        E(("c", "lb"), ("lb", "app"), ("app", "cache"), ("app", "db")),
    ),
}
