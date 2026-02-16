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
  onEdit: (name: string, description: string) => Promise<void>;
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
  const [inProgress, setInProgress] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription);
    }
  }, [open, defaultName, defaultDescription]);

  const handleEdit = async () => {
    setInProgress(true);
    try {
      await onEdit(name, description);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setInProgress(false);
    }
  };

  const loading = inProgress || isActive;

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>

          <DialogContent style={{ padding: "15px 0" }}>
            <Field label="Name">
              <Input
                appearance="underline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="Description" style={{ marginTop: 10 }}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                textarea={{ rows: 4, className: "custom-textarea" }}
              />
            </Field>
          </DialogContent>

          <DialogActions>
            {loading ? (
              <Spinner appearance="primary" size="medium" />
            ) : (
              <>
                <Button appearance="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  onClick={handleEdit}
                  disabled={!open}
                >
                  Update
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default EditDialog;
