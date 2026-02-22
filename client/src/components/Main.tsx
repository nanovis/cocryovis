import { useEffect, useState } from "react";
import App from "./App";
import { RootStoreProvider, rootStore } from "../stores/RootStore";
import {
  FluentProvider,
  createDarkTheme,
  createLightTheme,
} from "@fluentui/react-components";
import React from "react";
import { loadScript } from "../utils/helpers";
import { obtainDevice } from "@/renderer/renderer";

const customDarkTheme = {
  10: "#030402",
  20: "#191A0F",
  30: "#282C17",
  40: "#33391C",
  50: "#3F4621",
  60: "#4A5325",
  70: "#56612A",
  80: "#626F2F",
  90: "#6F7D34",
  100: "#DEFF5C",
  110: "#889B3D",
  120: "#96AB42",
  130: "#A3BA47",
  140: "#B0CA4C",
  150: "#BEDA51",
  160: "#CCEA56",
};

const customLightTheme = {
  10: "#030402",
  20: "#191A0F",
  30: "#282C17",
  40: "#33391C",
  50: "#3F4621",
  60: "#4A5325",
  70: "#56612A",
  80: "#626F2F",
  90: "#6F7D34",
  100: "#33391C",
  110: "#889B3D",
  120: "#96AB42",
  130: "#A3BA47",
  140: "#B0CA4C",
  150: "#BEDA51",
  160: "#CCEA56",
};

const lightTheme = createLightTheme(customLightTheme);
const darkTheme = createDarkTheme(customDarkTheme);

// onSnapshot(rootStore, (snapshot) => {
//   console.log("[MST] Snapshot:", snapshot);
// });

const Main = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  async function initModule() {
    try {
      window.WasmModule = null;
      await loadScript("/index.js");

      // Check for WebGPU
      await obtainDevice();

      window.WasmModule = await window.createVolumeRenderer({
        canvas: document.getElementById("canvas"),

        locateFile: function (path: string) {
          if (path.endsWith(".data")) {
            return "/index.data";
          }
          if (path.endsWith(".wasm")) {
            return "/index.wasm";
          }
          return path;
        },

        preRun: [],
        postRun: [],
        print: (function () {
          return function (text: unknown) {
            text = Array.prototype.slice.call(arguments).join(" ");
            console.log("Renderer log: ", text);
          };
        })(),
        printErr: function (text: unknown) {
          text = Array.prototype.slice.call(arguments).join(" ");
          console.error("Renderer error: ", text);
        },
        setStatus: function (text: string) {
          console.log("Renderer status: " + text);
        },
        monitorRunDependencies: function () {
          /* empty */
        },
      });

      console.log("Emscripten Module Initialized with WebGPU.");
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!window.WasmModule) {
        console.error("Could not initialize WebGPU device.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/await-thenable
      await window.WasmModule.start_app();
      // canvasResize();
      // window.addEventListener("resize", canvasResize);

      setTimeout(() => {
        const spinner = document.getElementById("loading-spinner");
        if (spinner) {
          spinner.style.opacity = "0";
          spinner.style.visibility = "hidden";
          setTimeout(() => {
            spinner.remove();
            rootStore.setWasmLoaded(true);
          }, 250);
        }
      }, 250);
    } catch (e) {
      console.log(e);
      const spinner = document.getElementById("loading-spinner");
      if (spinner) {
        if (e instanceof Error) {
          spinner.innerHTML = `<div style="color: white">${e.message}</div>`;
        } else {
          spinner.innerHTML = `<div style="color: white">WebGPU not found, please refresh the page.</div>`;
        }
      }
    }
  }

  useEffect(() => {
    if (!window.WasmModule) {
      initModule().catch((e: unknown) =>
        console.error("Failed to initialize WebGPU module.", e)
      );
    }
  }, []);

  return (
    <RootStoreProvider value={rootStore}>
      <FluentProvider
        theme={isDarkMode ? darkTheme : lightTheme}
        style={{ height: "100%" }}
      >
        <React.StrictMode>
          <App toggleTheme={toggleTheme} />
        </React.StrictMode>
      </FluentProvider>
    </RootStoreProvider>
  );
};

export default Main;
