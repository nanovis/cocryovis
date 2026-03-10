import { useEffect } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Field,
  Textarea,
  Spinner,
} from "@fluentui/react-components";
import { volumeUpdateSchema } from "@cocryovis/schemas/componentSchemas/volume-schema";
import type z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";

type VolumeUpdateSchema = z.infer<typeof volumeUpdateSchema>;

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onEdit: (data: VolumeUpdateSchema) => Promise<void>;
  isActive: boolean;
  defaultName: string;
  defaultDescription: string;
}

const VolumeEditDialog = ({
  open,
  onClose,
  onEdit,
  isActive,
  title,
  defaultName,
  defaultDescription,
}: Props) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<VolumeUpdateSchema>({
    resolver: zodResolver(volumeUpdateSchema),
    mode: "onBlur",
    defaultValues: {
      name: defaultName,
      description: defaultDescription,
    },
  });

  const loading = isSubmitting || isActive;

  useEffect(() => {
    if (open) {
      reset({
        name: defaultName,
        description: defaultDescription,
      });
    }
  }, [open, defaultName, defaultDescription, reset]);

  const onSubmit = async (data: VolumeUpdateSchema) => {
    try {
      await onEdit(data);
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
        >
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>

            <DialogContent style={{ padding: "15px 0" }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Field
                    label="Name"
                    validationState={errors.name ? "error" : "none"}
                    validationMessage={errors.name?.message ?? " "}
                  >
                    <Input
                      {...field}
                      appearance="underline"
                      value={field.value ?? ""}
                    />
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Field
                    label="Description"
                    style={{ marginTop: 10 }}
                    validationState={errors.description ? "error" : "none"}
                    validationMessage={errors.description?.message ?? " "}
                  >
                    <Textarea
                      style={{ overflow: "hidden" }}
                      {...field}
                      textarea={{ rows: 4 }}
                      value={field.value ?? ""}
                    />
                  </Field>
                )}
              />
            </DialogContent>

            <DialogActions>
              {loading ? (
                <Spinner appearance="primary" size="medium" />
              ) : (
                <>
                  <Button appearance="secondary" onClick={onClose}>
                    Cancel
                  </Button>

                  <Button
                    appearance="primary"
                    type="submit"
                    disabled={!isValid}
                  >
                    Update
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
};

export default VolumeEditDialog;
