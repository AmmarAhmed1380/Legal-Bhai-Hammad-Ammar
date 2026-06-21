export interface TranscriptionResult {
  text: string;
  provider: "openai-whisper" | "development";
}

export async function transcribeCourtroomAudio(input: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      provider: "development",
      text: `[Voice note — ${input.fileName}] Transcription pending OpenAI Whisper configuration. Configure OPENAI_API_KEY to enable Urdu-English courtroom transcription.`,
    };
  }

  const form = new FormData();
  form.append("file", new Blob([input.bytes], { type: input.mimeType }), input.fileName);
  form.append("model", process.env.OPENAI_WHISPER_MODEL ?? "whisper-1");
  form.append(
    "prompt",
    "Pakistani courtroom note in Urdu and English. Preserve legal terms, case numbers, and next hearing dates.",
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Whisper transcription failed with status ${response.status}: ${errorBody}`);
  }
  const payload = (await response.json()) as { text?: string };
  return {
    provider: "openai-whisper",
    text: payload.text?.trim() || "No speech detected in the recording.",
  };
}
