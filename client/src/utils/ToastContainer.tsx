import {
  Link,
  Spinner,
  Toast,
  ToasterProps,
  ToastId,
  ToastTitle,
  ToastTrigger,
  useToastController,
} from "@fluentui/react-components";
import { JSX } from "react/jsx-runtime";

type ToastFunctions = ReturnType<typeof useToastController>;
type ToastOptions = Parameters<ToastFunctions["dispatchToast"]>[1];

export const DEFAULT_TOASTER_PROPS: ToasterProps = {
  position: "top-end",
  pauseOnHover: true,
  pauseOnWindowBlur: true,
  timeout: 2000,
} as const;

const DEFAULT_SUCCESS_PARAMETERS: ToastOptions = {
  timeout: 2000,
  intent: "success",
} as const;

const DEFAULT_ERROR_PARAMETERS: ToastOptions = {
  intent: "error",
  timeout: 2000,
} as const;

const DEFAULT_LOADING_PARAMETERS: ToastOptions = {
  timeout: -1,
} as const;

export default class ToastContainer {
  private toastId: ToastId;
  private isActive: boolean = false;
  private static currentId: number = 0;
  private static toastFunctions?: ToastFunctions;

  constructor() {
    this.toastId = String(ToastContainer.currentId);
    ToastContainer.currentId += 1;
  }

  static register(dispach: ToastFunctions) {
    ToastContainer.toastFunctions = dispach;
  }

  private createOrUpdateToast(content: JSX.Element, options?: ToastOptions) {
    if (ToastContainer.toastFunctions === undefined) {
      return;
    }
    if (this.isActive) {
      ToastContainer.toastFunctions.updateToast({
        content: content,
        toastId: this.toastId,
        ...options,
      });
    } else {
      this.isActive = true;
      ToastContainer.toastFunctions.dispatchToast(content, {
        toastId: this.toastId,
        ...options,
      });
    }
  }

  loading(message: string) {
    const content = (
      <Toast>
        <ToastTitle media={<Spinner size="tiny" />}>{message}</ToastTitle>
      </Toast>
    );
    this.createOrUpdateToast(content, DEFAULT_LOADING_PARAMETERS);
  }

  success(message: string) {
    const content = (
      <Toast>
        <ToastTitle
          action={
            <ToastTrigger>
              <Link>Close</Link>
            </ToastTrigger>
          }
        >
          {message}
        </ToastTitle>
      </Toast>
    );
    this.createOrUpdateToast(content, DEFAULT_SUCCESS_PARAMETERS);
  }

  error(message: string) {
    const content = (
      <Toast>
        <ToastTitle
          action={
            <ToastTrigger>
              <Link>Close</Link>
            </ToastTrigger>
          }
        >
          {message}
        </ToastTitle>
      </Toast>
    );
    this.createOrUpdateToast(content, DEFAULT_ERROR_PARAMETERS);
  }

  dismiss() {
    if (ToastContainer.toastFunctions === undefined) {
      return;
    }
    ToastContainer.toastFunctions.dismissToast(this.toastId);
  }
}
