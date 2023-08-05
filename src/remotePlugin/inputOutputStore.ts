import create from "zustand";
import { FileStore, useFileStore } from "../engine/store";
import produce from "immer";
import _ from "lodash";
import { INPUT_ADAPTER_NODE_ID, InputAdapterNodeSettings } from "../nodes/InputAdapterNode";
import { REMOTE_INPUT_ADAPTER_ID, RemoteInputAdapterSettings } from "./inputAdapter";
import { devtools } from "zustand/middleware";
import { diffByKeys } from "../utils/diffBy";
import { HandleType } from "../engine/node";
import { SignalEmissions } from "../engine/signal";
import { OUTPUT_ADAPTER_NODE_ID, OutputAdapterNodeSettings } from "../nodes/OutputAdapterNode";
import { REMOTE_OUTPUT_ADAPTER_ID, RemoteOutputAdapterSettings } from "./outputAdapter";

export type IOValueDef<T> = {
  valueId: string;
  type: HandleType;
  name: string;
  writeable: boolean;
  //And additional metadata
};
export type IOValueState<T> = {
  value: T;
} & IOValueDef<T>;

type IOValueStore = {
  //   values: Record<string, RemoteValueState<any>>;
  values: Record<string, IOValueState<any>>;

  /** Set value in IOValueStore*/
  setValue: (valueId: string, value: any) => void;

  /** Will collect all signal emissions between two runs */
  signalBuffer: Record<string, SignalEmissions<any>>;

  /** Send signal the signalBuffer, that will then be consumed at the start of the next run */
  emitSignal: (valueId: string, data?: any) => void;
};

/** Used by all input-/outputAdapters to push/pull their values from/to */
export const useIOValueStore = create(
  devtools<IOValueStore>(
    (set, get) => ({
      values: {},
      setValue: (id, value) => {
        set((s) =>
          produce(s, (draft) => {
            draft.values[id].value = value;
          })
        );
      },
      signalBuffer: {},
      emitSignal: (valueId, data) => {
        set((s) =>
          produce(s, (draft) => {
            if (!(valueId in draft.signalBuffer)) {
              draft.signalBuffer[valueId] = [];
            }
            draft.signalBuffer[valueId].push(data ?? null);
          })
        );
      },
    }),

    { name: "useIOValueStore" }
  )
);

export function tempPopSignalBuffer() {
  useIOValueStore.setState((s) =>
    produce(s, (draft) => {
      for (const valueId in draft.signalBuffer) {
        draft.values[valueId] = {
          valueId: valueId,
          name: "Todo name",
          type: "impulse",
          value: draft.signalBuffer[valueId],
          writeable: draft.values[valueId].writeable ?? true,
        };
        draft.signalBuffer[valueId] = [];
      }
    })
  );
}

export function tempSyncIOValueStore() {
  const func = (state: FileStore) => {
    const adapterNodes: Record<string, IOValueDef<any>> = _.mapValues(
      _.pickBy(state.data.nodes, (it) => {
        if (it.type === INPUT_ADAPTER_NODE_ID) {
          const settings = it.data.settings as InputAdapterNodeSettings | undefined;
          if (settings?.adapterId === REMOTE_INPUT_ADAPTER_ID) {
            const adapterSettings = settings.adapterSettings?.[REMOTE_INPUT_ADAPTER_ID] as RemoteInputAdapterSettings | undefined;
            return adapterSettings != null;
          }
          // }else if(it.type === "outputAdapter") {
          //     const settings = it.data.settings as OutputAdapterNodeSettings;
          //     return settings.adapterId === "remoteOutput";
        } else if (it.type === OUTPUT_ADAPTER_NODE_ID) {
          const settings = it.data.settings as OutputAdapterNodeSettings | undefined;
          if (settings?.adapterId === REMOTE_OUTPUT_ADAPTER_ID) {
            const adapterSettings = settings.adapterSettings?.[REMOTE_OUTPUT_ADAPTER_ID] as RemoteInputAdapterSettings | undefined;
            return adapterSettings != null;
          }
        }
        return false;
      }),
      (node) => {
        if (node.type === INPUT_ADAPTER_NODE_ID) {
          const adapterSettings = (node.data.settings as InputAdapterNodeSettings).adapterSettings[
            REMOTE_INPUT_ADAPTER_ID
          ] as RemoteInputAdapterSettings;
          return {
            type: adapterSettings.type,
            valueId: node.id,
            name: node.data.name ?? node.id,
            writeable: true,
          } satisfies IOValueDef<any>;
        } else if (node.type === OUTPUT_ADAPTER_NODE_ID) {
          const adapterSettings = (node.data.settings as OutputAdapterNodeSettings).adapterSettings[
            REMOTE_OUTPUT_ADAPTER_ID
          ] as RemoteOutputAdapterSettings;
          return {
            type: adapterSettings.type,
            valueId: node.id,
            name: node.data.name ?? node.id,
            writeable: false,
          } satisfies IOValueDef<any>;
        } else {
          throw new Error("Unknown nodeType was exposed to the ioStore");
        }
      }
    );
    console.log("adapterNodes: ", adapterNodes);

    useIOValueStore.setState((state) => {
      const localValues = Object.values(state.values);

      // const missingValues = _.differenceWith(inputAdapterNodes, localValues, (node, value) => node.id === value.valueId);
      // const extraValues = _.differenceWith(localValues, inputAdapterNodes, (value, node) => node.id === value.valueId);

      const { extra, missing, changed } = diffByKeys(state.values, adapterNodes, (a, b) => a.type === b.type && a.name === b.name);
      console.log("useIOValueStore setState: ", localValues, "+", missing, " -", extra);

      return produce(state, (draft) => {
        for (const extraKey in extra) {
          delete draft.values[extraKey];
        }
        for (const missingKey in missing) {
          draft.values[missingKey] = {
            value: 0.0,
            ...missing[missingKey],
          };
        }
        console.log("CCC: ", changed);
        for (const changedKey in changed) {
          draft.values[changedKey] = {
            value: 0.0,
            ...changed[changedKey][1],
          };
        }
      });
    });
  };

  useFileStore.subscribe(func);

  func(useFileStore.getState());
}
