import { Button, makeStyles, Spinner } from "@fluentui/react-components";
import {
  ChevronDoubleLeftFilled,
  ChevronDoubleRightFilled,
  ChevronLeftFilled,
  ChevronRightFilled,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "end",
    gap: "15px",
    height: "25px",
  },
  paginationButton: {
    height: "20px",
  },
  container: {
    display: "flex",
    marginTop: "30px",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
interface Props {
  pageSkip: number;
  pageSize: number;
  pageNumber: number;
  maxPageNumber: number;
  ListLenght: number;
  setPageNumberFunction: (pageNumber: number) => void;
  buttonStyle?: React.CSSProperties;
  showSpinner?: boolean;
}
const Paganation = ({
  pageSkip,
  pageSize,
  pageNumber,
  maxPageNumber,
  ListLenght,
  setPageNumberFunction,
  buttonStyle = {},
  showSpinner,
}: Props) => {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <Button
        style={buttonStyle}
        className={classes.paginationButton}
        onClick={() => setPageNumberFunction(pageNumber)}
        disabled={showSpinner}
      >
        Refresh
      </Button>
      <div className={classes.pagination}>
        {showSpinner && <Spinner appearance="primary" size="extra-small" />}
        <div>
          <span>
            {pageSkip - (pageSize - 1)} -{" "}
            {pageSkip > ListLenght ? ListLenght : pageSkip} of {ListLenght}
          </span>
        </div>
        <Button
          style={buttonStyle}
          className={classes.paginationButton}
          icon={<ChevronDoubleLeftFilled />}
          disabled={pageNumber <= 1}
          onClick={() => setPageNumberFunction(1)}
        />
        <Button
          style={buttonStyle}
          className={classes.paginationButton}
          icon={<ChevronLeftFilled />}
          disabled={pageNumber <= 1}
          onClick={() => setPageNumberFunction(pageNumber - 1)}
        />
        <Button
          style={buttonStyle}
          className={classes.paginationButton}
          icon={<ChevronRightFilled />}
          disabled={maxPageNumber <= pageNumber}
          onClick={() => setPageNumberFunction(pageNumber + 1)}
        />
        <Button
          style={buttonStyle}
          className={classes.paginationButton}
          icon={<ChevronDoubleRightFilled />}
          disabled={maxPageNumber <= pageNumber}
          onClick={() => setPageNumberFunction(maxPageNumber)}
        />
      </div>
    </div>
  );
};

export default Paganation;
