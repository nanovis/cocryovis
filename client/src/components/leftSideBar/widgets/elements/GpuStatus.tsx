import { Text, makeStyles } from "@fluentui/react-components";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";

const useStyles = makeStyles({
  container: {
    display: "inline-grid",
    gridTemplateColumns: "auto auto",
    columnGap: "16px",
    rowGap: "2px",

    padding: "6px 10px",
  },

  header: {
    color: "var(--colorNeutralForeground3)",
    fontSize: "12px",
  },

  resource: {
    fontSize: "13px",
  },

  value: {
    fontFamily: "monospace",
    textAlign: "right",
  },

  row: {
    display: "contents",
  },

  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginRight: "6px",
  },

  resourceCell: {
    display: "flex",
    alignItems: "center",
  },
});

function statusColor(free: number, total: number) {
  const capacity = free / total;
  if (capacity === 0) return "var(--colorStatusDangerForegroundInverted)";
  if (capacity < 0.4) return "#c77d00";
  return "#3a7d44";
}

const GpuStatus = observer(() => {
  const styles = useStyles();
  const { user } = useMst();

  if (!user.status) return null;

  const { freeGpus, totalGpus } = user.status;

  return (
    <div className={styles.container}>
      <Text className={styles.header}>Resource</Text>
      <Text className={styles.header}>Available</Text>

      <div className={styles.row}>
        <div className={styles.resourceCell}>
          <div
            className={styles.dot}
            style={{ backgroundColor: statusColor(freeGpus, totalGpus) }}
          />
          <Text className={styles.resource}>GPU</Text>
        </div>

        <Text className={styles.value}>
          {freeGpus} / {totalGpus}
        </Text>
      </div>
    </div>
  );
});

export default GpuStatus;
