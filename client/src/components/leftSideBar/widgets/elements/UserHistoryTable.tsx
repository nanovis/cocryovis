import {
  makeStyles,
  Link,
  Tooltip,
  TableColumnDefinition,
  createTableColumn,
  Table,
  TableHeader,
  TableRow,
  Menu,
  MenuTrigger,
  TableHeaderCell,
  MenuPopover,
  MenuList,
  MenuItem,
  TableBody,
  TableCellLayout,
  TableCell,
  useTableColumnSizing_unstable,
  useTableFeatures,
  TableColumnSizingOptions,
  Text,
  tokens,
  Spinner,
} from "@fluentui/react-components";
import {
  BrainCircuit24Regular,
  Checkmark24Filled,
  ClipboardTextRtl24Regular,
  Cube24Regular,
  ErrorCircle24Filled,
  Hourglass24Regular,
} from "@fluentui/react-icons";
import React from "react";
import globalStyles from "../../../GlobalStyles";
import { observer } from "mobx-react-lite";
import { TaskHistoryItem } from "../../../../stores/userState/Status";
import { apiUrl } from "../../../../urls";
import Utils from "../../../../functions/Utils";

const useStyles = makeStyles({
  dataIcon: {
    color: tokens.colorBrandForeground1,
    minWidth: "24px",
  },
  dataContainer: {
    display: "flex",
    alignItems: "center",
  },
  dataText: {
    marginLeft: "4px",
  },
});

const columnsDef: TableColumnDefinition<TaskHistoryItem>[] = [
  createTableColumn<TaskHistoryItem>({
    columnId: "taskStatus",
    renderHeaderCell: () => <>Status</>,
  }),
  createTableColumn<TaskHistoryItem>({
    columnId: "taskType",
    renderHeaderCell: () => <>Task Type</>,
  }),
  createTableColumn<TaskHistoryItem>({
    columnId: "data",
    renderHeaderCell: () => <>Data</>,
  }),
  createTableColumn<TaskHistoryItem>({
    columnId: "enqueuedTime",
    renderHeaderCell: () => <>Enqueued Time</>,
  }),
  createTableColumn<TaskHistoryItem>({
    columnId: "startTime",
    renderHeaderCell: () => <>Start Time</>,
  }),
  createTableColumn<TaskHistoryItem>({
    columnId: "endTime",
    renderHeaderCell: () => <>End Time</>,
  }),
  createTableColumn<TaskHistoryItem>({
    columnId: "log",
    renderHeaderCell: () => <>Log</>,
  }),
];

interface Props {
  taskHistoryItems: TaskHistoryItem[];
}

