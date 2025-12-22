import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Spinner,
} from "@fluentui/react-components";
import { CSSProperties } from "react";
import { JSX } from "react/jsx-runtime";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  TitleText: string | JSX.Element;
  BodyText: string | JSX.Element;
  style?: CSSProperties;
  isActive: boolean;
  spinnerStyle?: CSSProperties;
}

const DeleteDialog = ({
  open,
  onClose,
  onConfirm,
  TitleText,
  BodyText,
  style = {},
  isActive,
}: Props) => {
  return (
    <Dialog open={open}>
      <DialogSurface style={style}>
        <DialogBody>
          <DialogTitle>{TitleText}</DialogTitle>
          <DialogContent style={{ paddingTop: "15px", paddingBottom: "15px" }}>
            {BodyText}
          </DialogContent>
          <DialogActions style={{ marginTop: "10px", height: "32px" }}>
            {isActive ? (
              <div>
                <Spinner
                  appearance="primary"
                  size="medium"
                  style={{marginRight: "10px"}}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "25px",
                }}
              >
                <Button appearance="secondary" onClick={onClose}>
                  No
                </Button>
                <Button appearance="primary" onClick={onConfirm}>
                  Yes
                </Button>
              </div>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default DeleteDialog;
