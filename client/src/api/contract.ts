import type { components } from './schema';
import type { Instrument, Project } from '../types/project';

/**
 * Compile-time checks that the hand-written domain model still lines up with the
 * server's OpenAPI schema.
 *
 * `src/api/schema.d.ts` is generated from the live server (`npm run gen:api`).
 * If someone changes a pydantic model without changing the types here, the build
 * fails on this file instead of at runtime in front of a reviewer.
 */

type Assert<T extends true> = T;

/** Everything the client sends is something the server will accept. */
export type ProjectIsValidInput = Assert<
  Project extends components['schemas']['Project-Input'] ? true : false
>;

/** Everything the catalog endpoint returns can be used as-is, with no mapping layer. */
export type CatalogIsUsable = Assert<
  components['schemas']['Instrument'] extends Instrument ? true : false
>;

/**
 * Deliberately not asserted: `Project-Output` has an optional `effects` on each
 * track, because the server defaults it for projects saved before effects
 * existed. Loading therefore goes through `validateProject`, which fills the
 * gaps — the schema cannot express "absent means these defaults".
 */
