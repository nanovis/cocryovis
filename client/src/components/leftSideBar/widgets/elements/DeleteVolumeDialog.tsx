import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
} from "@fluentui/react-components";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteVolumeDialog = ({ open, onClose, onConfirm }: Props) => {
  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Remove Volume</DialogTitle>
          <DialogContent style={{ paddingTop: "15px", paddingBottom: "15px" }}>
            Do you want to remove the selected volume from the active project?
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

export default DeleteVolumeDialog;
