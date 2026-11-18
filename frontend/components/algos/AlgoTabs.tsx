"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HashRingLab, ShardingLab } from "./HashingLabs";
import RaftLab from "./RaftLab";
import { CacheLab, QuorumLab, RateLimitLab } from "./RateCacheQuorum";

const TABS = [
  { id: "hashing", label: "Consistent hashing", lesson: "consistent-hashing", blurb: "Place nodes and keys on a 2³² ring, add or remove nodes, and compare data movement against hash mod N." },
  { id: "sharding", label: "Sharding", lesson: "sharding", blurb: "Compare range, hash, consistent and directory sharding under sequential, uniform and skewed keys. Find the hot shard." },
  { id: "ratelimit", label: "Rate limiters", lesson: "rate-limiting", blurb: "Run five algorithms over identical traffic and see who lets bursts through, who overshoots, and what each costs in memory." },
  { id: "raft", label: "Raft consensus", lesson: "consensus", blurb: "A real Raft implementation: randomized elections, log replication, commits, crashes and partitions, replayed frame by frame." },
  { id: "cache", label: "Cache eviction", lesson: "caching", blurb: "LRU vs LFU vs FIFO vs Random vs W-TinyLFU on a Zipf workload with scans, against Belady's optimal bound." },
  { id: "quorum", label: "Quorums (N/R/W)", lesson: "cap-consistency", blurb: "Tune Dynamo-style replication and measure stale reads, availability under failures, and write latency." },
];

export default function AlgoTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.find((t) => t.id === params.get("tab")) || TABS[0];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab.id ? "on" : ""} onClick={() => router.replace(`/lab/algorithms?tab=${t.id}`, { scroll: false })}>{t.label}</button>
        ))}
      </div>
      <div className="row between">
        <p className="muted" style={{ margin: 0, maxWidth: 820 }}>{tab.blurb}</p>
        <Link href={`/learn/${tab.lesson}`} className="btn ghost sm">Read the lesson →</Link>
      </div>
      <div key={tab.id}>
        {tab.id === "hashing" && <HashRingLab />}
        {tab.id === "sharding" && <ShardingLab />}
        {tab.id === "ratelimit" && <RateLimitLab />}
        {tab.id === "raft" && <RaftLab />}
        {tab.id === "cache" && <CacheLab />}
        {tab.id === "quorum" && <QuorumLab />}
      </div>
    </div>
  );
}
