import { Button, Spinner } from "@fluentui/react-components";
import {
  ChevronDoubleLeftFilled,
  ChevronDoubleRightFilled,
  ChevronLeftFilled,
  ChevronRightFilled,
} from "@fluentui/react-icons";

interface Props {
  pageSkip: number;
  pageSize: number;
  pageNumber: number;
  maxPageNumber: number;
  ListLenght: number;
  setPageNumberFunction: (pageNumber: number) => void;
  rowStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  rowClassName?: string;
  buttonClassName?: string;
  showSpinner?: boolean;
}
const Paganation = ({
  pageSkip,
  pageSize,
  pageNumber,
  maxPageNumber,
  ListLenght,
  setPageNumberFunction,
  rowStyle = {},
  buttonStyle = {},
  rowClassName,
  buttonClassName,
  showSpinner,
}: Props) => {
  return (
    <div style={rowStyle} className={rowClassName}>
      {showSpinner &&(
      <Spinner appearance="primary" size="extra-small"  />
      )}
      <div>
        <span>
          {pageSkip - (pageSize - 1)} -{" "}
          {pageSkip > ListLenght ? ListLenght : pageSkip} of {ListLenght}
        </span>
      </div>
      <Button
        style={buttonStyle}
        className={buttonClassName}
        icon={<ChevronDoubleLeftFilled />}
        disabled={pageNumber <= 1}
        onClick={() => setPageNumberFunction(1)}
      />
      <Button
        style={buttonStyle}
        className={buttonClassName}
        icon={<ChevronLeftFilled />}
        disabled={pageNumber <= 1}
        onClick={() => setPageNumberFunction(pageNumber - 1)}
      />
      <Button
        style={buttonStyle}
        className={buttonClassName}
        icon={<ChevronRightFilled />}
        disabled={maxPageNumber <= pageNumber}
        onClick={() => setPageNumberFunction(pageNumber + 1)}
      />
      <Button
        style={buttonStyle}
        className={buttonClassName}
        icon={<ChevronDoubleRightFilled />}
        disabled={maxPageNumber <= pageNumber}
        onClick={() => setPageNumberFunction(maxPageNumber)}
      />
    </div>
  );
};

export default Paganation;
