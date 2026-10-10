/**
 * Prisma → JSON for settlements: always emit atlasReference so NextResponse.json
 * never omits the key (undefined keys are stripped by JSON.stringify).
 */
export function settlementJsonWithAtlasReference<T extends { atlasReference?: boolean | null }>(
  row: T,
): T & { atlasReference: boolean } {
  return { ...row, atlasReference: Boolean(row.atlasReference) };
}
