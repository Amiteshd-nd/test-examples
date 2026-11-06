/**
 * The WHATWG `TextDecoder`, present in every runtime the engine targets (browsers, Node with its
 * default full ICU, Deno, Bun). Its types live in the DOM and Node libraries, which the engine
 * leaves out on purpose (PRD §0.4), so only this one pure text-decoding API is declared (D-15).
 */
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
  readonly encoding: string;
  decode(input?: Uint8Array): string;
}
