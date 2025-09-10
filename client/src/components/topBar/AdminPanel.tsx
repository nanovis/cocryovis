type User = {
  id: number;
  username: string;
  name: string;
  email: string;
};
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
  TableColumnDefinition,
  TableColumnId,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
  useTableFeatures,
  useTableSort,
} from "@fluentui/react-components";
import { observer } from "mobx-react-lite";
import GlobalStyles from "../GlobalStyles";
import { useEffect, useState } from "react";
import { Delete20Regular } from "@fluentui/react-icons";
import DeleteDialog from "../shared/DeleteDialog";
import { usersArray } from "#schemas/user-path-schema.mjs";
import z from "zod";
import { adminDeleteUser, getAllUsers } from "../../api/users";
import { useMst } from "../../stores/RootStore";
import ToastContainer from "../../utils/ToastContainer";
import { getErrorMessage } from "../../utils/Helpers";

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

const AdminPanel = observer(() => {
  const { uiState, user } = useMst();

  const classes = useStyles();
  const globalClasses = GlobalStyles();
  const [users, setUsers] = useState<User[]>([]);

  const [adminPageActiveRequest, setAdminPageActiveRequest] = useState(false);
  const [showDialogPage, setShowDialogPage] = useState(false);
  const [userDeleteIndex, setUserDeleteIndex] = useState(-1);

  useEffect(() => {
    if (uiState.openAdminPanel) {
      getUserData();
    }
  }, [uiState.openAdminPanel]);

  const getUserData = async () => {
    if (adminPageActiveRequest) {
      return;
    }
    setAdminPageActiveRequest(true);
    const toastContainer = new ToastContainer();

    try {
      const usersData: z.infer<typeof usersArray> = await getAllUsers();
      setUsers(usersData);
      toastContainer.success("User deleted!");
    } catch (error) {
      console.error(error);
      toastContainer.error(getErrorMessage(error));
    } finally {
      setAdminPageActiveRequest(false);
    }
  };

  //LOL DELETE user-admin user doesn't exist
  const deleteUser = async () => {
    user.setDeleteUserActiveRequset(true);
    const toastContainer = new ToastContainer();

    try {
      await adminDeleteUser({ id: users[userDeleteIndex].id });
      await getUserData();
      toastContainer.error(getErrorMessage("User deleted!"));
    } catch (error) {
      console.error(error);
      toastContainer.error(getErrorMessage(error));
    } finally {
      user.setDeleteUserActiveRequset(false);
    }
  };

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
    onClick: (e: React.MouseEvent) => {
      toggleColumnSort(e, columnId);
    },
    sortDirection: getSortDirection(columnId),
  });

  const rows = sort(getRows());

  return (
    uiState.openAdminPanel && (
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
              {rows.map(({ item, rowId }) => (
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
                        onClick={function (): void {
                          setShowDialogPage(true);
                          setUserDeleteIndex(Number(rowId));
                        }}
                      >
                        <div
                          className={globalClasses.actionButtonIconContainer}
                        >
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
          {adminPageActiveRequest && users.length === 0 && (
            <Spinner
              appearance="primary"
              size="huge"
              className={classes.tableLoader}
            />
          )}
        </div>
        {userDeleteIndex >= 0 && users.length > userDeleteIndex && (
          <DeleteDialog
            open={showDialogPage}
            onClose={function (): void {
              setShowDialogPage(false);
            }}
            style={{ width: "500px" }}
            onConfirm={deleteUser}
            TitleText={
              <div>
                Are you sure you want to delete{" "}
                <span
                  style={{
                    fontStyle: "italic",
                    color: tokens.colorBrandForeground1,
                  }}
                >
                  {users[userDeleteIndex].username}
                </span>
                ?
              </div>
            }
            BodyText={"This account will be permanently deleted!"}
            isActive={user.deleteUserActiveRequset}
          />
        )}
        <div className={classes.refreshContainer}>
          {adminPageActiveRequest && users.length !== 0 && (
            <Spinner appearance="primary" size="medium" />
          )}
          <Button
            appearance="secondary"
            className={classes.refreshButton}
            onClick={getUserData}
            disabled={adminPageActiveRequest}
          >
            Refresh
          </Button>
        </div>
      </div>
    )
  );
});

export default AdminPanel;
