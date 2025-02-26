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
} from "@fluentui/react-components";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  modelName: string;
  setModelName: React.Dispatch<React.SetStateAction<string>>;
  modelDescription: string;
  setModelDescription: React.Dispatch<React.SetStateAction<string>>;
}

const CreateModelDialog = ({
  open,
  onClose,
  onConfirm,
  modelName,
  setModelName,
  modelDescription,
  setModelDescription,
}: Props) => {
  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Create New Model</DialogTitle>
          <DialogContent>
            <Field label="Model Name">
              <Input
                appearance="underline"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                style={{ marginBottom: "10px" }}
                placeholder="Enter model's name"
              />
            </Field>
            <Field label="Model Description">
              <Textarea
                value={modelDescription}
                onChange={(e) => setModelDescription(e.target.value)}
                style={{ marginTop: "10px" }}
                textarea={{ rows: 4, className: "custom-textarea" }}
                placeholder="Enter model's description"
              />
            </Field>
          </DialogContent>
          <DialogActions style={{ marginTop: "35px" }}>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={onConfirm}>
              Create New Model
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default CreateModelDialog;
