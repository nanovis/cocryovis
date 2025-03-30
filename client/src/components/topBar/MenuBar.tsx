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
import { useMst } from "../../stores/RootStore";
import ShareProject from "./ShareProject";
import KaustLogo from "./icons/kaust_logo.svg";

const useStyles = makeStyles({
  menubar: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: `2px solid ${tokens.colorNeutralBackground1Hover}`,
    paddingBottom: "8px",
    paddingTop: "8px",
    paddingLeft: "8px",
    minHeight: "32px",
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
  toggleSignClick: (id: number) => void;
  toggleTheme: () => void;
  connectionStatus: string;
}

const MenuBar = observer(
  ({ toggleSignClick, toggleTheme, connectionStatus }: Props) => {
    const { user, logout } = useMst();

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
      try {
        if (projectName.length === 0) {
          alert("Project name must not be empty.");
          return;
        }

        if (user.isGuest) {
          return;
        }

        await user.userProjects.createProject(projectName, projectDescription);

        handleCloseCreateDialog();
      } catch (error) {
        console.error("Error:", error);
      }
    };

    return (
      <div className={classes.menubar}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Image src={KaustLogo} className={classes.logoIcon} />
          {!user.isGuest && (
            <MenuBarItem
              label="Project"
              children={[
                <MenuItem key="newProject" onClick={handleCreateProjectClick}>
                  New Project
                </MenuItem>,
                <MenuItem key="openProject" onClick={handleOpenProjectClick}>
                  Open Project
                </MenuItem>,
              ]}
            />
          )}
          {!user.isGuest && user.userProjects.activeProjectId && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <Label style={{ marginLeft: "10px" }}>
                {"Active Project: "} {user.userProjects.activeProject?.name}
              </Label>
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
                ></Button>
              </Tooltip>
            </div>
          )}
        </div>
        <div style={{ display: "flex" }}>
          {!user.isGuest ? (
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
              <Button appearance="subtle" onClick={() => logout()}>
                Logout
              </Button>
            </div>
          ) : (
            <>
              <Button
                style={{ marginRight: "5px" }}
                appearance="subtle"
                onClick={() => toggleSignClick(0)}
              >
                Sign In
              </Button>
              <Button appearance="subtle" onClick={() => toggleSignClick(1)}>
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
          onConfirm={handleConfirmCreate}
          projectName={projectName}
          setProjectName={setProjectName}
          projectDescription={projectDescription}
          setProjectDescription={setProjectDescription} // Pass the state setter to the dialog
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
  }
);

export default MenuBar;
