import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import "./App.css";

import MenuBar from "./components/topBar/MenuBar";
import SideControls from "./components/leftSideBar/SideControls";
import RightSideControls from "./components/rightSideBar/RightSideControls";

import {
  makeStyles,
  Toaster,
  useId,
  useToastController,
} from "@fluentui/react-components";
import type { SignInCredentials } from "./components/topBar/SignInPage";
import SignInPage from "./components/topBar/SignInPage";
import type { SignUpCredentials } from "./components/topBar/SignUpPage";
import SignUpPage from "./components/topBar/SignUpPage";
import ProfilePage from "./components/topBar/ProfilePage";
import * as Utils from "./utils/helpers";
import { useServerListener } from "./hooks/useServerListener";
import { observer } from "mobx-react-lite";
import { useMst } from "./stores/RootStore";
import { websocketUrl } from "./urls";
import AdminPanel from "./components/topBar/AdminPanel";
import { getLoggedUserData, login, register } from "./api/users";
import ToastContainer, { DEFAULT_TOASTER_PROPS } from "./utils/toastContainer";
import RendererCanvas from "./components/RendererCanvas/RendererCanvas";
import { getUserCookie, removeUserCookie } from "./utils/cookie";

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
  rendererContainer: {
    flex: 1,
    height: "100%",
  },
});

const App = observer(({ toggleTheme }: { toggleTheme: () => void }) => {
  const toasterId = useId("toaster");
  const toastFunctions = useToastController(toasterId);

  useEffect(() => {
    ToastContainer.register(toastFunctions);
  }, [toastFunctions]);

  const rootStore = useMst();
  const user = rootStore.user;
  const uiState = rootStore.uiState;

  const mouseOverCanvasRef = useRef(false);

  const connectionStatus = useServerListener(websocketUrl, user);

  // TODO put the following auth functions into mobx
  const resolveProjectUrl = useCallback(async () => {
    const match = /^\/project\/(\w+)\/?$/.exec(window.location.pathname);
    if (match) {
      window.history.replaceState(null, "", "/");
      const toastContainer = new ToastContainer();
      try {
        toastContainer.loading("Loading Project...");
        const projectId = parseInt(match[1]);
        if (isNaN(projectId)) {
          throw new Error("Invalid project ID");
        }
        await rootStore.user.userProjects.setActiveProject(projectId);
        toastContainer.success("Project loaded successfully!");
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
        console.error("Error:", error);
      }
    }
  }, [rootStore.user.userProjects]);

  const resolveDemoUrl = useCallback(async () => {
    const match = /^\/demo\/?$/.exec(window.location.pathname);
    if (match) {
      window.history.replaceState(null, "", "/");
      await rootStore.user.userProjects.loadDemoProject();
    }
  }, [rootStore.user.userProjects]);

  const getIsUserAuth = useEffectEvent(async () => {
    if (rootStore.triedReloadingSession) return;
    rootStore.setTriedReloadingSession(true);
    const cookieData = getUserCookie();
    if (cookieData) {
      const toastContainer = new ToastContainer();
      try {
        rootStore.setReloadingSession(true);
        toastContainer.loading("Restoring previous session.");
        const userData = await getLoggedUserData();
        rootStore.login(userData);
        toastContainer.success("Session restored.");
      } catch {
        removeUserCookie();
        await rootStore.logout();
        uiState.setOpenSignInPage(true);
      } finally {
        rootStore.setReloadingSession(false);
      }
    }

    // Wait until renderer is ready
    while (!rootStore.wasmLoaded) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await resolveProjectUrl();
    await resolveDemoUrl();
  });

  const classes = useStyles();

  // TODO use new React 19 actions
  const handleSignIn = async (credentials: SignInCredentials) => {
    const userData = await login(credentials);
    rootStore.login(userData);
    const toastContainer = new ToastContainer();
    toastContainer.success("Sign-in successful!");
  };

  const handleSignUp = async (userData: SignUpCredentials) => {
    if (userData.password != userData.repeatpwd) {
      return;
    }
    const contents = await register({
      name: userData.fullName,
      username: userData.username,
      password: userData.password,
      email: userData.email,
    });
    rootStore.login(contents);
    const toastContainer = new ToastContainer();
    toastContainer.success("Sign-up successful!");
  };

  const globalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (mouseOverCanvasRef.current) {
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
            uiState.visualizedVolume?.setClippingPlane("none");
            break;
          case "Digit2":
            uiState.visualizedVolume?.setClippingPlane("view-aligned");
            break;
          case "Digit3":
            uiState.visualizedVolume?.setClippingPlane("x");
            break;
          case "Digit4":
            uiState.visualizedVolume?.setClippingPlane("y");
            break;
          case "Digit5":
            uiState.visualizedVolume?.setClippingPlane("z");
            break;
        }
      }
    }
  });

  useEffect(() => {
    getIsUserAuth().catch(console.error);
    window.addEventListener("keydown", globalKeyDown);
    return () => {
      window.removeEventListener("keydown", globalKeyDown);
    };
  }, []);

  return (
    <div className={classes.app}>
      <Toaster toasterId={toasterId} {...DEFAULT_TOASTER_PROPS} />
      <MenuBar toggleTheme={toggleTheme} connectionStatus={connectionStatus} />

      <div className={classes.mainPanel}>
        {!uiState.openSignInPage && !uiState.openSignUpPage && <SideControls />}

        <div
          id="rendering"
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          onMouseEnter={() => (mouseOverCanvasRef.current = true)}
          onMouseLeave={() => (mouseOverCanvasRef.current = false)}
        >
          {uiState.openSignInPage && <SignInPage onSignIn={handleSignIn} />}
          {uiState.openSignUpPage && <SignUpPage onSignUp={handleSignUp} />}
          {uiState.openProfilePage && <ProfilePage />}
          <AdminPanel />
          <div className={classes.rendererContainer}>
            <RendererCanvas />
          </div>
          <canvas id="canvas" tabIndex={0} />
        </div>
        {!uiState.openSignInPage && !uiState.openSignUpPage && (
          <RightSideControls />
        )}
      </div>
    </div>
  );
});

export default App;
