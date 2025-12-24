interface FileChangeEvent extends React.ChangeEvent<HTMLInputElement> {}
interface InputChangeEvent extends React.ChangeEvent<HTMLInputElement> {}

interface WidgetDefinition {
  title: string;
  labelPositioning: "before" | "after";
  LabelIcon: FluentIcon;
  widget: React.FC<{ open: boolean; close: () => void }>;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}
