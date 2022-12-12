import _ from "lodash";
import { FunctionComponent, useCallback, useMemo } from "react";
import { useReactFlow } from "reactflow";
import { nodeDefs } from "../engine/node";
import { useDataStore } from "../engine/store";

const Drawer: FunctionComponent<{}> = (a) => {
  const nodes = useMemo(() => {
    return _.chain(Object.values(nodeDefs))
      .groupBy((it) => it.category.label)
      .map((value, key) => ({
        name: key,
        color: value[0].category.color,
        items: value,
      }))
      .value();
  }, []);

  const addNode = useDataStore((state) => state.addNode);

  const handleClick = useCallback(
    (type: string) => {
      addNode(type);
    },
    [addNode]
  );

  return (
    <div className="bg-slate-800 w-60">
      <ul>
        {nodes.map((category, index) => (
          <li>
            <h2
              className="px-2 py-1"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </h2>
            <ul>
              {category.items.map((node, index) => (
                <li
                  key={index}
                  draggable
                  className="p-1 px-4 text-white cursor-pointer"
                  onClick={() => handleClick(node.type)}
                >
                  {node.label}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Drawer;
