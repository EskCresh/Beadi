import { Draft } from "immer";
import { Edge, Node, OnConnect, OnEdgesChange, OnNodesChange, XYPosition, applyEdgeChanges, applyNodeChanges } from "reactflow";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import _ from "lodash";
import { useCallback } from "react";
import { useFileStore } from "../storage";
import { BeadiInstance } from "..";

export type UnknownBeadiNode = BeadiNode<unknown, unknown, Record<string, any>>;
export type BeadiNode<TDisplaySettings, TSettings, THandles extends Record<string, any>> = Node<
  BeadiNodeData<TDisplaySettings, TSettings, THandles>
> & {
  type: NonNullable<Node<BeadiNodeData<TDisplaySettings, TSettings, THandles>>["type"]>;
};

export type BeadiNodeHandleData<T> = {
  preview: boolean;
  value: T;
};
export type UnknownBeadiNodeData = BeadiNodeData<unknown, unknown, Record<string, unknown>>;
export type BeadiNodeData<TDisplaySettings, TSettings, THandles extends Record<string, any>> = {
  displaySettings: TDisplaySettings;
  settings: TSettings;
  handles: {
    [Key in keyof THandles]: BeadiNodeHandleData<THandles[Key]>;
  };
  name?: string;
};

export type BeadiEdge = Edge & {
  sourceHandle: NonNullable<Edge["sourceHandle"]>;
  targetHandle: NonNullable<Edge["targetHandle"]>;
};

export type BeadiFileData = {
  nodes: Record<UnknownBeadiNode["id"], UnknownBeadiNode>;
  edges: Record<BeadiEdge["id"], BeadiEdge>;
};

export type FileStore = {
  data: BeadiFileData;

  setHandleValue: (nodeId: string, handleId: string, data: any) => void;
  getHandleValue: (nodeId: string, handleId: string) => any;
  updateNode: (nodeId: string, recipe: (node: Draft<UnknownBeadiNode>) => void) => void;
  overwrite: (file: BeadiFileData) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addEdge: (edge: Omit<BeadiEdge, "id">) => string;
  addNode: (type: string, pos: XYPosition) => string;

  exportJson: () => any;
  importJson: (data: any) => void;
  //   reset: () => void;
};
export function makeFileStore(beadiInstance: BeadiInstance, initialData: BeadiFileData) {
  return createStore<FileStore>()(
    immer((set, get) => ({
      data: initialData,

      addNode: (type, pos) => {
        const id = "" + Date.now();
        const nodeDef = beadiInstance.context.nodeDefs[type];
        set((draft) => {
          draft.data.nodes[id] = {
            id: id,
            position: pos,
            type: type,
            data: {
              displaySettings: {},
              handles: _.mapValues(beadiInstance.getNodeInputs(nodeDef.type, {}), (handle) => ({
                preview: false,
                value: handle.default,
              })),
              settings: {},
            },
          };
        });
        return id;
      },
      addEdge: (edge) => {
        const id = `${edge.source}${edge.sourceHandle}=${edge.target}${edge.targetHandle}`;
        set((draft) => {
          draft.data.edges[id] = {
            ...edge,
            id: id,
          };
        });
        return id;
      },
      onConnect: (connection) => {
        if (
          connection.source !== null &&
          connection.sourceHandle !== null &&
          connection.target !== null &&
          connection.targetHandle !== null
        ) {
          get().addEdge(connection as any);
        } else {
          console.warn("onConnect with null values is not supported.");
        }
      },
      onNodesChange: (changes) => {
        const newNodes = _.keyBy(applyNodeChanges(changes, Object.values(get().data.nodes)), (it) => it.id) as Record<
          string,
          UnknownBeadiNode
        >;
        set((draft) => {
          draft.data.nodes = newNodes;
        });
        // set((draft) => {
        //   for (const c of changes) {
        //     if (c.type === "add") {
        //       console.warn("Add is not yet handled.");
        //     } else if (c.type === "dimensions") {
        //       console.warn("Dimensions is not yet handled.");
        //     } else if (c.type === "position") {
        //       if (c.position !== undefined) {
        //         draft.data.nodes[c.id].position = c.position;

        //         const doDelete = [];
        //         for (const eId in draft.data.edges) {
        //           if (draft.data.edges[eId].target == c.id || draft.data.edges[eId].source == c.id) {
        //             doDelete.push(eId);
        //           }
        //         }
        //         for (const eId of doDelete) {
        //           delete draft.data.edges[eId];
        //         }
        //       } else {
        //         console.warn("Position without position is not yet handled.");
        //       }
        //     } else if (c.type === "remove") {
        //       delete draft.data.nodes[c.id];
        //     } else if (c.type === "reset") {
        //       console.warn("Reset is not yet handled.");
        //     } else if (c.type === "select") {
        //       console.warn("Select is not yet handled.");
        //     }
        //   }
        // });
      },
      onEdgesChange: (changes) => {
        const newEdges = _.keyBy(applyEdgeChanges(changes, Object.values(get().data.edges)), (it) => it.id) as Record<string, BeadiEdge>;
        set((draft) => {
          draft.data.edges = newEdges;
        });
      },

      setHandleValue: (nodeId, handleId, data) => {
        set((store) => {
          const node = store.data.nodes[nodeId];
          if (node !== undefined) {
            if (!(handleId in node.data.handles)) {
              node.data.handles[handleId] = {
                preview: false,
                value: data,
              };
            } else {
              node.data.handles[handleId].value = data;
            }
          } else {
            console.trace("Tried to set handle of node, but node '", nodeId, "' does not exist.");
          }
        });
      },

      getHandleValue: (nodeId, handleId) => {
        const node = get().data.nodes[nodeId];
        if (node !== undefined) {
          return node.data.handles[handleId]?.value ?? null;
        } else {
          return null;
        }
      },

      overwrite: (file) => {
        set((store) => (store.data = file));
      },
      updateNode: (nodeId, recipe) => {
        set((store) => {
          const node = store.data.nodes[nodeId];
          if (node !== undefined) {
            recipe(node);
          } else {
            console.trace("Tried to update nonexisting node '", nodeId, "'");
          }
        });
      },
      exportJson: () => {
        return {
          version: 2,
          data: get().data,
        };
      },
      importJson: (data: any) => {
        //TODO Sanitize input

        //Crude cleaning of possibly weird javascript objects.
        const cleanData = JSON.parse(JSON.stringify(data));
        console.warn("TODO importing unsanitized input data:", data, " => ", cleanData);
        set({
          data: cleanData,
        });
      },
    }))
  );
}

export type UseInputHandleData<T> = [T, (value: T) => void];
export function useInputHandleData<T>(nodeId: string, handleId: string): UseInputHandleData<T> {
  const value = useFileStore((state) => {
    return state.data.nodes[nodeId]?.data?.handles?.[handleId]?.value;
  });
  const setHandle = useFileStore((state) => state.setHandleValue);
  const setValue = useCallback(
    (value: T) => {
      setHandle(nodeId, handleId, value);
    },
    [setHandle, nodeId, handleId]
  );

  return [value as T, setValue];
}

export const ResetDocument: BeadiFileData = {
  edges: {},
  nodes: {
    // welcome: {
    //   id: "welcome",
    //   type: "welcome",
    //   position: {
    //     x: 0,
    //     y: 0,
    //   },
    //   data: {
    //     displaySettings: {},
    //     handles: {},
    //     settings: {},
    //   },
    // },
  },
};

export { useFileStore };
