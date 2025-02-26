interface Window {
  createVolumeRenderer: (options: any) => Promise<Module>;
  WasmModule: Module | null;
}

interface Module {
  start_app: () => Promise<void>;
  on_resize: (width: number, height: number) => void;
  chooseClippingPlane: (value: any) => void;
  get_annotations: () => string;
  reset_annotations: () => void;
  enable_annotation_mode: (enable: boolean) => void;
  open_volume: () => void;
  getAnnotationKernelSize: () => number;
  setAnnotationKernelSize: (size: number) => void;
  adjustTransferFunction: (
    tfIndex: number,
    ramp_low: number,
    ramp_high: number,
    red: number,
    blue: number,
    green: number
  ) => void;
  show_volume: (which: number, show: boolean) => void;
  is_volume_shown: (which: number) => boolean;
  clip_volume: (state: boolean, which: number) => void;
  doInference: (
    volumeJsonFileName: string,
    parametersFileName: string
  ) => Promise<any[]>;
  listAvailableVolumes: () => string;
  getVolume: (selectedVolumeName: string) => any;
  loadForSart: (fileName: string, volume_depth: number) => Promise<string>;
  FS: {
    writeFile: (filename, data) => Promise<void>;
    readFile: (filename, options?) => Promise<Uint8Array | string>;
  };

  enable_early_ray_termination: (state: boolean) => void;
  enable_jittering: (state: boolean) => void;
  enable_soft_shadows: (state: boolean) => void;
  set_shadow_quality: (quality: number) => void;
  set_shadow_strength: (strength: number) => void;
  set_shadow_radius: (radius: number) => void;
  enable_post_processing: (state: boolean) => void;
  set_sample_rate: (rate: number) => void;
  enableAO: (state: boolean) => void;
  set_ao_radius: (radius: number) => void;
  set_ao_strength: (strength: number) => void;
  set_ao_samples: (samples: number) => void;
  set_near_plane: (nearPlane: number) => void;
  set_far_plane: (farPlane: number) => void;
  setColor: (r: number, g: number, b: number) => void;
}

interface FileChangeEvent extends React.ChangeEvent<HTMLInputElement> {}
interface InputChangeEvent extends React.ChangeEvent<HTMLInputElement> {}