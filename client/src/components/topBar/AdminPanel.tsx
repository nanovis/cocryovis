type User = z.infer<typeof publicUser>;
import type {
  TableColumnDefinition,
  TableColumnId,
} from "@fluentui/react-components";
import {
  Button,
  createTableColumn,
  makeStyles,
  mergeClasses,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
  useTableFeatures,
  useTableSort,
} from "@fluentui/react-components";
import { observer } from "mobx-react-lite";
import GlobalStyles from "../globalStyles";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Delete20Regular } from "@fluentui/react-icons";
import DeleteDialog from "../shared/DeleteDialog";
import type { publicUser } from "@cocryovis/schemas/user-path-schema";
import type z from "zod";
import { adminDeleteUser, getAllUsers } from "@/api/users";
import { useMst } from "@/stores/RootStore";
import ToastContainer from "../../utils/toastContainer";
import { getErrorMessage } from "@/utils/helpers";

const useStyles = makeStyles({
  container: {
    padding: "80px 20px 20px 20px",
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  profilePageHeader: {
    marginBottom: "48px",
    fontSize: "32px",
    color: tokens.colorBrandForeground1,
  },

  tableHeaderCell: {
    fontWeight: "bold",
    color: tokens.colorBrandForeground1,
  },
  scrollableBody: {
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    height: "calc(100vh - 250px)",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  refreshButton: {
    margin: "20px",
  },
  refreshContainer: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  tableLoader: {
    margin: "auto",
  },
});

const columns: TableColumnDefinition<User>[] = [
  createTableColumn<User>({
    columnId: "id",
    compare: (a, b) => a.id - b.id,
  }),
  createTableColumn<User>({
    columnId: "username",
    compare: (a, b) => a.username.localeCompare(b.username),
  }),
  createTableColumn<User>({
    columnId: "name",
    compare: (a, b) => a.name.localeCompare(b.name),
  }),
  createTableColumn<User>({
    columnId: "email",
    compare: (a, b) => a.email.localeCompare(b.email),
  }),
];

const AdminPanel = observer(() => {
  const { uiState, user } = useMst();

  const classes = useStyles();
  const globalClasses = GlobalStyles();
  const [users, setUsers] = useState<User[]>([]);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [isPending, startTransition] = useTransition();

  const getUserData = useCallback(async () => {
    try {
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error(error);
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    if (uiState.openAdminPanel) {
      startTransition(async () => {
        await getUserData();
      });
    }
  }, [uiState.openAdminPanel, getUserData]);

  const deleteUser = useCallback(async () => {
    if (userToDelete === null || isPending) return;

    const toastContainer = new ToastContainer();

    try {
      await adminDeleteUser({ id: userToDelete.id });
      await getUserData();
      toastContainer.success("User deleted!");
      setUserToDelete(null);
    } catch (error) {
      console.error(error);
      toastContainer.error(getErrorMessage(error));
    }
  }, [userToDelete, getUserData, isPending]);

  const {
    getRows,
    sort: { getSortDirection, toggleColumnSort, sort },
  } = useTableFeatures(
    {
      columns,
      items: users,
    },
    [
      useTableSort({
        defaultSortState: { sortColumn: "id", sortDirection: "ascending" },
      }),
    ]
  );

  const headerSortProps = (columnId: TableColumnId) => ({
    onClick: (e: MouseEvent) => {
      toggleColumnSort(e, columnId);
    },
    sortDirection: getSortDirection(columnId),
  });

  const rows = sort(getRows());

  if (!uiState.openAdminPanel) return null;
  return (
    <div className={classes.container}>
      <h1 className={classes.profilePageHeader}>Admin Panel</h1>
      <Table sortable aria-label="Sortable user table">
        <TableHeader>
          <TableRow>
            <TableHeaderCell
              className={classes.tableHeaderCell}
              {...headerSortProps("id")}
            >
              ID
            </TableHeaderCell>
            <TableHeaderCell
              className={classes.tableHeaderCell}
              {...headerSortProps("username")}
            >
              Username
            </TableHeaderCell>
            <TableHeaderCell
              className={classes.tableHeaderCell}
              {...headerSortProps("name")}
            >
              Name
            </TableHeaderCell>
            <TableHeaderCell
              className={classes.tableHeaderCell}
              {...headerSortProps("email")}
            >
              Email
            </TableHeaderCell>
            <TableHeaderCell className={classes.tableHeaderCell}>
              Action
            </TableHeaderCell>
          </TableRow>
        </TableHeader>
      </Table>
      <div className={classes.scrollableBody}>
        <Table>
          <TableBody>
            {rows.map(({ item }) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TableCellLayout>{item.id}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>{item.username}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>{item.name}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>{item.email}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>
                    <Button
                      className={mergeClasses(
                        globalClasses.actionButton,
                        globalClasses.actionButtonDelete
                      )}
                      onClick={() => setUserToDelete(item)}
                      disabled={item.admin || isPending}
                    >
                      <div className={globalClasses.actionButtonIconContainer}>
                        <Delete20Regular />
                      </div>
                      <div className="buttonText">Delete</div>
                    </Button>
                  </TableCellLayout>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {isPending && users.length === 0 && (
          <Spinner
            appearance="primary"
            size="huge"
            className={classes.tableLoader}
          />
        )}
      </div>
      {userToDelete && (
        <DeleteDialog
          open={!!userToDelete}
          onClose={function (): void {
            setUserToDelete(null);
          }}
          style={{ width: "500px" }}
          onConfirm={() => {
            startTransition(async () => {
              await deleteUser();
            });
          }}
          TitleText={
            <div>
              Are you sure you want to delete{" "}
              <span
                style={{
                  fontStyle: "italic",
                  color: tokens.colorBrandForeground1,
                }}
              >
                {userToDelete.username}
              </span>
              ?
            </div>
          }
          BodyText={"This account will be permanently deleted!"}
          isActive={user.deleteUserActiveRequest}
        />
      )}
      <div className={classes.refreshContainer}>
        {isPending && users.length !== 0 && (
          <Spinner appearance="primary" size="medium" />
        )}
        <Button
          appearance="secondary"
          className={classes.refreshButton}
          onClick={() => {
            getUserData().catch(console.error);
          }}
          disabled={isPending}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
});

export default AdminPanel;
