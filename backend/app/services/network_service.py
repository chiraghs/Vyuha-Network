from sqlalchemy.orm import Session

from app.db import models
from app.services import offender_analytics as oa
from app.services.interfaces import BaseNetworkService

# Cap the graph so the payload stays bounded on very large datasets and the
# canvas stays readable. The graph keeps the highest-degree offenders (the hubs
# that matter for link analysis).
MAX_NODES = 55


class NetworkService(BaseNetworkService):
    def get_criminal_network(self, db: Session) -> dict:
        """Infer the criminal network from co-accused relationships (capped)."""
        aggs = oa.aggregate_offenders(db)
        edges_raw = oa.co_accused_edges(db)

        degree: dict[str, int] = {k: 0 for k in aggs}
        for a, b, _n in edges_raw:
            if a in degree:
                degree[a] += 1
            if b in degree:
                degree[b] += 1

        # Keep the top-N offenders by degree (then by case count) for the graph.
        ranked = sorted(
            aggs.values(),
            key=lambda g: (degree.get(g.key, 0), g.crimes_count),
            reverse=True,
        )
        kept = {g.key for g in ranked[:MAX_NODES]}

        nodes = []
        for g in ranked[:MAX_NODES]:
            conns = degree.get(g.key, 0)
            nodes.append({
                "id": g.key,
                "label": f"{g.name} ({g.alias})" if g.alias else g.name,
                "name": g.name,
                "alias": g.alias,
                "status": oa.status_of(g),
                "risk_score": oa.risk_score(g),
                "connections": conns,
                "is_hub": conns >= 3,
            })

        edges = []
        for i, (a, b, n) in enumerate(edges_raw):
            if a in kept and b in kept:
                edges.append({
                    "id": f"e{i}",
                    "source": a,
                    "target": b,
                    "relation": oa.relation_label(n),
                    "strength": min(1.0, 0.4 + n * 0.2),
                })

        degrees = list(degree.values())
        return {
            "nodes": nodes,
            "edges": edges,
            "metrics": {
                "total_criminals": len(aggs),
                "total_relationships": len(edges_raw),
                "max_connections": max(degrees) if degrees else 0,
                "active_hubs": sum(1 for d in degrees if d >= 3),
            },
        }