const UserHistoryTable = observer(({ taskHistoryItems }: Props) => {
  const classes = useStyles();
  const globalClasses = globalStyles();

  const [columns] =
    React.useState<TableColumnDefinition<TaskHistoryItem>[]>(columnsDef);

  const [columnSizingOptions] = React.useState<TableColumnSizingOptions>({
    taskStatus: {
      idealWidth: 40,
      defaultWidth: 40,
      minWidth: 40,
    },
    taskType: {
      minWidth: 10,
      idealWidth: 100,
      defaultWidth: 100,
    },
    data: {
      minWidth: 10,
    },
    enqueuedTime: {
      minWidth: 10,
      idealWidth: 97,
    },
    startTime: {
      minWidth: 10,
      idealWidth: 75,
    },
    endTime: {
      minWidth: 10,
      idealWidth: 75,
    },
    log: {
      minWidth: 25,
      defaultWidth: 25,
      idealWidth: 25,
    },
  });

  const { getRows, columnSizing_unstable, tableRef } =
    useTableFeatures<TaskHistoryItem>(
      {
        columns,
        items: taskHistoryItems,
      },
      [useTableColumnSizing_unstable({ columnSizingOptions })]
    );

  const rows = getRows();

  return (
    <div style={{ overflowX: "auto" }}>
      <Table
        sortable
        aria-label="Table with sort"
        ref={tableRef}
        {...columnSizing_unstable.getTableProps()}
      >
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <Menu openOnContext key={column.columnId}>
                <MenuTrigger>
                  <TableHeaderCell
                    key={column.columnId}
                    {...columnSizing_unstable.getTableHeaderCellProps(
                      column.columnId
                    )}
                  >
                    <TableCellLayout truncate>
                      {column.renderHeaderCell()}
                    </TableCellLayout>
                  </TableHeaderCell>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      onClick={columnSizing_unstable.enableKeyboardMode(
                        column.columnId
                      )}
                    >
                      Keyboard Column Resizing
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ item }, index) => (
            <TableRow key={index}>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("taskStatus")}
              >
                <TableCellLayout truncate style={{ marginLeft: "5px" }}>
                  {item.taskStatus.id === 2 ? (
                    <Tooltip
                      content="Task completed"
                      relationship="label"
                      appearance="inverted"
                      positioning="below"
                      withArrow={true}
                    >
                      <Checkmark24Filled
                        className={globalClasses.successIcon}
                      />
                    </Tooltip>
                  ) : item.taskStatus.id === 1 ? (
                    <Tooltip
                      content="Task running"
                      relationship="label"
                      appearance="inverted"
                      positioning="below"
                      withArrow={true}
                    >
                      <Spinner size="extra-small" />
                    </Tooltip>
                  ) : item.taskStatus.id === 0 ? (
                    <Tooltip
                      content="Task queued"
                      relationship="label"
                      appearance="inverted"
                      positioning="below"
                      withArrow={true}
                    >
                      <Hourglass24Regular
                        className={globalClasses.successIcon}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip
                      content="Task failed"
                      relationship="label"
                      appearance="inverted"
                      positioning="below"
                      withArrow={true}
                    >
                      <ErrorCircle24Filled className={globalClasses.failIcon} />
                    </Tooltip>
                  )}
                </TableCellLayout>
              </TableCell>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("taskType")}
              >
                <TableCellLayout truncate>
                  {item.taskType.label}
                </TableCellLayout>
              </TableCell>
              <TableCell {...columnSizing_unstable.getTableCellProps("data")}>
                <TableCellLayout truncate>
                  {item.data.volume && (
                    <div className={classes.dataContainer}>
                      <Tooltip
                        content={"Volume"}
                        relationship={"label"}
                        appearance="inverted"
                        positioning="below"
                        withArrow={true}
                      >
                        <Cube24Regular className={classes.dataIcon} />
                      </Tooltip>
                      {item.data.volume === "deleted" ? (
                        <Text
                          style={{ color: tokens.colorNeutralForeground3 }}
                          italic={true}
                          className={classes.dataText}
                        >
                          deleted
                        </Text>
                      ) : (
                        <Text className={classes.dataText}>
                          {item.data.volume.name}
                        </Text>
                      )}
                    </div>
                  )}
                  {item.data.model && (
                    <div className={classes.dataContainer}>
                      <Tooltip
                        content={"Model"}
                        relationship={"label"}
                        appearance="inverted"
                        positioning="below"
                        withArrow={true}
                      >
                        <BrainCircuit24Regular className={classes.dataIcon} />
                      </Tooltip>
                      {item.data.model === "deleted" ? (
                        <Text
                          style={{ color: tokens.colorNeutralForeground3 }}
                          italic={true}
                          className={classes.dataText}
                        >
                          deleted
                        </Text>
                      ) : (
                        <Text className={classes.dataText}>
                          {item.data.model.name}
                        </Text>
                      )}
                    </div>
                  )}
                  {item.data.checkpoint && (
                    <div className={classes.dataContainer}>
                      <Tooltip
                        content={"Checkpoint"}
                        relationship={"label"}
                        appearance="inverted"
                        positioning="below"
                        withArrow={true}
                      >
                        <BrainCircuit24Regular className={classes.dataIcon} />
                      </Tooltip>
                      {item.data.checkpoint === "deleted" ? (
                        <Text
                          style={{ color: tokens.colorNeutralForeground3 }}
                          italic={true}
                          className={classes.dataText}
                        >
                          deleted
                        </Text>
                      ) : (
                        <Text className={classes.dataText}>
                          {Utils.shortFileNameFromPath(
                            item.data.checkpoint.filePath
                          )}
                        </Text>
                      )}
                    </div>
                  )}
                </TableCellLayout>
              </TableCell>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("enqueuedTime")}
              >
                <TableCellLayout truncate>
                  <Tooltip
                    content={item.enqueuedTime.date.toLocaleString()}
                    relationship={"description"}
                    appearance="inverted"
                    positioning="below"
                    withArrow={true}
                  >
                    <Text>{item.enqueuedTime.date.toLocaleDateString()}</Text>
                  </Tooltip>
                </TableCellLayout>
              </TableCell>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("startTime")}
              >
                <TableCellLayout truncate>
                  <Tooltip
                    content={item.startTime.date?.toLocaleString() ?? ""}
                    relationship={"description"}
                    appearance="inverted"
                    positioning="below"
                    withArrow={true}
                  >
                    <Text>
                      {item.startTime.date?.toLocaleDateString() ?? "-"}
                    </Text>
                  </Tooltip>
                </TableCellLayout>
              </TableCell>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("endTime")}
              >
                <TableCellLayout truncate>
                  <Tooltip
                    content={item.endTime.date?.toLocaleString() ?? ""}
                    relationship={"description"}
                    appearance="inverted"
                    positioning="below"
                    withArrow={true}
                  >
                    <Text>
                      {item.endTime.date?.toLocaleDateString() ?? "-"}
                    </Text>
                  </Tooltip>
                </TableCellLayout>
              </TableCell>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("endTime")}
              >
                <TableCellLayout truncate>
                  <Link target="_" href={`${apiUrl}/logs/${item.log.path}`}>
                    <Tooltip
                      content="Open Log"
                      relationship="label"
                      appearance="inverted"
                      positioning="after"
                      withArrow={true}
                    >
                      <ClipboardTextRtl24Regular
                        style={{ verticalAlign: "middle" }}
                      />
                    </Tooltip>
                  </Link>
                </TableCellLayout>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

export default UserHistoryTable;
