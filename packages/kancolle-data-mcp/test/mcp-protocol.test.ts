import { expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.js";
import { loadDataset } from "../src/data-loader.js";
import { buildIndex } from "../src/index-memory.js";

it("exposes item schema and remodel scope over the MCP protocol", async () => {
  const ds = loadDataset(new URL("../data/official/dataset.json", import.meta.url).pathname);
  const server = createServer({ ds, index: buildIndex(ds) });
  const client = new Client({ name: "remodel-contract-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(7);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as Array<{type: string; text: string}>;
      expect(result.isError).not.toBe(true);
      return JSON.parse(content[0].text);
    };
    const item = await call("kc_search", { query: "新型兵装资材", types: ["item"], limit: 1 });
    expect(item.data[0].ref).toBe("item:94");
    const next = await call("kc_ship_remodel", { ship: "ship:145" });
    expect(next.data.transitions).toHaveLength(1);
    expect(next.data.transitions[0].items).toContainEqual({ ref: "item:94", name: "新型兵装資材", count: 3 });
    const family = await call("kc_ship_remodel", { ship: "ship:145", scope: "family" });
    expect(family.data.transitions.length).toBeGreaterThan(1);
  } finally {
    await client.close();
    await server.close();
  }
});
