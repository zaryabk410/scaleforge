"""Pydantic models for the architecture simulator."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

NodeType = Literal[
    "client", "dns", "cdn", "lb", "gateway", "server", "cache",
    "db", "nosql", "queue", "worker", "storage", "search",
]

TrafficPattern = Literal["steady", "spike", "ramp", "diurnal"]


class NodeSpec(BaseModel):
    id: str
    type: NodeType
    label: Optional[str] = None
    replicas: int = Field(1, ge=1, le=500)
    capacity: Optional[float] = Field(None, gt=0, description="requests/sec per replica")
    latency: Optional[float] = Field(None, ge=0, description="base service time in ms")
    hit_rate: Optional[float] = Field(None, ge=0, le=1, description="cache / cdn hit ratio")
    read_replicas: int = Field(0, ge=0, le=15, description="db read replicas")
    shards: int = Field(1, ge=1, le=64, description="db / nosql shard count")
    autoscale: bool = False
    min_replicas: int = Field(1, ge=1, le=500)
    max_replicas: int = Field(20, ge=1, le=500)
    fail_at: Optional[int] = Field(None, ge=0)
    fail_replicas: Optional[int] = Field(None, ge=1, description="None = whole node")
    recover_at: Optional[int] = Field(None, ge=0)
    x: float = 0
    y: float = 0


class EdgeSpec(BaseModel):
    source: str
    target: str


class TrafficSpec(BaseModel):
    rps: float = Field(1000, gt=0, le=2_000_000)
    read_ratio: float = Field(0.9, ge=0, le=1)
    duration: int = Field(60, ge=10, le=600)
    pattern: TrafficPattern = "steady"
    spike_multiplier: float = Field(5, ge=1, le=50)
    spike_at: int = Field(20, ge=0)
    spike_duration: int = Field(10, ge=1)
    seed: int = 42


class ChaosEvent(BaseModel):
    node_type: NodeType
    at: int
    replicas: Optional[int] = None
    recover_at: Optional[int] = None


class SimRequest(BaseModel):
    nodes: list[NodeSpec]
    edges: list[EdgeSpec]
    traffic: TrafficSpec = TrafficSpec()
    chaos: list[ChaosEvent] = []
    samples_per_tick: int = Field(250, ge=50, le=2000)
