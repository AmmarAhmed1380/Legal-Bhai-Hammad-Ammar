import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

import { clientInputErrorResponse, isFastifyClientInputError, isFastifyValidationError, validationErrorResponse } from "./validation-errors.js";

export function createFastifyServer(options: FastifyServerOptions = {}) {
  return Fastify({
    logger: false,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: false,
        allErrors: true,
      },
    },
    ...options,
  });
}

export function registerValidationErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (isFastifyValidationError(error)) {
      reply.code(400).send(validationErrorResponse(error));
      return;
    }
    if (isFastifyClientInputError(error)) {
      reply.code(400).send(clientInputErrorResponse(error));
      return;
    }
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      reply.code(413).send({ error: "Upload exceeds the 10 MB limit" });
      return;
    }
    reply.code((error as { statusCode?: number }).statusCode ?? 500).send({
      error: error instanceof Error ? error.message : "Unexpected server error",
    });
  });
}
