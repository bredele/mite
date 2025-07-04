import { stream, Agent } from "undici";
import deflate from "deflate-stream";
import { Readable } from "node:stream";

export default (url: string, agent?: Agent): Readable => {
  const options = agent
    ? { method: "GET" as const, dispatcher: agent }
    : { method: "GET" as const };
  const deflateTransform = deflate();
  stream(url, options, () => {
    return deflateTransform;
  });
  return deflateTransform;
};

export const agent = (options: Agent.Options): Agent => {
  return new Agent(options);
};
