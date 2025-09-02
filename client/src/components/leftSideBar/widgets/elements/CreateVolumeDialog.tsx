import { useState } from "react";
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
  Textarea,
  Spinner,
} from "@fluentui/react-components";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
  isActive: boolean;
}

const CreateVolumeDialog = ({ open, onClose, onCreate, isActive }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    onCreate(name, description);
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Create New Volume</DialogTitle>
          <DialogContent style={{ paddingTop: "15px", paddingBottom: "15px" }}>
            <Field label="Volume Name">
              <Input
                appearance="underline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ marginBottom: "10px" }}
              />
            </Field>
            <Field label="Volume Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ marginTop: "10px" }}
                textarea={{ rows: 4, className: "custom-textarea" }}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            {isActive ? (
              <div>
                <Spinner
                  appearance="primary"
                  size="medium"
                  style={{ marginRight: "10px" }}
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
                  Cancel
                </Button>
                <Button appearance="primary" onClick={handleCreate}>
                  Create
                </Button>
              </div>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default CreateVolumeDialog;
