// The files a run's phases leave in their results, for the phases that read them.
export const CAPTURE_FILE = "capture.mp4";
export const CUES_FILE = "cues.json";
export const VOICED_FILE = "voice.json";
export const PLAN_FILE = "plan.json";
export const VIDEO_FILE = "video.mp4";
export const RENDERED_FILE = "render.json";
/** One small picture per step, in the record result (GH-139 decision 003). */
export const STEP_PICTURES_DIR = "steps";
export const stepPictureFile = (index: number): string => `${String(index).padStart(3, "0")}.jpg`;
