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
  onConfirm: () => void;
  modelName: string;
  setModelName: React.Dispatch<React.SetStateAction<string>>;
  modelDescription: string;
  setModelDescription: React.Dispatch<React.SetStateAction<string>>;
  isActive: boolean;
}

const CreateModelDialog = ({
  open,
  onClose,
  onConfirm,
  modelName,
  setModelName,
  modelDescription,
  setModelDescription,
  isActive,
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
                <Button
                  appearance="secondary"
                  onClick={onClose}
                  disabled={isActive}
                >
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  onClick={onConfirm}
                  disabled={isActive}
                >
                  Create New Model
                </Button>
              </div>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default CreateModelDialog;
