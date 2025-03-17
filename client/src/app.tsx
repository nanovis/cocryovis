import { useEffect, useRef, useState } from "react";
import "./App.css";

import MenuBar from "./components/topBar/MenuBar";
import SideControls from "./components/leftSideBar/SideControls";
import RightSideControls from "./components/rightSideBar/RightSideControls";

import { makeStyles } from "@fluentui/react-components";
import SignInPage, { SignInCredentials } from "./components/topBar/SignInPage";
import SignUpPage, { SignUpCredentials } from "./components/topBar/SignUpPage";
import Cookies from "js-cookie";
import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Utils from "./functions/Utils";
import { useServerListener } from "./hooks/useServerListener";
import { observer } from "mobx-react-lite";
import { useMst } from "./stores/RootStore";
import { UserSnapshotIn } from "./stores/userState/UserModel";
import { websocketUrl } from "./urls";

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

    const { login, logout, user } = useMst();

    const connectionStatus = useServerListener(`${websocketUrl}/ws`, user);

    const fetchAuthCookieData = () => {
      var cookieData = Cookies.get(CookieName);
      if (!cookieData) {
        return null;
      }
      return JSON.parse(cookieData);
    };

    const getLoggedUserData = async () => {
      const response = await Utils.sendReq("getLoggedUserData", {
        method: "GET",
      });
      return await response.json();
    };

    const setupUser = async (user: UserSnapshotIn) => {
      setShowSignUp(false);
      setShowSignIn(false);
      login(user);
    };

    const [LoginInit, setLoginInit] = useState(false);

    const getIsUserAuth = async () => {
      if (LoginInit) return !!user;

      setLoginInit(true);
      const cookieData = fetchAuthCookieData();
      if (!cookieData) {
        return false;
      }
      try {
        const userData = await getLoggedUserData();
        setupUser(userData);
      } catch {
        Cookies.remove(CookieName);
        logout();
        setShowSignIn(true);
      }
    };

    const [showSignIn, setShowSignIn] = useState(!getIsUserAuth());
    const [showSignUp, setShowSignUp] = useState(false);
    const classes = useStyles();

    const handleSignIn = async (credentials: SignInCredentials) => {
      try {
        const response = await Utils.sendRequestWithToast(
          "login",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: credentials.username.value,
              password: credentials.password.value,
            }),
          },
          { successText: "Sign-In successful!" }
        );
        const userData = await response.json();
        setupUser(userData);
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
        const response = await Utils.sendRequestWithToast(
          "register",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: userData.fullName,
              username: userData.username,
              password: userData.password,
              email: userData.email,
            }),
          },
          { successText: "Sign-Up successful!" }
        );
        const contents = await response.json();

        setupUser(contents);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    const toggleSignClick = (id: number) => {
      if (id === 0) {
        setShowSignIn(!showSignIn || !user); // Use camelCase here
        setShowSignUp(false); // Use camelCase here
      } else if (id === 1) {
        setShowSignUp(!showSignUp || !user); // Use camelCase here
        setShowSignIn(false); // Use camelCase here
      } else {
        setShowSignUp(false); // Use camelCase here
        setShowSignIn(false); // Use camelCase here
      }
    };

    const canvasKeyDown = (event: any) => {
      if (event.key === "Control") {
        window.WasmModule?.enable_annotation_mode(true);
        console.log("PING");
      }
    };

    const canvasKeyUp = (event: any) => {
      if (event.key === "Control") {
        window.WasmModule?.enable_annotation_mode(false);
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
          <div id="rendering" onContextMenu={(e) => e.preventDefault()}>
            {showSignIn && <SignInPage onSignIn={handleSignIn} />}
            {showSignUp && <SignUpPage onSignUp={handleSignUp} />}
            <canvas
              id="canvas"
              tabIndex={0}
              onKeyDown={canvasKeyDown}
              onKeyUp={canvasKeyUp}
            />
          </div>
          {!showSignIn && !showSignUp && <RightSideControls />}
        </div>
      </div>
    );
  }
);

export default App;
