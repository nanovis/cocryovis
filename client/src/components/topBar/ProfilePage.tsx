import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore";
import {
  List,
  ListItem,
  makeStyles,
  Text,
  Button,
  tokens,
  Input,
  mergeClasses,
} from "@fluentui/react-components";
import { useState } from "react";
import DeleteDialog from "../shared/DeleteDialog";
import GlobalStyles from "../globalStyles";
import ChangePasswordDialog from "./ChangePasswordDialog";
import * as usersApi from "../../api/users";
import ToastContainer from "../../utils/toastContainer";
import { getErrorMessage } from "../../utils/helpers";

const useStyles = makeStyles({
  container: {
    marginTop: "30px",
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
    gap: "10px",
    zIndex: 1,
  },
  profilePageHeader: {
    marginTop: "50px",
    marginBottom: "48px",
    fontSize: "32px",
    color: tokens.colorBrandForeground1,
  },
  list: {
    marginTop: "50px",
    minWidth: "340px",
  },
  listItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
    marginBottom: "10px",
    minHeight: "40px",
  },
  listLabel: {
    fontWeight: "bold",
    minWidth: "100px",
    color: tokens.colorBrandForeground1,
  },
  button: {
    marginTop: "8px",
    paddingLeft: "30px",
    paddingRight: "30px",
    height: "40px",
  },
  buttonSecondary: {
    marginTop: "8px",
    paddingLeft: "30px",
    paddingRight: "30px",
    height: "40px",
  },
  buttonRow: {
    display: "flex",
    marginTop: "30px",
    justifyContent: "center",
    gap: "25px",
  },
  label: {
    paddingLeft: "13px",
  },
  input: {
    width: "230px",
  },
});

const ProfilePage = observer(() => {
  const { user, logout } = useMst();
  const classes = useStyles();
  const globalClasses = GlobalStyles();

  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);

  const [showDialogPage, setShowDialogPage] = useState(false);
  const [showChangePage, setShowChangePage] = useState(false);
  const [showChangePasswordPage, setShowChangePasswordPage] = useState(false);

  const allowChange = () => {
    console.log("original", user.name, "changed", name);
    return (
      user.name === name && user.username === username && user.email === email
    );
  };

  const setBack = () => {
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
    setShowChangePage(false);
  };

  const changeUserInformation = async () => {
    const toastContainer = new ToastContainer();

    try {
      const userData = await usersApi.updateUser({
        name: name,
        username: username,
        email: email,
      });
      toastContainer.success("Change successful!");
      user.setName(userData.name);
      user.setUsername(userData.username);
      user.setEmail(userData.email);
      setShowChangePage(false);
    } catch (error) {
      console.error(error);
      toastContainer.error(getErrorMessage(error));
    }
  };

  const deleteUser = async () => {
    try {
      user.setDeleteUserActiveRequest(true);
      await usersApi.deleteUser();
      await logout();
    } catch (error) {
      console.error(error);
      const toastContainer = new ToastContainer();
      toastContainer.error(getErrorMessage(error));
    } finally {
      user.setDeleteUserActiveRequest(false);
    }
  };

  return (
    <div className={classes.container}>
      <h2 className={classes.profilePageHeader}>User profile</h2>
      <List className={classes.list}>
        <ListItem className={classes.listItem}>
          <Text className={classes.listLabel}>Name:</Text>
          {showChangePage ? (
            <>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={classes.input}
              />
            </>
          ) : (
            <>
              <Text className={classes.label}>{user.name}</Text>
            </>
          )}
        </ListItem>
        <hr />
        <ListItem className={classes.listItem}>
          <Text className={classes.listLabel}>Username:</Text>
          {showChangePage ? (
            <>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={classes.input}
              />
            </>
          ) : (
            <>
              <Text className={classes.label}>{user.username}</Text>
            </>
          )}
        </ListItem>
        <hr />
        <ListItem className={classes.listItem}>
          <Text className={classes.listLabel}>Email:</Text>
          {showChangePage ? (
            <>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={classes.input}
              />
            </>
          ) : (
            <>
              <Text className={classes.label}>{user.email}</Text>
            </>
          )}
        </ListItem>
      </List>
      <div className={classes.buttonRow}>
        {showChangePage ? (
          <Button
            appearance="primary"
            onClick={() => {
              changeUserInformation().catch(console.error);
            }}
            className={classes.button}
            disabled={allowChange()}
          >
            Confirm Changes
          </Button>
        ) : (
          <>
            <Button
              appearance="primary"
              type="button"
              onClick={() => setShowChangePage(true)}
              className={classes.button}
            >
              Edit Profile
            </Button>
            <Button
              appearance="primary"
              type="button"
              className={classes.button}
              onClick={() => setShowChangePasswordPage(true)}
            >
              Change Password
            </Button>
          </>
        )}
        {showChangePage ? (
          <Button
            type="button"
            onClick={() => setBack()}
            className={classes.buttonSecondary}
          >
            Back
          </Button>
        ) : (
          <Button
            type="button"
            className={mergeClasses(
              globalClasses.actionButtonDelete,
              classes.buttonSecondary
            )}
            onClick={() => setShowDialogPage(true)}
          >
            Delete
          </Button>
        )}
      </div>
      <DeleteDialog
        open={showDialogPage}
        onClose={function (): void {
          setShowDialogPage(false);
        }}
        style={{ width: "500px", height: "" }}
        onConfirm={() => {
          deleteUser().catch(console.error);
        }}
        TitleText={"Are you sure you want to delete your account?"}
        BodyText={
          "This account will be permanently deleted and cannot be recovered!"
        }
        isActive={user.deleteUserActiveRequest}
      />
      <ChangePasswordDialog
        open={showChangePasswordPage}
        onClose={function (): void {
          setShowChangePasswordPage(false);
        }}
      ></ChangePasswordDialog>
    </div>
  );
});

export default ProfilePage;
