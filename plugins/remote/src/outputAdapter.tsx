import { sendMessage } from "./message";

import { OutputAdapterDef, OutputAdapterSettingsEditorProps } from "@beadi/engine";
import { HandleType, asHandleType } from "@beadi/engine";
import { notNull } from "@beadi/engine";
import { FunctionComponent } from "react";
import { useRemoteStateStore } from "./remote/remoteStore";
import { usePublishStateStore } from "./publish/publishStore";
import { Select } from "@beadi/components";

export type RemoteOutputAdapterSettings = {
  type: HandleType;
};

export const RemoteOutputSettingsEditor: FunctionComponent<OutputAdapterSettingsEditorProps<RemoteOutputAdapterSettings>> = ({
  settings,
  updateSettings,
}) => {
  const updateType = (type: HandleType | null) => {
    updateSettings({
      ...settings,
      type: type ?? "number",
    });
  };

  return (
    <div>
      <Select
        options={["number", "boolean", "impulse"] as HandleType[]}
        allowUnselect={false}
        selected={settings?.type ?? null}
        renderOption={(s) => s}
        onSelect={updateType}
      />
    </div>
  );
};

export const REMOTE_OUTPUT_ADAPTER_ID = "remoteOutput";
export const remoteOutputAdapter: OutputAdapterDef<number, RemoteOutputAdapterSettings> = {
  id: REMOTE_OUTPUT_ADAPTER_ID,
  getType: (settings) => settings?.type,
  pushData: (nodeId, data, settings) => {
    if (settings === undefined) {
      return;
    }
    if (settings.type === "impulse") {
      console.error("Output impulses are not yet supported.");
    }
    const safeValue = asHandleType(settings.type, data);
    if (safeValue !== undefined) {
      usePublishStateStore.getState().state.updateValue(nodeId, safeValue, true);
    }
  },
  label: "Remote Display",
  settingsEditor: RemoteOutputSettingsEditor,
};

export type RemoteOutputToInputAdapterSettings = {
  value: {
    valueId: string;
    remoteId: string;
  } | null;
};

export const RemoteOutputToInputSettingsEditor: FunctionComponent<OutputAdapterSettingsEditorProps<RemoteOutputToInputAdapterSettings>> = ({
  settings,
  updateSettings,
}) => {
  const values = useRemoteStateStore((s) =>
    Object.values(s.remotes)
      .flatMap((remote) => {
        if (remote.state.state === "connected") {
          return Object.values(remote.state.values).map((value) => ({
            value: value,
            remote: remote.definition,
          }));
        } else {
          return null;
        }
      })
      .filter(notNull)
  );

  const selected = values.find(
    (it) => it.remote.remoteConnectionId === settings?.value?.remoteId && it.value.valueId === settings?.value?.valueId
  );

  const updateValue = (s: (typeof values)[number] | null) => {
    if (s === null) {
      updateSettings({
        value: null,
      });
    } else {
      updateSettings({
        value: {
          remoteId: s.remote.remoteConnectionId,
          valueId: s.value.valueId,
        },
      });
    }
  };

  return (
    <div>
      <Select
        options={values}
        allowUnselect={false}
        selected={selected ?? null}
        renderOption={(s) => (
          <>
            {" "}
            {s.remote.code} - {s.value.name}
          </>
        )}
        onSelect={updateValue}
      />
    </div>
  );
};

export const remoteOutputToInputAdapter: OutputAdapterDef<number, RemoteOutputToInputAdapterSettings> = {
  id: "remoteOutputToInput",
  getType: (settings) => {
    if (settings?.value != null) {
      const remote = useRemoteStateStore.getState().remotes[settings.value.remoteId]?.state;
      if (remote !== undefined) {
        if (remote.state === "connected") {
          return remote.values[settings.value.valueId]?.type;
        }
      }
    }
  },
  pushData: (_nodeId, data, settings) => {
    if (settings?.value != null) {
      const remote = useRemoteStateStore.getState().remotes[settings.value.remoteId]?.state;
      if (remote !== undefined) {
        if (remote.state === "connected") {
          sendMessage(remote.socket, {
            ValueChanged: {
              endpoint: settings.value.valueId,
              value: data,
            },
          });
        }
      }
    }
  },
  label: "Set Remote Value",
  settingsEditor: RemoteOutputToInputSettingsEditor,
};
