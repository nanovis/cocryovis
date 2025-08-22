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
import { AdminDeleteUser, getAllUsers } from "../../api/users";

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
    overflowY: "auto",
    maxHeight: "calc(100vh - 250px)",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  refreshButton: {
    margin: "20px",
  },
  refreshContainer: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
  },
});

const AdminPanel = observer(() => {
  const classes = useStyles();
  const globalClasses = GlobalStyles();
  const [users, setUsers] = useState<User[]>([]);

  const [showDialogPage, setShowDialogPage] = useState(false);
  const [userDeleteIndex, setUserDeleteIndex] = useState(-1);

  useEffect(() => {
    getUserData();
  }, []);

  const getUserData = async () => {
    try {
      const usersData: z.infer<typeof usersArray> = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error(error);
    }
  };
  //LOL DELETE user-admin user doesn't exist in
  const deleteUser = async () => {
    try {
      await AdminDeleteUser(users[userDeleteIndex].id)
      await getUserData();
    } catch (error) {
      console.error(error);
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
        />
      )}
      <div className={classes.refreshContainer}>
        <Button
          appearance="secondary"
          className={classes.refreshButton}
          onClick={getUserData}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
});

export default AdminPanel;
