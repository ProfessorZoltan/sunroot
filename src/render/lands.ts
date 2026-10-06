/**
 * Lands whose winter brings no snow: the Sun Desert's green winter, Lake Gardens' low-water
 * winter and Rainforest Gardens' dry season. There the shared art's snowy winter dress, the code-drawn frost and snow, falling
 * snow, a frozen river and winter coats are all left out.
 */
export const SNOWLESS_LANDS: readonly string[] = ['desert', 'lake', 'forest'];

export const snowless = (land: string | undefined): boolean =>
  land !== undefined && SNOWLESS_LANDS.includes(land);
