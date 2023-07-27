import create from "zustand";
import { FileStore, useFileStore } from "../engine/store";
import produce from "immer";
import _ from "lodash";
import { InputAdapterNodeSettings } from "../nodes/InputAdapterNode";

type IOValueState<T> = {
  valueId: string;
  value: T;
  type: string;
  //And additional metadata
};

type IOValueStore = {
  //   values: Record<string, RemoteValueState<any>>;
  values: Record<string, IOValueState<any>>;

  /** Send value update request */
  setValue: (valueId: string, value: any) => void;
};

/** Used by all input-/outputAdapters to push/pull their values from/to */
export const useIOValueStore = create<IOValueStore>()((set, get) => ({
  values: {},
  setValue: (id, value) => {
    set((s) =>
      produce(s, (draft) => {
        draft.values[id].value = value;
      })
    );
  },
}));

export function tempSyncIOValueStore() {
  const func = (state: FileStore) => {
    const inputAdapterNodes = Object.values(state.data.nodes).filter((it) => {
      if (it.type === "inputAdapter") {
        const settings = it.data.settings as InputAdapterNodeSettings;
        return settings.adapterId === "remoteInput";
        // }else if(it.type === "outputAdapter") {
        //     const settings = it.data.settings as OutputAdapterNodeSettings;
        //     return settings.adapterId === "remoteOutput";
      }
      return false;
    });
    console.log("inputAdapterNodes: ", inputAdapterNodes);

    useIOValueStore.setState((state) => {
      const localValues = Object.values(state.values);

      const missingValues = _.differenceWith(inputAdapterNodes, localValues, (node, value) => node.id === value.valueId);
      const extraValues = _.differenceWith(localValues, inputAdapterNodes, (value, node) => node.id === value.valueId);

      console.log("useIOValueStore setState: ", localValues, "+", missingValues, " -", extraValues);

      return produce(state, (draft) => {
        for (const extra of extraValues) {
          delete draft.values[extra.valueId];
        }
        for (const missing of missingValues) {
          draft.values[missing.id] = {
            type: "number", //TODO Real type here
            value: 0,
            valueId: missing.id,
          };
        }
      });
    });
  };

  useFileStore.subscribe(func);

  func(useFileStore.getState());
}
