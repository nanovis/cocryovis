import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
} from "@fluentui/react-components";
import { CSSProperties } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  TitleText: string | JSX.Element;
  BodyText: string | JSX.Element;
  style?: CSSProperties;
}

const DeleteDialog = ({
  open,
  onClose,
  onConfirm,
  TitleText,
  BodyText,
  style = {},
}: Props) => {
  return (
    <Dialog open={open}>
      <DialogSurface style={style}>
        <DialogBody>
          <DialogTitle>{TitleText}</DialogTitle>
          <DialogContent style={{ paddingTop: "15px", paddingBottom: "15px" }}>
            {BodyText}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              No
            </Button>
            <Button appearance="primary" onClick={onConfirm}>
              Yes
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default DeleteDialog;
