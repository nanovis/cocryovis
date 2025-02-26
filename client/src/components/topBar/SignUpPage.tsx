import { useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { Button, Input } from "@fluentui/react-components";

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
    color: "#DEFF50",
  },
  inputContainer: {
    display: "flex",
    justifyContent: "center",
    flexDirection: "column",
    rowGap: "2px",
    marginTop: "16px",
    width: "300px",
  },
  label: {
    fontWeight: tokens.fontWeightRegular,
    alignSelf: "flex-start", // Align labels to the left
    marginBottom: "8px",
    color: "#DEFF50",
  },
  kaustMemberCheckbox: {
    marginTop: "25px", // Space above the KAUST member checkbox
    alignSelf: "flex-start", // Align the checkbox to the left
  },

  button: {
    border: "0px",
    fontWeight: tokens.fontWeightRegular,
    alignItems: "center",
    marginTop: "8px",
    paddingLeft: "30px",
    paddingRight: "30px",
    height: "40px",
    lineHeight: "1", // This can help with vertical alignment
    paddingTop: "0",
    paddingBottom: "0",
    color: "#000",
    backgroundColor: "#DEFF5C",
    "&:hover": {
      backgroundColor: "#B0CA4C",
      color: "#000",
      cursor: "pointer",
    },
  },
  buttonSecondary: {
    border: "0px",
    fontWeight: tokens.fontWeightRegular,
    alignItems: "center",
    marginTop: "8px",
    paddingLeft: "30px",
    paddingRight: "30px",
    height: "40px",
    lineHeight: "1", // This can help with vertical alignment
    paddingTop: "0",
    paddingBottom: "0",
    color: "#000",
    backgroundColor: "#bfccbc",
    "&:hover": {
      backgroundColor: "#889B3D",
      color: "#000",
      cursor: "pointer",
    },
  },
  buttonRow: {
    display: "flex",
    marginTop: "30px", // Adjust the margin as needed
    justifyContent: "center",
  },
  buttonSpacer: {
    marginLeft: "15px",
  },

  kaustInput: {
    marginTop: "32px",
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
  const classes = useStyles();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const userData = {
      fullName,
      username,
      password,
      repeatpwd,
      email,
    };

    onSignUp(userData);
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
      <form onSubmit={handleSubmit}>
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
        {!passwordsMatch && repeatpwd != "" && (
          <div style={{ color: "red" }}>Passwords do not match!</div>
        )}

        <br />
        {/* ... (add more input fields as needed) ... */}
        <div className={classes.buttonRow}>
          <Button appearance="primary" type="submit" className={classes.button}>
            Sign Up
          </Button>
          <div className={classes.buttonSpacer}></div>
          <Button
            type="button"
            onClick={handleReset}
            className={classes.buttonSecondary}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SignUpPage;
