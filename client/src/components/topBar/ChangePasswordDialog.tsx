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
  tokens,
  Spinner,
} from "@fluentui/react-components";
import { FormEvent, useState } from "react";
import { updateUser } from "../../api/users";
import ToastContainer from "../../utils/ToastContainer";
import { getErrorMessage } from "../../utils/Helpers";
import { useMst } from "../../stores/RootStore";
import { observer } from "mobx-react-lite";

const useStyles = makeStyles({
  fieldHeight: {
    height: "80px",
  },
  inputHeigh: {
    minHeight: "34px",
    height: "34px",
  },
  passwordMatch: {
    display: "flex",
    minHeight: "30px",
    alignSelf: "start",
  },
  errorText: {
    color: tokens.colorStatusDangerForeground1,
  },
  dialogContent: {
    paddingTop: "15px",
    paddingBottom: "15px",
    display: "flex",
    flexDirection: "column",
  },
  loadingSpinner: {
    marginRight: "10px",
  },
});
interface Props {
  open: boolean;
  onClose: () => void;
}

const ChangePasswordDialog = observer(({ open, onClose }: Props) => {
  const { user } = useMst();

  const classes = useStyles();
  const [matchingPasswords, setIsMatchingPasswords] = useState(false);
  function resetMatchingPassword() {
    setIsMatchingPasswords(false);
    onClose();
  }

  // TODO use new React 19 actions
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const toastContainer = new ToastContainer();

    try {
      event.preventDefault();

      user.setChangePasswordActiveRequest(true);
      const form = event.currentTarget;
      const inputPassword = form.elements.namedItem(
        "password"
      ) as HTMLInputElement;
      const inputRepeatPassword = form.elements.namedItem(
        "repeatPassword"
      ) as HTMLInputElement;
      if (inputPassword.value !== inputRepeatPassword.value) {
        return;
      }
      await updateUser({ password: inputPassword.value });
      toastContainer.success("Password changed!");
    } catch (error) {
      console.error(error);
      toastContainer.error(getErrorMessage(error));
    } finally {
      user.setChangePasswordActiveRequest(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogSurface style={{ width: "400px" }}>
        <form
          onSubmit={(event) => {
            handleSubmit(event).catch(console.error);
          }}
        >
          <DialogBody>
            <DialogTitle>Change Password</DialogTitle>
            <DialogContent className={classes.dialogContent}>
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
              {user.changePasswordActiveRequest ? (
                <div>
                  <Spinner
                    appearance="primary"
                    size="medium"
                    className={classes.loadingSpinner}
                  />
                </div>
              ) : (
                <>
                  <Button
                    appearance="secondary"
                    onClick={resetMatchingPassword}
                  >
                    Back
                  </Button>
                  <Button
                    appearance="primary"
                    type="submit"
                    disabled={user.changePasswordActiveRequest}
                  >
                    Change
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
});

export default ChangePasswordDialog;
