//Status.js
import {
  makeStyles,
  TabList,
  Tab,
  Spinner,
  Text,
} from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  bundleIcon,
  HistoryFilled,
  HistoryRegular,
  HourglassHalfRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import globalStyles from "../../globalStyles";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import UserHistoryTable from "./elements/UserHistoryTable";
import TaskQueueTable from "./elements/TaskQueueTable";
import Paganation from "../../shared/Pagination";
import { getErrorMessage } from "@/utils/helpers";
import ToastContainer from "../../../utils/toastContainer";
import { usePolling } from "@/hooks/usePooling";
import GpuIcon from "@/assets/icons/gpu-icon.svg?react";

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

  table: {
    minHeight: "523px",
    maxHeight: "523px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  tableLoader: {
    margin: "auto",
  },
});

interface Props {
  open: boolean;
  close: () => void;
}

function getGpuStatusColor(freeGpus: number, totalGpus: number) {
  if (freeGpus === 0) {
    return "var(--colorNeutralForeground3)";
  } else if (freeGpus === totalGpus) {
    return "var(--colorBrandForeground1)";
  } else {
    return "var(--colorPaletteYellowBorder2)";
  }
}

const Status = observer(({ open, close }: Props) => {
  const { user } = useMst();
  const classes = useStyles();
  const globalClasses = globalStyles();

  const gpuColor = user.status
    ? getGpuStatusColor(user.status.freeGpus, user.status.totalGpus)
    : "var(--colorNeutralForeground3)";

  usePolling(
    () => user.status?.fetchGpuStatus(),
    user.status !== undefined && open ? 5000 : null,
    { immediate: true }
  );

  const HistoryIcon = bundleIcon(HistoryFilled, HistoryRegular);

  const [selectedIndex, setSelectedIndex] = useState(0);

  async function setPageNumber(pageNumber: number) {
    try {
      await user.status?.setPageNumber(pageNumber);
    } catch (error) {
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
    }
  }

  // FIXME slides to the right when new operations are qeued.
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
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <TabList
              selectedValue={selectedIndex}
              onTabSelect={(_event, data) =>
                setSelectedIndex(Number(data.value))
              }
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
            {user.status && (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  height: 45,
                }}
              >
                <GpuIcon
                  fill="currentcolor"
                  style={{
                    color: gpuColor,
                    marginRight: "12px",
                  }}
                  width={40}
                />
                <div style={{ display: "flex" }}>
                  <Text
                    size={800}
                    style={{
                      color: gpuColor,
                      marginRight: "8px",
                      lineHeight: "100%",
                      textAlign: "center",
                    }}
                  >
                    {user.status.freeGpus}/{user.status.totalGpus}
                  </Text>
                  <Text
                    size={400}
                    style={{
                      color: gpuColor,
                      width: 50,
                      lineHeight: "100%",
                    }}
                  >
                    <b>GPUs</b> Free
                  </Text>
                </div>
              </div>
            )}
          </div>
          <div>
            {selectedIndex === 0 && (
              <>
                <div className={classes.table}>
                  <UserHistoryTable
                    taskHistoryItems={user.status?.taskHistoryItems() ?? []}
                  />
                  {user.status?.taskHistory.size === 0 &&
                    user.status.activeRequests > 0 && (
                      <div className={classes.tableLoader}>
                        <Spinner appearance="primary" size="huge" />
                      </div>
                    )}
                </div>
                {user.status && user.status.taskHistory.size !== 0 && (
                  <Paganation
                    pageSkip={user.status.pageSkip}
                    pageSize={user.status.pageSize}
                    pageNumber={user.status.pageNumber}
                    maxPageNumber={user.status.maxPageNumber}
                    ListLenght={user.status.taskHistoryLenght}
                    setPageNumberFunction={(pageNumber) =>
                      setPageNumber(pageNumber)
                    }
                    showSpinner={user.status.activeRequests > 0}
                  ></Paganation>
                )}
              </>
            )}
            {selectedIndex === 1 && (
              <div className={classes.table}>
                <TaskQueueTable
                  taskQueueItems={user.status?.cpuTaskQueueItems() ?? []}
                />
                {user.status?.cpuTaskQueue.length === 0 &&
                  user.status.activeRequests > 0 && (
                    <div className={classes.tableLoader}>
                      <Spinner appearance="primary" size="huge" />
                    </div>
                  )}
              </div>
            )}
            {selectedIndex === 2 && (
              <div className={classes.table}>
                <TaskQueueTable
                  taskQueueItems={user.status?.gpuTaskQueueItems() ?? []}
                />
                {user.status?.gpuTaskQueue.length === 0 &&
                  user.status.activeRequests > 0 && (
                    <div className={classes.tableLoader}>
                      <Spinner appearance="primary" size="huge" />
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;
});

export default Status;
