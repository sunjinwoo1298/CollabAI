import * as Y from "yjs";
import { CANVAS_TEMPLATES, CanvasTemplate } from "../components/editor/starter-templates";
import { CanvasNode, CanvasEdge } from "../types/canvas";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTemplateTests() {
  console.log("=================================================");
  console.log(" Running Starter Templates & Yjs Sync Test Suite ");
  console.log("=================================================");

  // 1. Template Structure & Data Validity
  console.log("\n[Test 1] Template Library Integrity & Validation");
  assert(
    Array.isArray(CANVAS_TEMPLATES) && CANVAS_TEMPLATES.length >= 3,
    `Template library has at least 3 templates (found ${CANVAS_TEMPLATES.length})`
  );

  const templateIds = new Set<string>();

  for (const template of CANVAS_TEMPLATES) {
    assert(Boolean(template.id), `Template has valid ID: ${template.id}`);
    assert(!templateIds.has(template.id), `Template ID is unique: ${template.id}`);
    templateIds.add(template.id);

    assert(Boolean(template.name), `Template has name: "${template.name}"`);
    assert(Boolean(template.description), `Template has description for: "${template.name}"`);
    assert(template.nodes.length >= 5, `Template "${template.name}" has at least 5 nodes (${template.nodes.length})`);
    assert(template.edges.length >= 4, `Template "${template.name}" has at least 4 edges (${template.edges.length})`);

    const nodeIds = new Set<string>();
    for (const node of template.nodes) {
      assert(Boolean(node.id), `Node has ID in "${template.name}"`);
      assert(!nodeIds.has(node.id), `Node ID "${node.id}" is unique in "${template.name}"`);
      nodeIds.add(node.id);

      assert(Boolean(node.data?.label), `Node "${node.id}" has a label`);
      assert(Boolean(node.data?.nodeType), `Node "${node.id}" has a nodeType: ${node.data?.nodeType}`);
      assert(typeof node.position?.x === "number" && typeof node.position?.y === "number", `Node "${node.id}" has valid coords`);
    }

    for (const edge of template.edges) {
      assert(Boolean(edge.id), `Edge has ID: "${edge.id}"`);
      assert(nodeIds.has(edge.source), `Edge "${edge.id}" source "${edge.source}" exists in node set`);
      assert(nodeIds.has(edge.target), `Edge "${edge.id}" target "${edge.target}" exists in node set`);
    }
  }

  // 2. Single Transaction Atomic Canvas Replacement
  console.log("\n[Test 2] Atomic Single-Transaction Canvas Replacement");
  const docA = new Y.Doc();
  const nodesMapA = docA.getMap("nodes");
  const edgesMapA = docA.getMap("edges");

  // Populate initial arbitrary canvas state
  const initialNode: CanvasNode = {
    id: "legacy-node-1",
    type: "system",
    position: { x: 100, y: 100 },
    data: { label: "Legacy Node", nodeType: "custom" },
  };
  const initialEdge: CanvasEdge = {
    id: "legacy-edge-1",
    source: "legacy-node-1",
    target: "legacy-node-1",
  };

  docA.transact(() => {
    nodesMapA.set(initialNode.id, initialNode);
    edgesMapA.set(initialEdge.id, initialEdge);
  }, "initial-legacy-state");

  assert(nodesMapA.size === 1, "Canvas has 1 legacy node before template load");
  assert(edgesMapA.size === 1, "Canvas has 1 legacy edge before template load");

  // Track transaction count during template load
  let transactionCount = 0;
  let transactionName = "";
  docA.on("afterTransaction", (tr: Y.Transaction) => {
    transactionCount++;
    transactionName = tr.origin;
  });

  const microservicesTemplate = CANVAS_TEMPLATES.find((t) => t.id === "template-microservices")!;
  assert(Boolean(microservicesTemplate), "Microservices template found");

  // Simulate loadTemplate helper logic
  docA.transact(() => {
    // 1. Clear existing
    for (const key of Array.from(nodesMapA.keys())) {
      nodesMapA.delete(key);
    }
    for (const key of Array.from(edgesMapA.keys())) {
      edgesMapA.delete(key);
    }
    // 2. Add template elements
    for (const node of microservicesTemplate.nodes) {
      nodesMapA.set(node.id, node);
    }
    for (const edge of microservicesTemplate.edges) {
      edgesMapA.set(edge.id, edge);
    }
  }, "local-load-template");

  assert(transactionCount === 1, `Template load executed in exactly 1 transaction (actual: ${transactionCount})`);
  assert(transactionName === "local-load-template", `Transaction origin was "local-load-template"`);
  assert(!nodesMapA.has("legacy-node-1"), "Legacy node was removed");
  assert(!edgesMapA.has("legacy-edge-1"), "Legacy edge was removed");
  assert(nodesMapA.size === microservicesTemplate.nodes.length, `nodesMap has exact template node count (${nodesMapA.size})`);
  assert(edgesMapA.size === microservicesTemplate.edges.length, `edgesMap has exact template edge count (${edgesMapA.size})`);

  // 3. Multi-Client CRDT Sync of Loaded Template
  console.log("\n[Test 3] Multi-Client CRDT Convergence on Template Load");
  const docB = new Y.Doc();
  const nodesMapB = docB.getMap("nodes");
  const edgesMapB = docB.getMap("edges");

  // Doc B starts with initial state
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA), "sync-to-b");

  assert(nodesMapB.size === microservicesTemplate.nodes.length, "Doc B received all template nodes from Doc A");
  assert(edgesMapB.size === microservicesTemplate.edges.length, "Doc B received all template edges from Doc A");
  assert(
    (nodesMapB.get("ms-client") as CanvasNode)?.data.label === "Web & Mobile Client",
    "Doc B has exact node data from template"
  );

  // 4. Switch from one template to another (CI/CD pipeline)
  console.log("\n[Test 4] Switching from one Template to Another");
  const cicdTemplate = CANVAS_TEMPLATES.find((t) => t.id === "template-cicd-pipeline")!;
  assert(Boolean(cicdTemplate), "CI/CD template found");

  docB.transact(() => {
    for (const key of Array.from(nodesMapB.keys())) {
      nodesMapB.delete(key);
    }
    for (const key of Array.from(edgesMapB.keys())) {
      edgesMapB.delete(key);
    }
    for (const node of cicdTemplate.nodes) {
      nodesMapB.set(node.id, node);
    }
    for (const edge of cicdTemplate.edges) {
      edgesMapB.set(edge.id, edge);
    }
  }, "client-b-switch-template");

  // Sync Doc B -> Doc A
  Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB), "sync-to-a");

  assert(nodesMapA.size === cicdTemplate.nodes.length, "Doc A converged to new CI/CD template node count");
  assert(edgesMapA.size === cicdTemplate.edges.length, "Doc A converged to new CI/CD template edge count");
  assert(!nodesMapA.has("ms-client"), "Previous microservices nodes are gone from Doc A");
  assert(Boolean(nodesMapA.get("ci-dev")), "Doc A has CI/CD nodes");

  // 5. Cleanup
  console.log("\n[Test 5] Cleanup");
  docA.destroy();
  docB.destroy();
  console.log("✅ All test Y.Doc instances cleaned up");

  console.log("\n=================================================");
  console.log("🎉 All Starter Template Tests PASSED!");
  console.log("=================================================\n");
}

runTemplateTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
