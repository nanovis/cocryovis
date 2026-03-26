import type { VolumeInstance } from "@/stores/userState/VolumeModel";
import { downloadBlob } from "@/utils/helpers";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  makeStyles,
  tokens,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, Copy20Regular } from "@fluentui/react-icons";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type MouseEvent } from "react";

interface Props {
  volume: VolumeInstance | undefined;
}

const useStyles = makeStyles({
  container: {
    marginTop: "8px",
  },
  subtitle: {
    margin: "6px 0",
    color: tokens.colorNeutralForeground2,
    fontSize: "12px",
  },
  header: {
    display: "flex",
    gap: "24px",
    alignItems: "center",
  },
  panelButtons: {
    display: "flex",
    gap: "4px",
  },
  panelContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  codeBlock: {
    margin: 0,
    padding: "10px",
    maxHeight: "220px",
    overflow: "auto",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    fontSize: "12px",
    lineHeight: "16px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  statusText: {
    transitionProperty: "opacity",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
    opacity: 1,
    fontFamily: tokens.fontFamilyMonospace,
  },
  statusSuccess: {
    color: tokens.colorNeutralForeground2,
  },
  statusFailed: {
    color: tokens.colorStatusDangerForeground1,
  },
});

const ReconstructionParameters = observer(({ volume }: Props) => {
  const classes = useStyles();
  const [copyStatus, setCopyStatus] = useState<null | "copied" | "failed">(
    null
  );
  const [copyStatusVisible, setCopyStatusVisible] = useState(false);
  const copyStatusTimoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyStatusTimoutRef.current) {
        window.clearTimeout(copyStatusTimoutRef.current);
      }
    };
  }, []);

  if (!volume?.rawData) {
    return null;
  }

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!volume.rawData?.reconstructionParametersString) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        volume.rawData.reconstructionParametersString
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    } finally {
      setCopyStatusVisible(true);
      if (copyStatusTimoutRef.current) {
        window.clearTimeout(copyStatusTimoutRef.current);
      }
      copyStatusTimoutRef.current = window.setTimeout(
        () => setCopyStatusVisible(false),
        2000
      );
    }
  };

  const handleDownload = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!volume.rawData?.reconstructionParametersString) {
      return;
    }

    const blob = new Blob([volume.rawData.reconstructionParametersString], {
      type: "application/json",
    });
    downloadBlob(blob, `${volume.name}_reconstruction_parameters.json`);
  };

  if (!volume.rawData.reconstructionParameters) {
    return (
      <div className={classes.container}>
        <Text italic className={classes.subtitle}>
          Tomogram Source: Direct upload.
        </Text>
      </div>
    );
  }

  return (
    <div className={classes.container}>
      <Text italic className={classes.subtitle}>
        Tomogram Source: Tomographic Reconstruction.
      </Text>
      <Accordion collapsible>
        <AccordionItem value="reconstruction-params">
          <AccordionHeader>
            <div className={classes.header}>
              <Text>Show reconstruction parameters</Text>
              <div className={classes.panelButtons}>
                <Tooltip
                  content="Download parameters as a JSON file"
                  relationship={"label"}
                  appearance="inverted"
                >
                  <Button
                    appearance="subtle"
                    icon={<ArrowDownload20Regular />}
                    onClick={handleDownload}
                  />
                </Tooltip>
                <Tooltip
                  content="Copy parameters to clipboard"
                  relationship={"label"}
                  appearance="inverted"
                >
                  <Button
                    appearance="subtle"
                    icon={<Copy20Regular />}
                    onClick={(event) => void handleCopy(event)}
                  />
                </Tooltip>
              </div>

              <Text
                size={200}
                className={classes.statusText}
                style={{
                  opacity: copyStatusVisible ? 1 : 0,
                  color:
                    copyStatus === "copied"
                      ? tokens.colorNeutralForeground2
                      : tokens.colorStatusDangerForeground1,
                }}
              >
                {copyStatus === "copied" ? "Copied" : "Copy failed"}
              </Text>
            </div>
          </AccordionHeader>
          <AccordionPanel>
            <div className={classes.panelContent}>
              <pre className={classes.codeBlock}>
                {volume.rawData.reconstructionParametersString}
              </pre>
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
});

export default ReconstructionParameters;
