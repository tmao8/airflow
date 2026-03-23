/*!
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BaseWrapper } from "src/utils/Wrapper";

import { AssetLineageGraph } from "./AssetLineageGraph";

const { mockSetCenter, mockUseAssetLineage, mockUseGraphLayout } = vi.hoisted(() => ({
  mockSetCenter: vi.fn(),
  mockUseAssetLineage: vi.fn(),
  mockUseGraphLayout: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // eslint-disable-next-line id-length
    t: (translationKey: string) => translationKey,
  }),
}));

vi.mock("src/context/colorMode", () => ({
  useColorMode: () => ({ colorMode: "light" }),
}));

vi.mock("src/queries/useAssetLineage", () => ({
  useAssetLineage: mockUseAssetLineage,
}));

vi.mock("src/components/Graph/useGraphLayout", () => ({
  useGraphLayout: mockUseGraphLayout,
}));

vi.mock("src/components/Graph/DownloadButton", () => ({
  DownloadButton: () => <div data-testid="download-button" />,
}));

vi.mock("@xyflow/react", () => ({
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  ReactFlow: ({
    children,
    edges,
    nodes,
  }: {
    readonly children?: ReactNode;
    readonly edges: unknown;
    readonly nodes: unknown;
  }) => (
    <div data-edges={JSON.stringify(edges)} data-nodes={JSON.stringify(nodes)} data-testid="react-flow">
      {children}
    </div>
  ),
  useReactFlow: () => ({
    fitView: vi.fn(),
    setCenter: mockSetCenter,
  }),
}));

type LineageNode = {
  data?: {
    lineageStyle?: "downstream" | "focus" | "upstream";
  };
  id: string;
};

type LineageEdge = {
  data?: {
    rest?: {
      isSelected?: boolean;
      lineageDirection?: "downstream" | "upstream";
    };
  };
  id: string;
};

const renderAssetLineageGraph = (direction: "downstream" | "upstream") =>
  render(
    <MemoryRouter initialEntries={["/assets/1"]}>
      <Routes>
        <Route
          element={
            <AssetLineageGraph
              activeNodeId="asset:1"
              highlightDirection={direction}
              searchTerm=""
              setActiveNodeId={vi.fn()}
            />
          }
          path="/assets/:assetId"
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: BaseWrapper },
  );

const getRenderedGraph = () => {
  const reactFlow = screen.getByTestId("react-flow");
  const serializedNodes = reactFlow.dataset.nodes;
  const serializedEdges = reactFlow.dataset.edges;

  expect(serializedNodes).not.toBeNull();
  expect(serializedEdges).not.toBeNull();

  return {
    edges: JSON.parse(serializedEdges ?? "[]") as Array<LineageEdge>,
    nodes: JSON.parse(serializedNodes ?? "[]") as Array<LineageNode>,
  };
};

describe("AssetLineageGraph integration", () => {
  beforeEach(() => {
    mockSetCenter.mockReset();
    mockUseAssetLineage.mockReset();
    mockUseGraphLayout.mockReset();

    mockUseAssetLineage.mockReturnValue({
      data: {
        edges: [
          { source_id: "upstream_dag", target_id: "upstream_dag.producer_task" },
          { source_id: "upstream_dag.producer_task", target_id: "asset:1" },
          { source_id: "asset:1", target_id: "downstream_dag.consumer_task" },
          { source_id: "downstream_dag.consumer_task", target_id: "asset:2" },
        ],
        nodes: [
          { id: "upstream_dag", name: "upstream_dag", node_type: "dag" },
          { id: "upstream_dag.producer_task", name: "producer_task", node_type: "task" },
          { id: "asset:1", name: "asset_1", node_type: "asset" },
          { id: "downstream_dag.consumer_task", name: "consumer_task", node_type: "task" },
          { id: "asset:2", name: "asset_2", node_type: "asset" },
        ],
      },
      error: undefined,
      isError: false,
      isLoading: false,
    });
    mockUseGraphLayout.mockImplementation(
      ({ edges, nodes }: { readonly edges: Array<LineageEdge>; readonly nodes: Array<LineageNode> }) => ({
        data: { edges, nodes },
      }),
    );
  });

  it("applies downstream highlight styles to downstream lineage only", () => {
    renderAssetLineageGraph("downstream");

    const { edges, nodes } = getRenderedGraph();
    const selectedEdgeIds = new Set(
      edges.filter((edge) => edge.data?.rest?.isSelected).map((edge) => edge.id),
    );
    const nodeStyles = new Map(nodes.map((node) => [node.id, node.data?.lineageStyle]));

    expect(selectedEdgeIds).toEqual(
      new Set(["asset:1-downstream_dag.consumer_task", "downstream_dag.consumer_task-asset:2"]),
    );
    expect(nodeStyles.get("asset:1")).toBe("focus");
    expect(nodeStyles.get("downstream_dag.consumer_task")).toBe("downstream");
    expect(nodeStyles.get("asset:2")).toBe("downstream");
    expect(nodeStyles.get("upstream_dag")).toBeUndefined();
    expect(nodeStyles.get("upstream_dag.producer_task")).toBeUndefined();
  });

  it("applies upstream highlight styles to upstream lineage only", () => {
    renderAssetLineageGraph("upstream");

    const { edges, nodes } = getRenderedGraph();
    const selectedEdges = edges.filter((edge) => edge.data?.rest?.isSelected);
    const selectedEdgeIds = new Set(selectedEdges.map((edge) => edge.id));
    const selectedLineageDirections = new Set(selectedEdges.map((edge) => edge.data?.rest?.lineageDirection));
    const nodeStyles = new Map(nodes.map((node) => [node.id, node.data?.lineageStyle]));

    expect(selectedEdgeIds).toEqual(
      new Set(["upstream_dag-upstream_dag.producer_task", "upstream_dag.producer_task-asset:1"]),
    );
    expect(selectedLineageDirections).toEqual(new Set(["upstream"]));
    expect(nodeStyles.get("asset:1")).toBe("focus");
    expect(nodeStyles.get("upstream_dag")).toBe("upstream");
    expect(nodeStyles.get("upstream_dag.producer_task")).toBe("upstream");
    expect(nodeStyles.get("downstream_dag.consumer_task")).toBeUndefined();
    expect(nodeStyles.get("asset:2")).toBeUndefined();
  });
});
