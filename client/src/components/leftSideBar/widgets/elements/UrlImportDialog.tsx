import { useRef, useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Field,
} from "@fluentui/react-components";
import { VolumeInstance } from "../../../../stores/userState/VolumeModel";
import { toast } from "react-toastify";

interface Props {
  open: boolean;
  volume: VolumeInstance | undefined;
  onClose: () => void;
}

const UrlImportDialog = ({ open, volume, onClose }: Props) => {
  const [isBusy, setIsBusy] = useState(false);

  const [url, setUrl] = useState<string>("");

  const handleSubmit = async () => {
    if (!volume) {
      toast.error("No Volume selected.");
      return;
    }
    try {
      await volume.uploadMrcUrl(url);
      onClose();
    } catch (_) {
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            Upload Volume From URL
          </DialogTitle>
          <DialogContent
            style={{
              display: "flex",
              flexDirection: "column",
              paddingTop: "15px",
              paddingBottom: "15px",
              rowGap: "10px",
            }}
          >
            <Input
              appearance="underline"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.example_url.com"
              disabled={isBusy}
            />
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              disabled={url.length < 1}
              appearance="primary"
              onClick={handleSubmit}
            >
              Submit
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default UrlImportDialog;
