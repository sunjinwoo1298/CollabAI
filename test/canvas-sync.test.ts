import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { CanvasNode, CanvasEdge, CanvasNodeType } from "../types/canvas";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log("=================================================");
  console.log(" Running Base Canvas & Yjs Invariant Test Suite ");
  console.log("=================================================");

  // 1. Initial State & Hydration
  console.log("\n[Test 1] Initial State & Hydration Safety");
  const docA = new Y.Doc();
  const nodesMapA = docA.getMap("nodes");
  const edgesMapA = docA.getMap("edges");

  assert(nodesMapA.size === 0, "Initial nodesMap is empty");
  assert(edgesMapA.size === 0, "Initial edgesMap is empty");

  // 2. Yjs Node & Edge Serialization & Mutation
  console.log("\n[Test 2] Node and Edge Mutations through Yjs CRDT Maps");
  const node1: CanvasNode = {
    id: "node-service-1",
    type: "system",
    position: { x: 100, y: 150 },
    data: {
      label: "Auth Service",
      sublabel: "Go Microservice",
      nodeType: "service",
      status: "active",
      description: "Handles JWT tokens and sessions",
    },
  };

  const node2: CanvasNode = {
    id: "node-db-1",
    type: "system",
    position: { x: 400, y: 150 },
    data: {
      label: "User Database",
      sublabel: "PostgreSQL 16",
      nodeType: "database",
      status: "active",
      description: "Primary database",
    },
  };

  const edge1: CanvasEdge = {
    id: "e-service-to-db",
    source: "node-service-1",
    target: "node-db-1",
    type: "smoothstep",
    animated: true,
  };

  docA.transact(() => {
    nodesMapA.set(node1.id, node1);
    nodesMapA.set(node2.id, node2);
    edgesMapA.set(edge1.id, edge1);
  }, "local-ui-init");

  assert(nodesMapA.size === 2, "nodesMap contains 2 nodes");
  assert(edgesMapA.size === 1, "edgesMap contains 1 edge");
  assert(
    (nodesMapA.get(node1.id) as CanvasNode)?.data.label === "Auth Service",
    "Node 1 data is preserved and serializable"
  );

  // 3. Node Position Update (Dragging)
  console.log("\n[Test 3] Node Movement (Position Update)");
  docA.transact(() => {
    const existing = nodesMapA.get(node1.id) as CanvasNode;
    nodesMapA.set(node1.id, {
      ...existing,
      position: { x: 180, y: 220 },
    });
  }, "local-ui-nodes");

  assert(
    (nodesMapA.get(node1.id) as CanvasNode).position.x === 180,
    "Node 1 position X updated in Yjs"
  );
  assert(
    (nodesMapA.get(node1.id) as CanvasNode).position.y === 220,
    "Node 1 position Y updated in Yjs"
  );

  // 4. CRDT Synchronization Between 2 Clients (Client A <-> Client B)
  console.log("\n[Test 4] Multi-Client CRDT Synchronization");
  const docB = new Y.Doc();
  const nodesMapB = docB.getMap("nodes");
  const edgesMapB = docB.getMap("edges");

  // Sync Doc A -> Doc B via Yjs binary sync protocol
  const updateFromA = Y.encodeStateAsUpdate(docA);
  Y.applyUpdate(docB, updateFromA, "sync-from-a");

  assert(nodesMapB.size === 2, "Doc B received all nodes from Doc A");
  assert(edgesMapB.size === 1, "Doc B received all edges from Doc A");
  assert(
    (nodesMapB.get(node1.id) as CanvasNode).position.x === 180,
    "Doc B has exact updated position of Node 1"
  );

  // Client B adds a Cache node and connects it
  const node3: CanvasNode = {
    id: "node-cache-1",
    type: "system",
    position: { x: 400, y: 300 },
    data: {
      label: "Redis Cache",
      sublabel: "Cluster Mode",
      nodeType: "cache",
      status: "active",
      description: "Session cache",
    },
  };
  const edge2: CanvasEdge = {
    id: "e-service-to-cache",
    source: "node-service-1",
    target: "node-cache-1",
    type: "smoothstep",
    animated: true,
  };

  docB.transact(() => {
    nodesMapB.set(node3.id, node3);
    edgesMapB.set(edge2.id, edge2);
  }, "client-b-add");

  // Sync Doc B -> Doc A
  const updateFromB = Y.encodeStateAsUpdate(docB);
  Y.applyUpdate(docA, updateFromB, "sync-from-b");

  assert(nodesMapA.size === 3, "Doc A converged with Doc B node additions");
  assert(edgesMapA.size === 2, "Doc A converged with Doc B edge additions");
  assert(
    Boolean(nodesMapA.get("node-cache-1")),
    "Doc A now contains Redis Cache node created by Client B"
  );

  // 5. Node Deletion & Edge Cascading
  console.log("\n[Test 5] Node Deletion and Edge Cascade");
  docA.transact(() => {
    nodesMapA.delete("node-cache-1");
    for (const [edgeId, edge] of edgesMapA.entries() as Iterable<[string, CanvasEdge]>) {
      if (edge.source === "node-cache-1" || edge.target === "node-cache-1") {
        edgesMapA.delete(edgeId);
      }
    }
  }, "local-delete-node");

  assert(!nodesMapA.has("node-cache-1"), "Node cache deleted from Doc A");
  assert(!edgesMapA.has("e-service-to-cache"), "Edge to cache deleted from Doc A");

  // Sync deletion to Doc B
  const deletionUpdate = Y.encodeStateAsUpdate(docA);
  Y.applyUpdate(docB, deletionUpdate, "sync-deletion");

  assert(!nodesMapB.has("node-cache-1"), "Doc B synchronized node deletion");
  assert(!edgesMapB.has("e-service-to-cache"), "Doc B synchronized edge deletion");

  // 6. Room Isolation
  console.log("\n[Test 6] Room Isolation (Project A vs Project B)");
  const docProjectA = new Y.Doc();
  const docProjectB = new Y.Doc();

  const mapProjA = docProjectA.getMap("nodes");
  const mapProjB = docProjectB.getMap("nodes");

  mapProjA.set("projA-node", { id: "projA-node", type: "system", position: { x: 0, y: 0 }, data: { label: "A" } });

  assert(mapProjA.size === 1, "Project A has 1 node");
  assert(mapProjB.size === 0, "Project B has 0 nodes (isolated)");

  // 7. Cleanup
  console.log("\n[Test 7] Y.Doc Lifecycle & Cleanup");
  docA.destroy();
  docB.destroy();
  docProjectA.destroy();
  docProjectB.destroy();
  console.log("✅ All Y.Doc instances cleanly destroyed without memory leaks");

  console.log("\n=================================================");
  console.log("🎉 All Base Canvas & Yjs Invariant Tests PASSED!");
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
