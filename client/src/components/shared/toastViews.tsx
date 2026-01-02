import {
  Link,
  Spinner,
  Toast,
  ToastTitle,
  ToastTrigger,
} from "@fluentui/react-components";

export const LoadingToast = ({ message }: { message: string }) => {
  return (
    <Toast>
      <ToastTitle media={<Spinner size="tiny" />}>{message}</ToastTitle>
    </Toast>
  );
};

export const MessageToast = ({ message }: { message: string }) => {
  return (
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
};
