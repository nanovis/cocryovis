//Status.js
import { makeStyles, TabList, Tab } from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  bundleIcon,
  HistoryFilled,
  HistoryRegular,
  HourglassHalfRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import globalStyles from "../../GlobalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "../../../stores/RootStore";
import UserHistoryTable from "./elements/UserHistoryTable";
import TaskQueueTable from "./elements/TaskQueueTable";

const useStyles = makeStyles({
  contents: {
    display: "flex",
    flexDirection: "column",
    paddingLeft: "10px",
    paddingTop: "8px",
    paddingRight: "10px",
    justifyContent: "center",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    justifyItems: "center",
    width: "100%",
    margin: "auto",
  },
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "8px",
    marginBottom: "24px",
    paddingLeft: "14px",
    paddingRight: "14px",
  },
});

interface Props {
  open: boolean;
  close: () => void;
}

const Status = observer(({ open, close }: Props) => {
  const classes = useStyles();
  const globalClasses = globalStyles();

  const { user } = useMst();
  const status = user?.status;

  const HistoryIcon = bundleIcon(HistoryFilled, HistoryRegular);

  const [selectedIndex, setSelectedIndex] = useState(0);

  return open ? (
    <div className={globalClasses.leftSidebar} style={{ width: "700px" }}>
      <div className={classes.contents}>
        <div className={classes.header}>
          <h1>Status</h1>
          <div
            onClick={close}
            className={globalClasses.closeSidebarIconContainer}
          >
            <ArrowCircleLeft28Regular
              className={globalClasses.closeSidebarIcon}
            />
          </div>
        </div>
        <div className={classes.body}>
          <TabList
            selectedValue={selectedIndex}
            onTabSelect={(_event, data) => setSelectedIndex(Number(data.value))}
          >
            <Tab id="User Tasks" icon={<HistoryIcon />} value={0}>
              User Tasks
            </Tab>
            <Tab id="CPU Queue" icon={<HourglassHalfRegular />} value={1}>
              CPU Queue
            </Tab>
            <Tab id="GPU Queue" icon={<HourglassHalfRegular />} value={2}>
              GPU Queue
            </Tab>
          </TabList>
          <div>
            {selectedIndex === 0 && (
              <UserHistoryTable
                taskHistoryItems={status?.taskHistoryItems() ?? []}
              />
            )}
            {selectedIndex === 1 && (
              <TaskQueueTable
                taskQueueItems={status?.cpuTaskQueueItems() ?? []}
              />
            )}
            {selectedIndex === 2 && (
              <TaskQueueTable
                taskQueueItems={status?.gpuTaskQueueItems() ?? []}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;
});

export default Status;
