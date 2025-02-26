import { useState } from "react";

import IconBar from "./IconBar";
import Volume from "./widgets/Volume";
import Status from "./widgets/Status";
import NanoOtzi from "./widgets/NanoOtzi";
import Models from "./widgets/Models";
import Local from "./widgets/Local";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";

const SideControls = observer(() => {
  const { user } = useMst();
  const activeProjectId = user?.userProjects.activeProjectId;

  const [sidebarOpen, setSidebarOpen] = useState([
    false,
    false,
    false,
    false,
    false,
  ]);

  const toggleIcons = (id: number) => {
    if (id !== 3 && id !== 4 && !activeProjectId) {
      return;
    }
    if (id === -1) {
      setSidebarOpen(sidebarOpen.map(() => false));
    } else {
      setSidebarOpen((prev) =>
        prev.map((open, i) => (i === id ? !open : false))
      );
    }
  };

  const closeSidebars = () => {
    setSidebarOpen(sidebarOpen.map(() => false));
  };

  return (
    <>
      <IconBar openIcons={sidebarOpen} toggleIcons={toggleIcons} />
      <Volume open={sidebarOpen[0]} close={closeSidebars} />
      <Models open={sidebarOpen[1]} close={closeSidebars} />
      <NanoOtzi open={sidebarOpen[2]} close={closeSidebars} />
      <Status open={sidebarOpen[3]} close={closeSidebars} />
      <Local open={sidebarOpen[4]} close={closeSidebars} />
    </>
  );
});

export default SideControls;
