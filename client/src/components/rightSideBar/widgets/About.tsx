import {
  Link,
  Tooltip,
  Text,
  List,
  ListItem,
} from "@fluentui/react-components";
import globalStyles from "../../globalStyles";
import { ArrowCircleRight28Regular, Open24Filled } from "@fluentui/react-icons";

interface Props {
  open: boolean;
  close: () => void;
}

const About = ({ open, close }: Props) => {
  const globalClasses = globalStyles();

  return open ? (
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
          <h2
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
                <Open24Filled />
              </Tooltip>
            </Link>
          </h2>

          <h2>About CoCryoViS</h2>
          <Text>
            <strong>CoCryoViS</strong> is a web-based system designed to support
            tomographic reconstruction, segmentation, and visualization of
            Cryo-Electron Tomography (CryoET) data. Developed at{" "}
            <strong>KAUST</strong>, it integrates findings from multiple
            research projects to provide advanced tools for analyzing nanoscale
            biological structures.
          </Text>
          <div>
            <h3>Development Team</h3>
            <Text>
              The system is the result of collaborative efforts by researchers
              from various disciplines. Key contributors include:
            </Text>
            <Text weight="bold">
              {" "}
              Omar Mena, Uroš Šmajdek, Ngan Nguyen, Da Li, Tobias Klein, Peter
              Mindek, Weiping Zhang, Sai Li, Ciril Bohak, and Ivan Viola.
            </Text>
          </div>
          <div>
            <h3>Related Research</h3>
            <Text>
              The research underpinning Tomography has been published in leading
              scientific journals. Notable works include:
            </Text>

            <List
              style={{
                marginTop: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <ListItem>
                <Text weight="bold">
                  Nguyen, Ngan, Ciril Bohak, Dominik Engel, Peter Mindek, Ondřej
                  Strnad, Peter Wonka, Sai Li, Timo Ropinski, and Ivan Viola.
                </Text>
                <br />
                <Text italic>
                  Finding nano-Ötzi: Cryo-electron tomography visualization
                  guided by learned segmentation.
                </Text>
                <br />
                <Text italic>
                  IEEE Transactions on Visualization and Computer Graphics,
                  29(10), 2022: 4198-4214.
                </Text>
              </ListItem>

              <ListItem>
                <Text weight="bold">
                  Ramirez, Julio Rey, Peter Rautek, Ciril Bohak, Ondřej Strnad,
                  Zheyuan Zhang, Sai Li, Ivan Viola, and Wolfgang Heidrich.
                </Text>
                <br />
                <Text italic>
                  GPU Accelerated 3D Tomographic Reconstruction and
                  Visualization From Noisy Electron Microscopy Tilt-Series.
                </Text>
                <br />
                <Text italic>
                  IEEE Transactions on Visualization and Computer Graphics,
                  2022.
                </Text>
              </ListItem>
            </List>
          </div>

          <div>
            <h3>Copyright</h3>
            <Text>
              &copy; <Text weight="bold">KAUST</Text> – King Abdullah University
              of Science and Technology. All rights reserved.
            </Text>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default About;
