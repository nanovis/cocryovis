//Status.js
import { makeStyles, TabList, Tab, Button } from "@fluentui/react-components";
import {
  ArrowCircleLeft28Regular,
  bundleIcon,
  ChevronDoubleLeftFilled,
  ChevronDoubleRightFilled,
  ChevronLeftFilled,
  ChevronRightFilled,
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

  pagination: {
    display: "flex",
    alignItems: "center",
    marginTop: "30px",
    justifyContent: "end",
    gap: "15px",
  },
  paginationButton: {
    height: "20px",
  },
  table: {
    minHeight: "523px",
    maxHeight: "523px",
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
              <>
                <div className={classes.table}>
                  <UserHistoryTable
                    taskHistoryItems={status?.taskHistoryItems() ?? []}
                  />
                </div>
                {status && status.taskHistory.size !== 0 && (
                  <div className={classes.pagination}>
                    <div>
                      <span>
                        {status.pageSkip - (status.pageSize - 1)} -{" "}
                        {status.pageSkip > status.taskHistoryLenght
                          ? status.taskHistoryLenght
                          : status.pageSkip}{" "}
                        of {status.taskHistoryLenght}
                      </span>
                    </div>
                    <Button
                      className={classes.paginationButton}
                      icon={<ChevronDoubleLeftFilled />}
                      disabled={status.pageNumber <= 1}
                      onClick={() => status?.setPageNumber(1)}
                    ></Button>
                    <Button
                      appearance="secondary"
                      className={classes.paginationButton}
                      icon={<ChevronLeftFilled />}
                      disabled={status.pageNumber <= 1}
                      onClick={() =>
                        status?.setPageNumber(status?.pageNumber - 1)
                      }
                    ></Button>
                    <Button
                      className={classes.paginationButton}
                      icon={<ChevronRightFilled />}
                      disabled={status.maxPageNumber <= status.pageNumber}
                      onClick={() =>
                        status?.setPageNumber(status?.pageNumber + 1)
                      }
                    ></Button>
                    <Button
                      className={classes.paginationButton}
                      icon={<ChevronDoubleRightFilled />}
                      disabled={status.maxPageNumber <= status.pageNumber}
                      onClick={() =>
                        status?.setPageNumber(status.maxPageNumber)
                      }
                    ></Button>
                  </div>
                )}
              </>
            )}
            {selectedIndex === 1 && (
              <div className={classes.table}>
                <TaskQueueTable
                  taskQueueItems={status?.cpuTaskQueueItems() ?? []}
                />
              </div>
            )}
            {selectedIndex === 2 && (
              <div className={classes.table}>
                <TaskQueueTable
                  taskQueueItems={status?.gpuTaskQueueItems() ?? []}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;
});

export default Status;
