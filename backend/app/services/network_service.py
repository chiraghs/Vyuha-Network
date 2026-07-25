from sqlalchemy.orm import Session
from app.db import models
from app.services.interfaces import BaseNetworkService

class NetworkService(BaseNetworkService):
    def get_criminal_network(self, db: Session) -> dict:
        """Fetch criminals and relationships to structure a node-link network graph."""
        criminals = db.query(models.Criminal).all()
        links = db.query(models.CriminalNetwork).all()

        nodes = []
        edges = []

        criminal_map = {c.id: c for c in criminals}

        degrees = {c.id: 0 for c in criminals}
        for link in links:
            if link.criminal_a in degrees:
                degrees[link.criminal_a] += 1
            if link.criminal_b in degrees:
                degrees[link.criminal_b] += 1

        for c in criminals:
            nodes.append({
                "id": c.id,
                "label": f"{c.name} ({c.alias})" if c.alias else c.name,
                "name": c.name,
                "alias": c.alias,
                "status": c.status,
                "risk_score": c.risk_score,
                "connections": degrees.get(c.id, 0),
                "is_hub": degrees.get(c.id, 0) >= 3
            })

        for link in links:
            if link.criminal_a in criminal_map and link.criminal_b in criminal_map:
                edges.append({
                    "id": link.id,
                    "source": link.criminal_a,
                    "target": link.criminal_b,
                    "relation": link.relationship_type,
                    "strength": link.strength
                })

        return {
            "nodes": nodes,
            "edges": edges,
            "metrics": {
                "total_criminals": len(criminals),
                "total_relationships": len(links),
                "max_connections": max(degrees.values()) if degrees else 0,
                "active_hubs": sum(1 for d in degrees.values() if d >= 3)
            }
        }
