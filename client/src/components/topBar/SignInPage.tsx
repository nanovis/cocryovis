import { useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { Button as FluentUIButton, Input } from "@fluentui/react-components";

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
    color: "#DEFF5C",
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
    color: "#DEFF5C",
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
    marginLeft: "15px", // Adjust the spacing between buttons
  },
});



export interface SignInCredentials {
  username: string;
  password: string;
}

interface Props {
  onSignIn: (credentials: SignInCredentials) => void;
}

const SignInPage = ({ onSignIn }: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const classes = useStyles();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const credentials: SignInCredentials = {
      username: username,
      password: password,
    };
    onSignIn(credentials);
  };

  const handleClear = () => {
    // Clear form fields
    setUsername("");
    setPassword("");
  };

  return (
    <div className={classes.container}>
      <h2 className={classes.signInHeader}>Sign In</h2>
      <form onSubmit={handleSubmit}>
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
        <div className={classes.buttonRow}>
          <FluentUIButton
            appearance="primary"
            type="submit"
            className={classes.button}
          >
            Sign In
          </FluentUIButton>
          {/* Add a space between Clear and Sign In buttons */}
          <div className={classes.buttonSpacer}></div>
          {/* Clear button */}
          <FluentUIButton
            type="button"
            onClick={handleClear}
            className={classes.buttonSecondary}
          >
            Clear
          </FluentUIButton>
        </div>
      </form>
    </div>
  );
};

export default SignInPage;
