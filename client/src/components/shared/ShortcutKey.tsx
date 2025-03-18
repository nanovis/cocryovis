import { Text, tokens } from "@fluentui/react-components";

interface Props {
  content: string;
}

const ShortcutKey = ({ content }: Props) => {
  return (
    <Text font="monospace" style={{ color: tokens.colorNeutralForeground4 }}>
      [{content}]
    </Text>
  );
};

export default ShortcutKey;
