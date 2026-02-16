import { useState } from "react";
import MenuBarItem from "./MenuBarItem";
import { makeStyles, tokens, Tooltip, Image } from "@fluentui/react-components";
import { Button, MenuItem, Label, Text } from "@fluentui/react-components";
import CreateProjectDialog from "./CreateProjectDialog";
import OpenProjectDialog from "./OpenProjectDialog";
import {
  DarkTheme20Regular,
  PlugConnected20Filled,
  PlugDisconnected20Filled,
  PeopleAdd20Filled,
} from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { rootStore, useMst } from "@/stores/RootStore";
import ShareProject from "./ShareProject";
import KaustLogo from "./icons/kaust_logo.svg";
import ToastContainer from "../../utils/toastContainer";
import { getErrorMessage } from "@/utils/helpers";

const useStyles = makeStyles({
  menubar: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: `2px solid ${tokens.colorNeutralBackground1Hover}`,
    paddingBottom: "8px",
    paddingTop: "8px",
    paddingLeft: "8px",
    minHeight: "32px",
    zIndex: "2",
  },
  button: { border: "0px", fontWeight: tokens.fontWeightRegular },
  logoIcon: {
    marginLeft: "10px",
    marginRight: "18px",
    width: "40px",
  },
  userStatus: {
    alignContent: "center",
    marginRight: "15px",
    border: `2px solid ${tokens.colorNeutralForeground3}`,
    borderRadius: "20px",
    padding: "5px 15px",
    display: "flex",
    columnGap: "10px",
  },
});

interface Props {
  toggleTheme: () => void;
  connectionStatus: string;
}

const MenuBar = observer(({ toggleTheme, connectionStatus }: Props) => {
  const { user, logout, uiState } = useMst();

  const classes = useStyles();
  const [isShareProjectOpen, setIsShareProjectOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const handleCreateProjectClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleOpenProjectClick = () => {
    setIsOpenDialogOpen(true); // Open the Open Project dialog
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setProjectName(""); // Clear project name on close
  };

  const handleCloseOpenDialog = () => {
    setIsOpenDialogOpen(false); // Close the Open Project dialog
  };

  const handleConfirmCreate = async () => {
    if (projectName.length === 0) {
      alert("Project name must not be empty.");
      return;
    }

    if (user.isGuest) {
      return;
    }
    const toastContainer = new ToastContainer();

    try {
      user.userProjects.setCreateProjectActiveRequest(true);
      await user.userProjects.createProject(projectName, projectDescription);
      toastContainer.success("Project created.");
      handleCloseCreateDialog();
    } catch (error) {
      toastContainer.error(getErrorMessage(error));
      console.error("Error:", error);
    }
    user.userProjects.setCreateProjectActiveRequest(false);
  };

  return (
    <div className={classes.menubar}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Image src={KaustLogo} className={classes.logoIcon} />
        {!user.isGuest && !rootStore.pageDisabled && (
          <MenuBarItem label="Select Project">
            <MenuItem key="newProject" onClick={handleCreateProjectClick}>
              New Project
            </MenuItem>
            <MenuItem key="openProject" onClick={handleOpenProjectClick}>
              Open Project
            </MenuItem>
          </MenuBarItem>
        )}
        {user.userProjects.activeProjectId && !rootStore.pageDisabled && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <Label style={{ marginLeft: "20px" }}>
              {"Active Project: "} {user.userProjects.activeProject?.name}
            </Label>
            {!user.isGuest &&
              user.userProjects.activeProject &&
              user.userProjects.activeProject.accessLevel >= 0 && (
                <Tooltip
                  content={"Sharing"}
                  relationship={"label"}
                  appearance="inverted"
                  withArrow={true}
                >
                  <Button
                    style={{ marginLeft: "10px" }}
                    appearance="subtle"
                    onClick={() => setIsShareProjectOpen(true)}
                    icon={<PeopleAdd20Filled />}
                  />
                </Tooltip>
              )}
          </div>
        )}
        <Tooltip
          content={"Loads the demo project from the server."}
          relationship={"label"}
          appearance="inverted"
          withArrow={true}
          positioning={"after"}
        >
          <Button
            style={{ marginLeft: "50px" }}
            appearance="subtle"
            onClick={() => {
              user.userProjects.loadDemoProject().catch(console.error);
            }}
            disabled={rootStore.pageDisabled}
          >
            Open Demo Project
          </Button>
        </Tooltip>
      </div>
      <div style={{ display: "flex" }}>
        {!user.isGuest && !rootStore.pageDisabled ? (
          <div style={{ display: "flex", minHeight: "34px" }}>
            <div className={classes.userStatus} style={{ minHeight: "20px" }}>
              <Text weight="bold">{user.name}</Text>
              {connectionStatus === "Open" ? (
                <Tooltip
                  content={"Connected to Server"}
                  relationship={"label"}
                  appearance="inverted"
                  withArrow={true}
                >
                  <PlugConnected20Filled
                    style={{ color: tokens.colorBrandForeground1 }}
                  />
                </Tooltip>
              ) : (
                <Tooltip
                  content={"Reconnecting to Server"}
                  relationship={"label"}
                  appearance="inverted"
                  withArrow={true}
                >
                  <PlugDisconnected20Filled
                    // style={{ color: tokens.colorStatusDangerBackground3 }}
                    style={{ color: tokens.colorPaletteMarigoldBorderActive }}
                  />
                </Tooltip>
              )}
            </div>
            <Button
              appearance="subtle"
              onClick={() => {
                logout().catch(console.error);
              }}
            >
              Logout
            </Button>
            <Button appearance="subtle" onClick={uiState.toggleOpenProfilePage}>
              Profile
            </Button>
            {user.admin && (
              <Button appearance="subtle" onClick={uiState.toggleOpenAdminPage}>
                Admin
              </Button>
            )}
          </div>
        ) : (
          <>
            <Button
              style={{ marginRight: "5px" }}
              appearance="subtle"
              onClick={uiState.toggleSignInPage}
              disabled={rootStore.pageDisabled}
            >
              Sign In
            </Button>
            <Button
              appearance="subtle"
              onClick={uiState.toggleSignUpPage}
              disabled={rootStore.pageDisabled}
            >
              Sign Up
            </Button>
          </>
        )}
        <Button
          style={{
            minWidth: "34px",
            marginRight: "18.5px",
            marginLeft: "18.5px",
          }}
          size="small"
          appearance="subtle"
          onClick={toggleTheme}
        >
          <DarkTheme20Regular />
        </Button>
      </div>

      {/* Render CreateProjectDialog */}

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        onConfirm={() => {
          handleConfirmCreate().catch(console.error);
        }}
        projectName={projectName}
        setProjectName={setProjectName}
        projectDescription={projectDescription}
        setProjectDescription={setProjectDescription}
        isActive={user.userProjects.createProjectActiveRequest}
      />

      {/* Render OpenProjectDialog */}
      <OpenProjectDialog
        open={isOpenDialogOpen}
        onClose={handleCloseOpenDialog}
      />

      <ShareProject
        open={isShareProjectOpen}
        setOpen={setIsShareProjectOpen}
      ></ShareProject>
    </div>
  );
});

export default MenuBar;
