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
import { useQuery } from "@tanstack/react-query";

type AssetLineageNode = {
  group?: string;
  id: string;
  name?: string;
  node_type: string;
  uri?: string;
};

type AssetLineageEdge = {
  source_id: string;
  target_id: string;
};

type AssetLineageGraphResponse = {
  edges: Array<AssetLineageEdge>;
  nodes: Array<AssetLineageNode>;
};

const lineageErrorEnabled = () =>
  new URLSearchParams(globalThis.location.search).get("lineageError") === "true";

export const useAssetLineage = (assetId: string | undefined) =>
  useQuery<AssetLineageGraphResponse>({
    enabled: Boolean(assetId),
    queryFn: async () =>
      // Temporary mock fetcher simulating GET /assets/{asset_id}/lineage JSON payload matching Pydantic response
      new Promise<AssetLineageGraphResponse>((resolve, reject) => {
        setTimeout(() => {
          if (lineageErrorEnabled()) {
            reject(new Error("Mock lineage request failed."));

            return;
          }

          resolve({
            edges: [
              { source_id: "upstream_dag", target_id: "upstream_dag.producer_task" },
              { source_id: "upstream_dag.producer_task", target_id: `asset:${assetId}` },
              { source_id: `asset:${assetId}`, target_id: "downstream_dag.consumer_task" },
              { source_id: "downstream_dag", target_id: "downstream_dag.consumer_task" },
              { source_id: "downstream_dag.consumer_task", target_id: "asset:2" },
            ],
            nodes: [
              { group: "dags", id: "upstream_dag", name: "upstream_dag", node_type: "dag" },
              { group: "tasks", id: "upstream_dag.producer_task", name: "producer_task", node_type: "task" },
              { group: "assets", id: `asset:${assetId}`, name: "target_asset", node_type: "asset" },
              { group: "dags", id: "downstream_dag", name: "downstream_dag", node_type: "dag" },
              {
                group: "tasks",
                id: "downstream_dag.consumer_task",
                name: "consumer_task",
                node_type: "task",
              },
              { group: "assets", id: "asset:2", name: "target_asset_2", node_type: "asset" },
            ],
          });
        }, 500); // simulate network delay
      }),
    queryKey: ["assetLineage", assetId],
  });
