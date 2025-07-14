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
  makeStyles,
} from "@fluentui/react-components";
import { FormEvent, useState } from "react";
import { sendRequestWithToast } from "../../utils/Helpers";

const useStyles = makeStyles({
  fieldHeight: {
    height: "80px",
  },
  inputHeigh: {
    minHeight: "34px",
    height: "34px",
  },
});
interface Props {
  open: boolean;
  onClose: () => void;
}

const ChangePasswordDialog = ({ open, onClose }: Props) => {
  const classes = useStyles();
  const [matchingPasswords, setIsMatchingPasswords] = useState(false);
  function resetMatchingPassword() {
    setIsMatchingPasswords(false);
    onClose();
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const inputPassword = form.elements.namedItem(
      "password"
    ) as HTMLInputElement;
    const inputRepeatPassword = form.elements.namedItem(
      "repeatPassword"
    ) as HTMLInputElement;
    if (inputPassword.value !== inputRepeatPassword.value) {
      setIsMatchingPasswords(true);
      return;
    }
    changePassword(inputPassword.value);
  }
  const changePassword = async (password: string) => {
    try {
      await sendRequestWithToast(
        "user",
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: password,
          }),
        },
        { successText: "Change successful!" }
      );
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <Dialog open={open}>
      <DialogSurface style={{ width: "400px" }}>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>Change Password</DialogTitle>
            <DialogContent
              style={{
                paddingTop: "15px",
                paddingBottom: "15px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <Field
                label="New Password"
                validationMessage={
                  matchingPasswords ? "Passwords do not match!" : ""
                }
                className={classes.fieldHeight}
              >
                <Input
                  required
                  type="password"
                  id={"new-password"}
                  name="password"
                  className={classes.inputHeigh}
                />
              </Field>
              <Field
                label="Repeat Password"
                validationMessage={
                  matchingPasswords ? "Passwords do not match!" : ""
                }
                className={classes.fieldHeight}
              >
                <Input
                  required
                  type="password"
                  id={"repeat-password"}
                  name="repeatPassword"
                  className={classes.inputHeigh}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={resetMatchingPassword}>
                Back
              </Button>
              <Button appearance="primary" type="submit">
                Change
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
};

export default ChangePasswordDialog;
