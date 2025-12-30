import type { FormEvent } from "react";
import { useState } from "react";
import {
  Button,
  Input,
  Text,
  makeStyles,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { observer } from "mobx-react-lite";
import { getErrorMessage } from "@/utils/Helpers";
import { useMst } from "@/stores/RootStore";

const useStyles = makeStyles({
  container: {
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
  },
  signInHeader: {
    marginTop: "50px",
    marginBottom: "48px",
    fontSize: "32px",
    color: tokens.colorBrandForeground1,
  },
  inputContainer: {
    display: "flex",
    flexDirection: "column",
    marginTop: "16px",
    width: "300px",
  },
  label: {
    fontWeight: tokens.fontWeightRegular,
    marginBottom: "8px",
    color: tokens.colorBrandForeground1,
  },
  button: {
    marginTop: "8px",
    paddingLeft: "30px",
    paddingRight: "30px",
    height: "40px",
  },
  buttonSecondary: {
    marginTop: "8px",
    paddingLeft: "30px",
    paddingRight: "30px",
    height: "40px",
  },
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginTop: "8px",
  },
  errorText: {
    color: tokens.colorStatusDangerForeground1,
    paddingTop: "10px",
  },
});

export interface SignInCredentials {
  username: string;
  password: string;
}

interface Props {
  onSignIn: (credentials: SignInCredentials) => Promise<void>;
}

const SignInPage = observer(({ onSignIn }: Props) => {
  const { uiState } = useMst();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const classes = useStyles();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    uiState.setIsActive(true);
    setShowSpinner(true);
    setErrorMessage("");
    const credentials: SignInCredentials = {
      username: username,
      password: password,
    };
    try {
      await onSignIn(credentials);
    } catch (error) {
      setErrorMessage(getErrorMessage(error) + "!");
    }
    setShowSpinner(false);
    uiState.setIsActive(false);
  };

  const handleClear = () => {
    // Clear form fields
    setUsername("");
    setPassword("");
  };

  return (
    <div className={classes.container}>
      <h2 className={classes.signInHeader}>Sign In</h2>
      <form
        onSubmit={(event) => {
          handleSubmit(event).catch(console.error);
        }}
      >
        <div className={classes.inputContainer}>
          <label className={classes.label} htmlFor="username">
            Username:
          </label>
          <Input
            size="medium"
            appearance="filled-lighter"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            id="username"
          />
        </div>
        <div className={classes.inputContainer}>
          <label className={classes.label} htmlFor="password">
            Password:
          </label>
          <Input
            size="medium"
            appearance="filled-lighter"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            id="password"
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Text className={classes.errorText} weight="semibold">
            {errorMessage}
          </Text>
        </div>
        {showSpinner ? (
          <Spinner
            appearance="primary"
            size="huge"
            style={{
              marginTop: "8px",
            }}
          />
        ) : (
          <div className={classes.buttonRow}>
            <Button
              appearance="primary"
              type="submit"
              className={classes.button}
              disabled={showSpinner}
            >
              Sign In
            </Button>

            <Button
              type="button"
              onClick={handleClear}
              className={classes.buttonSecondary}
              disabled={showSpinner}
            >
              Clear
            </Button>
          </div>
        )}
      </form>
    </div>
  );
});
export default SignInPage;
