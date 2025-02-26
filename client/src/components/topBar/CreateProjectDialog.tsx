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
  projectName: string;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  projectDescription: string;
  setProjectDescription: React.Dispatch<React.SetStateAction<string>>;
}

const CreateProjectDialog = ({
  open,
  onClose,
  onConfirm,
  projectName,
  setProjectName,
  projectDescription,
  setProjectDescription,
}: Props) => {
  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogContent>
            <Field label="Project Name">
              <Input
                style={{
                  marginTop: "30px",
                  marginBottom: "25px",
                  display: "flex",
                  flexDirection: "column",
                  alignContent: "center",
                  textAlign: "center",
                  width: "100%",
                }}
                appearance="underline"
                value={projectName}
                onChange={(e, data) => setProjectName(data.value)} // Update project name on change
                placeholder="Enter project's name"
              />
            </Field>

            <Field label="Project Description">
              <Textarea
                value={projectDescription}
                onChange={(e, data) => setProjectDescription(data.value)}
                style={{ marginTop: "10px" }}
                textarea={{ rows: 4, className: "custom-textarea" }}
                placeholder="Enter project's description"
              />
            </Field>
          </DialogContent>
          <DialogActions style={{ marginTop: "35px" }}>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={onConfirm}>
              Create New Project
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default CreateProjectDialog;
