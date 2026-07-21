import { preprocessingDiagnosticSchema, type PreprocessingDiagnostic } from "./arabic-intelligence.ts";

export type AudioPreprocessingResult = {
  file: File;
  cleanup: () => Promise<void>;
};

export type AudioPreprocessingAdapter = (original: File) => Promise<AudioPreprocessingResult>;

export type PreparedAudio = {
  file: File;
  diagnostic: PreprocessingDiagnostic;
  cleanup: () => Promise<void>;
};

const noCleanup = async () => {};

export async function prepareAudioForTranscription(
  original: File,
  requested: boolean,
  adapter?: AudioPreprocessingAdapter,
): Promise<PreparedAudio> {
  if (!requested) {
    return {
      file: original,
      cleanup: noCleanup,
      diagnostic: preprocessingDiagnosticSchema.parse({
        requested: false,
        status: "not_requested",
        adapter: "original",
        reason: "The original upload was sent without optional preprocessing.",
        originalPreserved: true,
        temporaryFilesCreated: false,
        temporaryFilesDeleted: true,
      }),
    };
  }

  if (!adapter) {
    return {
      file: original,
      cleanup: noCleanup,
      diagnostic: preprocessingDiagnosticSchema.parse({
        requested: true,
        status: "skipped",
        adapter: "original",
        reason: "No safe local FFmpeg adapter is configured; the original audio was used unchanged.",
        originalPreserved: true,
        temporaryFilesCreated: false,
        temporaryFilesDeleted: true,
      }),
    };
  }

  try {
    const processed = await adapter(original);
    return {
      file: processed.file,
      cleanup: processed.cleanup,
      diagnostic: preprocessingDiagnosticSchema.parse({
        requested: true,
        status: "applied",
        adapter: "optional_adapter",
        reason: "Optional moderate-phone-audio preprocessing was applied to a temporary copy.",
        originalPreserved: true,
        temporaryFilesCreated: true,
        temporaryFilesDeleted: false,
      }),
    };
  } catch {
    return {
      file: original,
      cleanup: noCleanup,
      diagnostic: preprocessingDiagnosticSchema.parse({
        requested: true,
        status: "fallback",
        adapter: "original",
        reason: "Optional preprocessing failed safely; the original audio was used unchanged.",
        originalPreserved: true,
        temporaryFilesCreated: false,
        temporaryFilesDeleted: true,
      }),
    };
  }
}

export function markTemporaryAudioDeleted(diagnostic: PreprocessingDiagnostic): PreprocessingDiagnostic {
  return preprocessingDiagnosticSchema.parse({ ...diagnostic, temporaryFilesDeleted: true });
}
