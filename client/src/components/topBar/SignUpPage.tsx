import { useState } from "react";
import { makeStyles, Spinner, tokens, Text } from "@fluentui/react-components";
import { Button, Input } from "@fluentui/react-components";
import { getErrorMessage } from "../../utils/Helpers";

const useStyles = makeStyles({
  container: {
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
  },
  signUpHeader: {
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
  },
  kaustInput: {
    marginTop: "32px",
  },
  errorMesssage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  errorText: {
    color: tokens.colorStatusDangerForeground1,
    paddingTop: "10px",
  },
  passwordMatch: {
    display: "flex",
    minHeight: "30px",
    alignSelf: "start",
  },
});

export interface SignUpCredentials {
  fullName: string;
  username: string;
  password: string;
  repeatpwd: string;
  email: string;
}

interface Props {
  onSignUp: (userData: SignUpCredentials) => void;
}

const SignUpPage = ({ onSignUp }: Props) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatpwd, setRepeatpwd] = useState("");
  const [fullName, setFullName] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const classes = useStyles();

  const handleSubmit = async () => {
    setShowSpinner(true);
    setErrorMessage("");
    const userData = {
      fullName,
      username,
      password,
      repeatpwd,
      email,
    };
    try {
      await onSignUp(userData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
    setShowSpinner(false);
  };

  const handleReset = () => {
    setFullName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRepeatpwd("");
  };
  const passwordsMatch = password === repeatpwd;

  return (
    <div className={classes.container}>
      <h2 className={classes.signUpHeader}>Sign Up</h2>

      <div className={classes.inputContainer}>
        <label className={classes.label}>Full name:</label>
        <Input
          size="medium"
          appearance="filled-lighter"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className={classes.inputContainer}>
        <label className={classes.label}>Username:</label>
        <Input
          size="medium"
          appearance="filled-lighter"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className={classes.inputContainer}>
        <label className={classes.label}>Email:</label>
        <Input
          size="medium"
          appearance="filled-lighter"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className={classes.inputContainer}>
        <label className={classes.label}>Password:</label>
        <Input
          size="medium"
          appearance="filled-lighter"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className={classes.inputContainer}>
        <label className={classes.label}>Repeat Password:</label>
        <Input
          size="medium"
          appearance="filled-lighter"
          type="password"
          value={repeatpwd}
          onChange={(e) => setRepeatpwd(e.target.value)}
        />
      </div>
      <div className={classes.passwordMatch}>
        {!passwordsMatch && repeatpwd != "" && (
          <Text className={classes.errorText} weight="semibold">
            Passwords do not match!
          </Text>
        )}
      </div>
      <div>
        <div className={classes.errorMesssage}>
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
              onClick={handleSubmit}
              className={classes.button}
              disabled={showSpinner || !passwordsMatch}
            >
              Sign Up
            </Button>

            <Button
              type="button"
              onClick={handleReset}
              className={classes.buttonSecondary}
              disabled={showSpinner}
            >
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUpPage;
