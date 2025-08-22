import { useEffect, useRef, useState } from "react";
import "./App.css";

import MenuBar from "./components/topBar/MenuBar";
import SideControls from "./components/leftSideBar/SideControls";
import RightSideControls from "./components/rightSideBar/RightSideControls";

import { makeStyles } from "@fluentui/react-components";
import SignInPage, { SignInCredentials } from "./components/topBar/SignInPage";
import SignUpPage, { SignUpCredentials } from "./components/topBar/SignUpPage";
import ProfilePage from "./components/topBar/ProfilePage";
import Cookies from "js-cookie";
import { Slide, toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as Utils from "./utils/Helpers";
import { useServerListener } from "./hooks/useServerListener";
import { observer } from "mobx-react-lite";
import { useMst } from "./stores/RootStore";
import { UserDB } from "./stores/userState/UserModel";
import { websocketUrl } from "./urls";
import AdminPanel from "./components/topBar/AdminPanel";
import { getLoggedUserData, login, register } from "./api/users";

const useStyles = makeStyles({
  app: { height: "100vh", display: "flex", flexDirection: "column" }, // Use viewport height
  mainPanel: {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    position: "relative",
    width: "100vw",
    height: "100vh",
    overflowY: "hidden",
    justifyContent: "space-between", // This will space out the children
  },
});

const App: React.FC<{ toggleTheme: () => void }> = observer(
  ({ toggleTheme }) => {
    const CookieName = "LoggedUser";

    const rootStore = useMst();
    const user = rootStore.user;
    const uiState = rootStore.uiState;

    const mouseOverCanvas = useRef(false);

    const connectionStatus = useServerListener(websocketUrl, user);

    const fetchAuthCookieData = () => {
      const cookieData = Cookies.get(CookieName);
      if (!cookieData) {
        return null;
      }
      return JSON.parse(cookieData);
    };

    const setupUser = async (user: UserDB) => {
      setShowSignUp(false);
      setShowSignIn(false);
      return await rootStore.login(user);
    };

    const [LoginInit, setLoginInit] = useState(true);

    const getIsUserAuth = async () => {
      if (!LoginInit) return;

      setLoginInit(false);
      const cookieData = fetchAuthCookieData();
      if (cookieData) {
        try {
          const userData = await getLoggedUserData();
          await setupUser(userData);
        } catch {
          Cookies.remove(CookieName);
          await rootStore.logout();
          setShowSignIn(true);
        }
      }

      // Wait until renderer is ready
      while (!rootStore.wasmLoaded) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await resolveProjectUrl();
      await resolveDemoUrl();
    };

    const resolveDemoUrl = async () => {
      const match = window.location.pathname.match(/^\/demo\/?$/);
      if (match) {
        window.history.replaceState(null, "", "/");
        await rootStore.user.userProjects.loadDemoProject();
      }
    };

    const resolveProjectUrl = async () => {
      const match = window.location.pathname.match(/^\/project\/(\w+)\/?$/);
      if (match) {
        window.history.replaceState(null, "", "/");
        let toastId = null;
        try {
          toastId = toast.loading("Loading Project...");

          const projectId = parseInt(match[1]);
          if (isNaN(projectId)) {
            throw new Error("Invalid project ID");
          }
          await rootStore.user.userProjects.setActiveProject(Number(projectId));
          toast.update(toastId, {
            render: "Project loaded successfully!",
            type: "success",
            isLoading: false,
            autoClose: 2000,
          });
        } catch (error) {
          Utils.updateToastWithErrorMsg(toastId, error);
          console.error(error);
        }
      }
    };

    const [showSignIn, setShowSignIn] = useState(false);
    const [showSignUp, setShowSignUp] = useState(false);
    const classes = useStyles();

    const handleSignIn = async (credentials: SignInCredentials) => {
      try {
        const userData = await login(credentials);
        await setupUser(userData);
      } catch (error) {
        console.error(error);
      }
    };

    const handleSignUp = async (userData: SignUpCredentials) => {
      if (userData.password != userData.repeatpwd) {
        alert("Please repeat the password correctly.");
        return;
      }
      try {
        const contents = await register({
          name: userData.fullName,
          username: userData.username,
          password: userData.password,
          email: userData.email,
        });
        await setupUser(contents);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    const toggleSignClick = (id: number) => {
      if (id === 0) {
        setShowSignIn(!showSignIn);
        setShowSignUp(false);
      } else if (id === 1) {
        setShowSignUp(!showSignUp);
        setShowSignIn(false);
      } else {
        setShowSignUp(false);
        setShowSignIn(false);
      }
    };

    useEffect(() => {
      getIsUserAuth();
      window.addEventListener("keydown", globalKeyDown);
      return () => {
        window.removeEventListener("keydown", globalKeyDown);
      };
    }, []);

    const globalKeyDown = (event: KeyboardEvent) => {
      if (mouseOverCanvas.current) {
        switch (event.key.toLowerCase()) {
          case "f":
            uiState.visualizedVolume?.setFullscreen(
              !uiState.visualizedVolume.fullscreen
            );
            break;
          case "r":
            uiState.visualizedVolume?.setShowRawClippingPlane(
              !uiState.visualizedVolume.showRawClippingPlane
            );
            break;
          case "l":
            uiState.visualizedVolume?.setEraseMode(
              !uiState.visualizedVolume.eraseMode
            );
            break;
          default:
            break;
        }
        if (event.shiftKey) {
          // Check for event codes since shift combos make other characters
          switch (event.code) {
            case "Digit1":
              uiState.visualizedVolume?.setClippingPlane("0");
              break;
            case "Digit2":
              uiState.visualizedVolume?.setClippingPlane("1");
              break;
            case "Digit3":
              uiState.visualizedVolume?.setClippingPlane("2");
              break;
            case "Digit4":
              uiState.visualizedVolume?.setClippingPlane("3");
              break;
            case "Digit5":
              uiState.visualizedVolume?.setClippingPlane("4");
              break;
          }
        }
      }
    };

    return (
      <div className={classes.app}>
        <ToastContainer
          position="top-center"
          autoClose={2000}
          transition={Slide}
          style={{ zIndex: 9999999 }}
        />
        <MenuBar
          toggleSignClick={toggleSignClick}
          toggleTheme={toggleTheme}
          connectionStatus={connectionStatus}
        />
        <div id="main-panel" className={classes.mainPanel}>
          {!showSignIn && !showSignUp && <SideControls />}
          <div
            id="rendering"
            onContextMenu={(e) => e.preventDefault()}
            onMouseEnter={() => (mouseOverCanvas.current = true)}
            onMouseLeave={() => (mouseOverCanvas.current = false)}
          >
            {showSignIn && <SignInPage onSignIn={handleSignIn} />}
            {showSignUp && <SignUpPage onSignUp={handleSignUp} />}
            {uiState.openProfilePage && <ProfilePage />}
            {uiState.openAdminPanel && <AdminPanel />}
            <canvas id="canvas" tabIndex={0} />
          </div>
          {!showSignIn && !showSignUp && <RightSideControls />}
        </div>
      </div>
    );
  }
);

export default App;
