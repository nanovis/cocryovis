import { useState } from "react";

import IconBar from "./RightIconBar";
import Visualization from "./widgets/Visualization";
import RenderSettings from "./widgets/RenderSettings";

const SideControls = () => {
  const [sidebarOpen, setSidebarOpen] = useState([false, false]);

  const toggleIcons = (id: number) => {
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
      <Visualization open={sidebarOpen[0]} close={closeSidebars} />
      <RenderSettings open={sidebarOpen[1]} close={closeSidebars} />
    </>
  );
};

export default SideControls;
