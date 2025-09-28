import { Text, tokens } from "@fluentui/react-components";
import { ErrorCircle16Filled } from "@fluentui/react-icons";

interface WrapperProps {
  content: string;
  hasWriteAccess: boolean | undefined;
}

export const WriteAccessTooltipContentWrapper = ({
  content,
  hasWriteAccess,
}: WrapperProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Text>{content}</Text>
      <WriteAccessTooltipContent hasWriteAccess={!!hasWriteAccess} />
    </div>
  );
};

interface Props {
  hasWriteAccess: boolean | undefined;
}

export const WriteAccessTooltipContent = ({ hasWriteAccess }: Props) => {
  return (
    <>
      {!hasWriteAccess && (
        <div>
          <ErrorCircle16Filled
            style={{
              color: tokens.colorPaletteRedBackground3,
              verticalAlign: "middle",
            }}
          />
          <Text
            style={{
              marginLeft: "3px",
              verticalAlign: "middle",
              color: tokens.colorNeutralForeground2,
            }}
          >
            Requires write access.
          </Text>
        </div>
      )}
      
    </>
  );
};
