import { Button, Link, makeStyles, Tooltip } from "@fluentui/react-components";
import globalStyles from "../../GlobalStyles";
import {
  ArrowCircleRight28Regular,
  Open20Filled,
  Open24Filled,
  Open32Regular,
  OpenRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({});

interface Props {
  open: boolean;
  close: () => void;
}

const About = ({ open, close }: Props) => {
  const classes = useStyles();
  const globalClasses = globalStyles();

  return (
    <div className={globalClasses.rightSidebar}>
      <div className={globalClasses.sidebarContents}>
        <div className={globalClasses.sidebarHeader}>
          <h1>About</h1>
          <div
            onClick={close}
            className={globalClasses.closeSidebarIconContainer}
          >
            <ArrowCircleRight28Regular
              className={globalClasses.closeSidebarIcon}
            />
          </div>
        </div>
        <div className={globalClasses.siderbarBody}>
          <div
            style={{
              display: "flex",
            }}
          >
            User Manual
            <Link
              style={{
                marginLeft: "10px",
                display: "flex",
              }}
              target="_"
              href={`https://docs.google.com/document/d/e/2PACX-1vQjgHSJ-kbe5bFp9JzaNPWlbikrnTgdI2qDPw3l4bJ8cBBG4nP9Mq-aS_cxLYYdUgaD01xbrsIAPFT9/pub`}
            >
              <Tooltip
                content="Open User Manual (Google Drive)"
                relationship="label"
                appearance="inverted"
                positioning="after"
                withArrow={true}
              >
                <Open20Filled />
              </Tooltip>
            </Link>
          </div>

          <p>
            This is a web-based interface for the Tomography project. It is
            intended to be used for managing neural models and training and
            inference tasks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
