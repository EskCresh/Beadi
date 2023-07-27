import { AnyRemoteWidgetDef, RemoteWidgetDef } from "./interface/widget";
// import { sliderWidgetDef } from "./widgets/SliderWidget";

const remoteWidgetsList: AnyRemoteWidgetDef[] = [];

export const remoteWidgets: Record<string, AnyRemoteWidgetDef> = Object.assign({}, ...remoteWidgetsList.map((it) => ({ [it.id]: it })));
