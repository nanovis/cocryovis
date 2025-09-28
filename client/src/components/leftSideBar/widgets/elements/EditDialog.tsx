import { useEffect, useState } from "react";
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
  title: string;
  onClose: () => void;
  onEdit: (name: string, description: string) => void;
  isActive: boolean;
  defaultName: string;
  defaultDescription: string;
}

const EditDialog = ({
  open,
  onClose,
  onEdit,
  isActive,
  title,
  defaultName,
  defaultDescription,
}: Props) => {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription);
    }
  }, [open]);

  const handleEdit = () => {
    onEdit(name, description);
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent style={{ paddingTop: "15px", paddingBottom: "15px" }}>
            <Field label="Name">
              <Input
                appearance="underline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ marginBottom: "10px" }}
              />
            </Field>
            <Field label="Description">
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
                <Button appearance="primary" onClick={handleEdit}>
                  Update
                </Button>
              </div>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default EditDialog;
