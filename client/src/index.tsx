import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import { RootStoreProvider, rootStore } from "./stores/RootStore";

import {
  FluentProvider,
  createDarkTheme,
  createLightTheme,
} from "@fluentui/react-components";
import { onPatch, onSnapshot } from "mobx-state-tree";
import React from "react";

// Import GPUFeatureName type
type GPUFeatureName = "texture-compression-bc" | "timestamp-query";

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

window.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Backspace" || event.key === "Tab") {
      event.stopImmediatePropagation();
    }
  },
  true
);
window.addEventListener(
  "keyup",
  function (event) {
    if (event.key === "Backspace" || event.key === "Tab") {
      event.stopImmediatePropagation();
    }
  },
  true
);

// onSnapshot(rootStore, (snapshot) => {
//   console.log("[MST] Snapshot:", snapshot);
// });

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const Main = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  
  async function initWebGPU(): Promise<{
    adapter: GPUAdapter;
    device: GPUDevice;
  }> {
    if (!navigator.gpu) {
      throw new Error(
        "WebGPU is not supported. Ensure you are using a secure context or a localhost."
      );
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get WebGPU adapter.");
    }

    const device = await adapter.requestDevice();
    return { adapter, device };
  }
    // async function initWebGPU(): Promise<{
    //   adapter: GPUAdapter;
    //   device: GPUDevice;
    // }> {
    //   if (!navigator.gpu) {
    //     throw new Error("WebGPU not supported.");
    //   }
    
    //   const adapter = await navigator.gpu.requestAdapter({
    //     powerPreference: "high-performance",
    //   });
    
    //   if (!adapter) {
    //     throw new Error("Failed to get WebGPU adapter.");
    //   }
    
    //   const requiredFeatures: GPUFeatureName[] = [];

    
    //   const device = await adapter.requestDevice({
    //     requiredFeatures,
    //   });
    
    //   if (!device) {
    //     throw new Error("Failed to acquire WebGPU device.");
    //   }
    
    //   return { adapter, device };
    // }
    

  async function initModule() {
    const { adapter, device } = await initWebGPU();

    if (!device) {
      console.error("Could not initialize WebGPU device.");
      return;
    }

    window.WasmModule = null;
    window.WasmModule = await window.createVolumeRenderer({
      preinitializedWebGPUDevice: device,
      canvas: document.getElementById("canvas"),

      preRun: [],
      postRun: [],
      print: (function () {
        return function (text: any) {
          text = Array.prototype.slice.call(arguments).join(" ");
          console.log("Renderer log: ", text);
        };
      })(),
      printErr: function (text: any) {
        text = Array.prototype.slice.call(arguments).join(" ");
        console.error("Renderer error: ", text);
      },
      setStatus: function (text: any) {
        console.log("Renderer status: " + text);
      },
      monitorRunDependencies: function (left: any) {},
    });

    console.log("Emscripten Module Initialized with WebGPU.");
    if (!window.WasmModule) {
      console.error("Could not initialize WebGPU device.");
      return;
    }
    await window.WasmModule.start_app();
    canvasResize();
    window.addEventListener("resize", canvasResize);

    setTimeout(() => {
      const spinner = document.getElementById("loading-spinner");
      if (spinner) {
        spinner.style.opacity = "0";
        spinner.style.visibility = "hidden";
        setTimeout(() => spinner.remove(), 250);
      }
    }, 250);
  }

  function canvasResize() {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    if (!canvas || !canvas.parentElement || !window.WasmModule) return;
    const parentWidth = canvas.parentElement.offsetWidth;

    const maxHeight = window.innerHeight;

    let canvasHeight = parentWidth * (9 / 16);

    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight;
      const limitedWidth = maxHeight * (16 / 9);
      canvas.style.width = `${limitedWidth}px`;
    } else {
      canvas.style.width = `${parentWidth}px`;
    }

    canvas.style.height = `${canvasHeight}px`;

    canvas.width = parseFloat(canvas.style.width);
    canvas.height = canvasHeight;

    window.WasmModule?.on_resize(
      Math.round(canvas.width),
      Math.round(canvas.height)
    );
  }

  useEffect(() => {
    if (!window.WasmModule) {
      initModule().catch((e) =>
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

root.render(<Main />);
