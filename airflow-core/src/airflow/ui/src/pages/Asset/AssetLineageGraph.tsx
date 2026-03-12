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
import { Box, Text, useToken } from "@chakra-ui/react";
import { ReactFlow, Controls, Background, MiniMap, useReactFlow, type Node as ReactFlowNode } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import type { AssetResponse, EdgeResponse, NodeResponse } from "openapi/requests/types.gen";
import { DownloadButton } from "src/components/Graph/DownloadButton";
import { edgeTypes, nodeTypes } from "src/components/Graph/graphTypes";
import type { CustomNodeProps } from "src/components/Graph/reactflowUtils";
import { ErrorAlert } from "src/components/ErrorAlert";
import { ProgressBar } from "src/components/ui";
import { useGraphLayout } from "src/components/Graph/useGraphLayout";
import { useColorMode } from "src/context/colorMode";
import { useAssetLineage } from "src/queries/useAssetLineage";
import { getReactFlowThemeStyle } from "src/theme";

export const AssetLineageGraph = ({
    activeNodeId,
    asset,
    searchTerm,
    setActiveNodeId,
}: {
    readonly activeNodeId?: string;
    readonly asset?: AssetResponse;
    readonly searchTerm: string;
    readonly setActiveNodeId: Dispatch<SetStateAction<string | undefined>>;
}) => {
    const { assetId } = useParams();
    const { colorMode = "light" } = useColorMode();
    const { setCenter } = useReactFlow();
    const { t: translate } = useTranslation(["assets"]);

    // Fetch the lineage graph data
    const { data: lineageData = { edges: [], nodes: [] }, error, isError, isLoading } = useAssetLineage(assetId);

    // Map the lineage response to React Flow nodes/edges format needed by layout & custom components
    const mappedNodes: Array<NodeResponse> = lineageData.nodes.map((node) => ({
        data: {
            disableNavigation: true,
            id: node.id,
            isSelected: node.id === activeNodeId,
            label: node.name ?? "unnamed",
            rest: node,
        },
        id: node.id,
        label: node.name ?? "unnamed",
        position: { x: 0, y: 0 },
        type: node.node_type === "task" ? "task" : node.node_type === "dag" ? "dag" : "asset",
    }));

    const mappedEdges: Array<EdgeResponse> = lineageData.edges.map((edge) => ({
        data: { rest: { isSelected: edge.source_id === activeNodeId || edge.target_id === activeNodeId } },
        id: `${edge.source_id}-${edge.target_id}`,
        source: edge.source_id,
        source_id: edge.source_id,
        target: edge.target_id,
        target_id: edge.target_id,
        type: "custom",
    }));

    // Automatically layout the converted nodes
    const { data: layoutData } = useGraphLayout({
        direction: "RIGHT",
        edges: mappedEdges,
        nodes: mappedNodes,
        openGroupIds: [],
    });

    const [selectedDarkColor, selectedLightColor] = useToken("colors", ["bg.muted", "bg.emphasized"]);
    const selectedColor = colorMode === "dark" ? selectedDarkColor : selectedLightColor;
    const layoutEdges = useMemo(() => layoutData?.edges ?? [], [layoutData?.edges]);
    const layoutNodes = useMemo(() => layoutData?.nodes ?? [], [layoutData?.nodes]);

    useEffect(() => {
        const trimmedSearch = searchTerm.trim().toLowerCase();

        if (trimmedSearch === "" || layoutNodes.length === 0) {
            return;
        }

        const matchedNode = layoutNodes.find((node) => {
            const nodeId = node.id.toLowerCase();
            const nodeLabel = node.data.label.toLowerCase();

            return nodeLabel.includes(trimmedSearch) || nodeId.includes(trimmedSearch);
        });

        if (!matchedNode) {
            return;
        }

        setActiveNodeId(matchedNode.id);
        void setCenter(
            matchedNode.position.x + (matchedNode.width ?? 0) / 2,
            matchedNode.position.y + (matchedNode.height ?? 0) / 2,
            { duration: 300, zoom: 1 },
        );
    }, [layoutNodes, searchTerm, setActiveNodeId, setCenter]);

    if (isLoading) {
        return <ProgressBar size="xs" visibility="visible" />;
    }

    if (isError) {
        return <ErrorAlert error={error} />;
    }

    if (layoutNodes.length === 0) {
        return (
            <Box p={4}>
                <Text color="fg.muted">{translate("no_lineage_data_found")}</Text>
            </Box>
        );
    }

    return (
        <ReactFlow
            colorMode={colorMode}
            defaultEdgeOptions={{ zIndex: 1 }}
            edges={layoutEdges}
            edgeTypes={edgeTypes}
            fitView
            maxZoom={1.5}
            minZoom={0.25}
            nodes={layoutNodes}
            nodesDraggable={false}
            nodeTypes={nodeTypes}
            onlyRenderVisibleElements
            onNodeClick={(_, node) => {
                setActiveNodeId(node.id);
            }}
            style={getReactFlowThemeStyle(colorMode)}
        >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap
                nodeStrokeColor={(node: ReactFlowNode<CustomNodeProps>) =>
                    node.data.isSelected && selectedColor !== undefined ? selectedColor : ""
                }
                nodeStrokeWidth={15}
                pannable
                zoomable
            />
            <DownloadButton name={`lineage-${asset?.name ?? assetId}`} />
        </ReactFlow>
    );
};
