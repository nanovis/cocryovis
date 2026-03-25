import type {
  TableColumnDefinition,
  TableColumnSizingOptions,
} from "@fluentui/react-components";
import {
  Tooltip,
  createTableColumn,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCellLayout,
  TableCell,
  useTableColumnSizing_unstable,
  useTableFeatures,
  Text,
  tokens,
  Spinner,
} from "@fluentui/react-components";
import { Hourglass24Regular } from "@fluentui/react-icons";
import globalStyles from "../../../globalStyles";
import { observer } from "mobx-react-lite";
import type { TaskQueueItem } from "@/stores/userState/Status";
import { useState } from "react";

const columnsDef: TableColumnDefinition<TaskQueueItem>[] = [
  createTableColumn<TaskQueueItem>({
    columnId: "taskStatus",
    renderHeaderCell: () => <>Status</>,
  }),
  createTableColumn<TaskQueueItem>({
    columnId: "taskType",
    renderHeaderCell: () => <>Task Type</>,
  }),
  createTableColumn<TaskQueueItem>({
    columnId: "user",
    renderHeaderCell: () => <>User</>,
  }),
  createTableColumn<TaskQueueItem>({
    columnId: "enqueuedTime",
    renderHeaderCell: () => <>Enqueued Time</>,
  }),
  createTableColumn<TaskQueueItem>({
    columnId: "startTime",
    renderHeaderCell: () => <>Start Time</>,
  }),
];

interface Props {
  taskQueueItems: TaskQueueItem[];
}

const TaskQueueTable = observer(({ taskQueueItems }: Props) => {
  const globalClasses = globalStyles();

  const [columns] = useState(columnsDef);

  const [columnSizingOptions] = useState<TableColumnSizingOptions>({
    taskStatus: {
      idealWidth: 40,
      minWidth: 40,
      defaultWidth: 40,
    },
    taskType: {
      minWidth: 10,
      idealWidth: 100,
      defaultWidth: 100,
    },
    user: {
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
  });

  const { getRows, columnSizing_unstable, tableRef } =
    useTableFeatures<TaskQueueItem>(
      {
        columns,
        items: taskQueueItems,
      },
      [useTableColumnSizing_unstable({ columnSizingOptions })]
    );

  const rows = getRows();

  return (
    <div
      style={{ overflowX: "auto", scrollbarGutter: "stable", width: "100%" }}
    >
      <Table ref={tableRef} {...columnSizing_unstable.getTableProps()}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
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
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ item }) => (
            <TableRow key={item.id}>
              <TableCell
                {...columnSizing_unstable.getTableCellProps("taskStatus")}
              >
                <TableCellLayout truncate style={{ marginLeft: "5px" }}>
                  {item.taskStatus.ongoing ? (
                    <Tooltip
                      content="Task running"
                      relationship="label"
                      appearance="inverted"
                      positioning="below"
                      withArrow={true}
                    >
                      <Spinner size="extra-small" />
                    </Tooltip>
                  ) : (
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
              <TableCell {...columnSizing_unstable.getTableCellProps("user")}>
                <TableCellLayout truncate>
                  {!item.user.user ? (
                    <Text
                      style={{ color: tokens.colorNeutralForeground3 }}
                      italic={true}
                    >
                      deleted
                    </Text>
                  ) : (
                    <Text>{item.user.user.username}</Text>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

export default TaskQueueTable;
