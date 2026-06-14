interface OcrResult {
  text: string | null;
  status: "completed" | "pending_config" | "failed" | "missing_file";
}

export async function runOcr(buffer: Buffer | null, mimeType: string | null): Promise<OcrResult> {
  if (!buffer || !mimeType) {
    return {
      text: null,
      status: "missing_file",
    };
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return {
      text: null,
      status: "pending_config",
    };
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: buffer.toString("base64"),
          },
          features: [
            {
              type: "TEXT_DETECTION",
            },
          ],
          imageContext: {
            languageHints: ["en", "ur"],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    return {
      text: null,
      status: "failed",
    };
  }

  const json = (await response.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      textAnnotations?: Array<{ description?: string }>;
    }>;
  };

  const first = json.responses?.[0];
  const text =
    first?.fullTextAnnotation?.text ??
    first?.textAnnotations?.[0]?.description ??
    null;

  return {
    text,
    status: text ? "completed" : "failed",
  };
}
