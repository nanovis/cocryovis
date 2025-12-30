//Status.js
import { makeStyles, TabList, Tab, Spinner } from "@fluentui/react-components";
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
import { useMst } from "@/stores/RootStore";
import UserHistoryTable from "./elements/UserHistoryTable";
import TaskQueueTable from "./elements/TaskQueueTable";
import Paganation from "../../shared/Pagination";
import { getErrorMessage } from "@/utils/Helpers";
import ToastContainer from "../../../utils/ToastContainer";

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

const Status = observer(({ open, close }: Props) => {
  const { user } = useMst();
  const classes = useStyles();
  const globalClasses = globalStyles();

  const status = user.status;

  const HistoryIcon = bundleIcon(HistoryFilled, HistoryRegular);

  const [selectedIndex, setSelectedIndex] = useState(0);

  async function setPageNumber(pageNumber: number) {
    try {
      await status?.setPageNumber(pageNumber);
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
              <>
                <div className={classes.table}>
                  <UserHistoryTable
                    taskHistoryItems={status?.taskHistoryItems() ?? []}
                  />
                  {status?.taskHistory.size === 0 &&
                    status.activeRequests > 0 && (
                      <div className={classes.tableLoader}>
                        <Spinner appearance="primary" size="huge" />
                      </div>
                    )}
                </div>
                {status && status.taskHistory.size !== 0 && (
                  <Paganation
                    pageSkip={status.pageSkip}
                    pageSize={status.pageSize}
                    pageNumber={status.pageNumber}
                    maxPageNumber={status.maxPageNumber}
                    ListLenght={status.taskHistoryLenght}
                    setPageNumberFunction={(pageNumber) =>
                      setPageNumber(pageNumber)
                    }
                    showSpinner={status.activeRequests > 0}
                  ></Paganation>
                )}
              </>
            )}
            {selectedIndex === 1 && (
              <div className={classes.table}>
                <TaskQueueTable
                  taskQueueItems={status?.cpuTaskQueueItems() ?? []}
                />
                {status?.cpuTaskQueue.length === 0 &&
                  status.activeRequests > 0 && (
                    <div className={classes.tableLoader}>
                      <Spinner appearance="primary" size="huge" />
                    </div>
                  )}
              </div>
            )}
            {selectedIndex === 2 && (
              <div className={classes.table}>
                <TaskQueueTable
                  taskQueueItems={status?.gpuTaskQueueItems() ?? []}
                />
                {status?.gpuTaskQueue.length === 0 &&
                  status.activeRequests > 0 && (
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
